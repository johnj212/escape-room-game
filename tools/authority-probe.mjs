#!/usr/bin/env node
// tools/authority-probe.mjs — Pillar D authority probe (Phase 2, server-authority gate).
//
// Spins up a REAL server/index.js child process on PORT=3013 and drives it with 3 real
// socket.io-client connections (engineer/technician/overseer) — no mocks, no stubs. Proves
// the server, not the client, is the source of truth for phase, puzzle stage, positions and
// role gates: every assertion below fabricates or spoofs something a malicious/broken client
// could send, and checks the server's own authoritative state (as broadcast in 'room-state')
// either rejected the attempt outright or left the truth untouched.
//
// Assertions (numbered, printed PASS/FAIL, non-zero exit on any FAIL):
//   1. Fabricated events (puzzle-solved / set-phase / room-state / win) do nothing.
//   2. Teleport (>2 units in one 'move' emit) is rejected + 'error-msg' fires.
//   3. Wrong-role / out-of-range 'toggle-switch' is rejected (engineer, then technician OOR).
//   4. 'arm-scanner' while stage===1 is rejected, p2 untouched.
//   5. Legit P1 solve via legal move-steps + cipher toggles flips stage -> 2, p2 -> active.
//   6. Out-of-range 'arm-scanner' is rejected.
//   7. Two of three scanners armed never solves; latch expiry -> p2 lockout.
//   8. After lockout expires, all three arm within the window -> phase 'win'.
//
// CLI: node tools/authority-probe.mjs   (no flags; ~40-50s runtime)

import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { io as ioClient } from 'socket.io-client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

const PORT = 3013
const URL = `http://localhost:${PORT}`

// Mirrors shared/scannerPuzzle.js SCANNER_POSITIONS / SCANNER_RANGE and the server's
// SWITCHBOARD_POSITION / SWITCHBOARD_RANGE — this script is a client, so it only KNOWS
// these numbers the same way any client would (they're public deck geometry); it never
// gets to assume the server trusts them.
const SWITCHBOARD_POS = [5, 0]
const SCANNER_POSITIONS = {
  engineer: [-6.5, 3.5],
  technician: [6.5, 3.5],
  overseer: [0, 6.5],
}
const SPAWN = {
  engineer: [-3, 1.2, -2],
  technician: [3, 1.2, -2],
  overseer: [-2, 1.2, 4],
}
const LATCH_MS = 4000
const LOCKOUT_MS = 5000
const ARM_WINDOW_MS = 1500

let results = []
let overallOk = true

function report(n, name, pass, note = '') {
  overallOk = overallOk && pass
  results.push({ n, name, pass, note })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] #${n} ${name}${note ? ` — ${note}` : ''}`)
}

// ---------------------------------------------------------------------------
// Server process lifecycle
// ---------------------------------------------------------------------------

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['server/index.js'], {
      cwd: REPO_ROOT,
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let settled = false
    const onData = (chunk) => {
      if (settled) return
      if (/running on port/i.test(chunk.toString())) {
        settled = true
        resolve(child)
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`))
    child.on('error', (err) => {
      if (!settled) {
        settled = true
        reject(err)
      }
    })
    child.on('exit', (code, signal) => {
      if (!settled) {
        settled = true
        reject(new Error(`server exited before ready (code=${code}, signal=${signal})`))
      }
    })

    setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error('timed out waiting for server to report ready'))
      }
    }, 10_000)
  })
}

// ---------------------------------------------------------------------------
// Small socket / movement / state helpers
// ---------------------------------------------------------------------------

function connectClient() {
  return ioClient(URL, { reconnection: false, forceNew: true, transports: ['websocket'] })
}

function waitFor(socket, event, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for '${event}'`)), timeoutMs)
    socket.once(event, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

// Moves a player from a known position to a target via legal ≤1.8-unit XZ steps
// (server rejects any single 'move' whose 3D displacement² > 4, i.e. distance > 2).
// Returns the final position actually sent (which the server accepts verbatim).
async function walkTo(socket, from, to, maxStep = 1.8) {
  const dx = to[0] - from[0]
  const dz = to[2] - from[2]
  const dist = Math.hypot(dx, dz)
  const steps = Math.max(1, Math.ceil(dist / maxStep))
  let pos = from
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const next = [from[0] + dx * t, to[1], from[2] + dz * t]
    socket.emit('move', { position: next, rotation: 0 })
    pos = next
    await sleep(25)
  }
  return pos
}

function inRangeXZ(pos, [px, pz], range) {
  return Math.hypot(pos[0] - px, pos[2] - pz) < range
}

// SCANNER_POSITIONS (and SWITCHBOARD_POS) are 2-element [x, z] deck coords; walkTo
// needs a 3-element [x, y, z] target, so lift them onto a fixed eye-height plane.
function toXYZ([x, z], y = 1.2) {
  return [x, y, z]
}

// Latest authoritative room-state snapshot, kept fresh by a listener on the engineer
// socket (every broadcast — action-triggered or 30Hz tick — reaches every socket in
// the room, so one listener is enough to track the truth).
let latestState = null
function trackState(socket) {
  socket.on('room-state', (state) => {
    latestState = state
  })
}

async function pollUntil(predicate, timeoutMs, intervalMs = 100) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (latestState && predicate(latestState)) return true
    await sleep(intervalMs)
  }
  return latestState ? predicate(latestState) : false
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nPillar-D authority probe — spawning server/index.js on :${PORT}\n${'='.repeat(70)}`)

  const server = await startServer()
  console.log('[probe] server ready')

  let eng, tech, over
  try {
    eng = connectClient()
    tech = connectClient()
    over = connectClient()
    await Promise.all([waitFor(eng, 'connect'), waitFor(tech, 'connect'), waitFor(over, 'connect')])
    trackState(eng)

    // --- lobby setup: create + join + ready all 3 ---
    eng.emit('create-room', { name: 'Eng', role: 'engineer' })
    const joined = await waitFor(eng, 'joined-room')
    const roomId = joined.roomId

    tech.emit('join-room', { roomId, name: 'Tech', role: 'technician' })
    await waitFor(tech, 'joined-room')
    over.emit('join-room', { roomId, name: 'Over', role: 'overseer' })
    await waitFor(over, 'joined-room')

    eng.emit('player-ready')
    tech.emit('player-ready')
    over.emit('player-ready')

    const started = await pollUntil((s) => s.phase === 'playing', 5000)
    if (!started) {
      report(0, 'setup: game reaches playing phase', false, 'never entered playing phase')
      throw new Error('setup failed')
    }
    console.log('[probe] room started, phase=playing, stage=1')

    let engPos = [...SPAWN.engineer]
    let techPos = [...SPAWN.technician]
    let overPos = [...SPAWN.overseer]

    // ---------------------------------------------------------------
    // 1. Fabricated events do nothing to authoritative state.
    // ---------------------------------------------------------------
    {
      const before = JSON.stringify({
        phase: latestState.phase,
        stage: latestState.puzzleState.stage,
        p1Solved: latestState.puzzleState.p1.solved,
      })
      eng.emit('puzzle-solved', { solved: true })
      eng.emit('set-phase', { phase: 'win' })
      eng.emit('room-state', { phase: 'win', puzzleState: { stage: 99 } })
      eng.emit('win', { forced: true })
      await sleep(300)
      const after = JSON.stringify({
        phase: latestState.phase,
        stage: latestState.puzzleState.stage,
        p1Solved: latestState.puzzleState.p1.solved,
      })
      report(1, 'Fabricated events are no-ops', before === after, `before=${before} after=${after}`)
    }

    // ---------------------------------------------------------------
    // 2. Teleport rejected.
    // ---------------------------------------------------------------
    {
      const errorPromise = waitFor(eng, 'error-msg', 2000).catch(() => null)
      const teleportTarget = [engPos[0] + 50, engPos[1], engPos[2] + 50]
      eng.emit('move', { position: teleportTarget, rotation: 0 })
      const errMsg = await errorPromise
      await sleep(200)
      const serverPos = latestState.players[eng.id]?.position
      const unchanged = serverPos && serverPos.every((v, i) => Math.abs(v - engPos[i]) < 1e-6)
      report(
        2,
        'Teleport rejected (position unchanged + error-msg)',
        Boolean(errMsg) && unchanged,
        `errorMsg=${JSON.stringify(errMsg)} serverPos=${JSON.stringify(serverPos)}`,
      )
    }

    // ---------------------------------------------------------------
    // 3. Wrong-role / out-of-range toggle-switch rejected.
    // ---------------------------------------------------------------
    {
      const switchesBefore = JSON.stringify(latestState.puzzleState.p1.currentSwitches)
      // 3a: engineer (wrong role, out of range) tries to toggle.
      eng.emit('toggle-switch', { color: 'red' })
      await sleep(200)
      const switchesAfterEng = JSON.stringify(latestState.puzzleState.p1.currentSwitches)
      const stageAfterEng = latestState.puzzleState.stage

      // 3b: technician moves OUT of switchboard range, then tries to toggle.
      const farPos = [techPos[0], techPos[1], techPos[2] - 20]
      techPos = await walkTo(tech, techPos, farPos)
      await sleep(150)
      const outOfRange = !inRangeXZ(techPos, SWITCHBOARD_POS, 3)
      tech.emit('toggle-switch', { color: 'red' })
      await sleep(200)
      const switchesAfterTech = JSON.stringify(latestState.puzzleState.p1.currentSwitches)

      const pass =
        switchesBefore === switchesAfterEng &&
        stageAfterEng === 1 &&
        outOfRange &&
        switchesAfterEng === switchesAfterTech
      report(
        3,
        'Wrong-role / out-of-range toggle-switch rejected',
        pass,
        `engineer-in-range-but-wrong-role and technician-out-of-range both rejected (outOfRange=${outOfRange})`,
      )
    }

    // ---------------------------------------------------------------
    // 4. arm-scanner while stage===1 rejected, p2 untouched.
    // ---------------------------------------------------------------
    {
      const p2Before = JSON.stringify(latestState.puzzleState.p2)
      over.emit('arm-scanner')
      await sleep(200)
      const p2After = JSON.stringify(latestState.puzzleState.p2)
      report(
        4,
        'arm-scanner rejected while stage===1',
        latestState.puzzleState.stage === 1 && p2Before === p2After,
        `p2 unchanged=${p2Before === p2After}`,
      )
    }

    // ---------------------------------------------------------------
    // 5. Legit chain: technician walks into range, toggles the cipher exactly.
    // ---------------------------------------------------------------
    {
      techPos = await walkTo(tech, techPos, [...SPAWN.technician])
      await sleep(150)
      const cipher = latestState.puzzleState.p1.cipher
      for (const color of cipher) {
        tech.emit('toggle-switch', { color })
        await sleep(80)
      }
      const solved = await pollUntil(
        (s) => s.puzzleState.stage === 2 && s.phase === 'playing' && s.puzzleState.p2.status === 'active',
        3000,
      )
      report(
        5,
        'Legit P1 solve flips stage -> 2, p2 -> active, phase stays playing',
        solved,
        `cipher=${JSON.stringify(cipher)} stage=${latestState.puzzleState.stage} phase=${latestState.phase} p2.status=${latestState.puzzleState.p2.status}`,
      )
    }

    // ---------------------------------------------------------------
    // 6. Out-of-range arm-scanner rejected.
    // ---------------------------------------------------------------
    {
      // Engineer is still at spawn, far from its own scanner pedestal.
      const armedBefore = latestState.puzzleState.p2.armedAt.engineer
      const oor = !inRangeXZ(engPos, SCANNER_POSITIONS.engineer, 3)
      eng.emit('arm-scanner')
      await sleep(200)
      const armedAfter = latestState.puzzleState.p2.armedAt.engineer
      report(
        6,
        'Out-of-range arm-scanner rejected',
        oor && armedBefore === null && armedAfter === null,
        `engineerPos=${JSON.stringify(engPos)} armedAt.engineer stayed ${JSON.stringify(armedAfter)}`,
      )
    }

    // ---------------------------------------------------------------
    // 7. Two-role insufficiency: only engineer + overseer arm; never solved;
    //    latch expiry -> lockout.
    // ---------------------------------------------------------------
    {
      engPos = await walkTo(eng, engPos, toXYZ(SCANNER_POSITIONS.engineer))
      overPos = await walkTo(over, overPos, toXYZ(SCANNER_POSITIONS.overseer))
      await sleep(150)
      eng.emit('arm-scanner')
      await sleep(100)
      over.emit('arm-scanner')
      await sleep(300)

      const neverSolved = latestState.phase === 'playing' && latestState.puzzleState.p2.status !== 'solved'
      const lockedOut = await pollUntil(
        (s) => s.puzzleState.p2.status === 'lockout',
        LATCH_MS + 3000,
      )
      report(
        7,
        'Two-role arm never solves; latch expiry -> lockout',
        neverSolved && lockedOut,
        `p2.status=${latestState.puzzleState.p2.status} phase=${latestState.phase}`,
      )
    }

    // ---------------------------------------------------------------
    // 8. Full solve: after lockout expires, all three arm within the window.
    // ---------------------------------------------------------------
    {
      const active = await pollUntil((s) => s.puzzleState.p2.status === 'active', LOCKOUT_MS + 3000)
      if (!active) {
        report(8, 'Full solve after lockout expiry', false, 'p2 never returned to active after lockout')
      } else {
        techPos = await walkTo(tech, techPos, toXYZ(SCANNER_POSITIONS.technician))
        await sleep(150)
        eng.emit('arm-scanner')
        tech.emit('arm-scanner')
        over.emit('arm-scanner')
        const won = await pollUntil((s) => s.phase === 'win', ARM_WINDOW_MS + 2000)
        report(
          8,
          'Full solve (all 3 arm within window) -> phase win',
          won,
          `phase=${latestState.phase} p2.status=${latestState.puzzleState.p2.status}`,
        )
      }
    }
  } catch (err) {
    console.error('[probe] fatal error during run:', err)
    overallOk = false
  } finally {
    for (const s of [eng, tech, over]) {
      try {
        s?.close()
      } catch {
        /* ignore */
      }
    }
    server.kill('SIGTERM')
    await sleep(200)
    if (!server.killed) server.kill('SIGKILL')
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log(`Authority probe: ${results.filter((r) => r.pass).length}/${results.length} assertions passed`)
  console.log(overallOk ? 'RESULT: PASS' : 'RESULT: FAIL')
  process.exitCode = overallOk ? 0 : 1
}

main().catch((err) => {
  console.error('[probe] runner crashed:', err)
  process.exitCode = 1
})
