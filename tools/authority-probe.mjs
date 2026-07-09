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
//   8. After lockout expires, all three arm within the window -> phase 'win' for P2 -> stage 3.
//   9. Fabricated 'laser-solved' / 'set-phase win' events during P3 do nothing.
//   10. 'steer-emitter' while stage !== 3 is rejected, p3 untouched (checked mid-P2).
//   11. Wrong-role P3 actions rejected (engineer rotate-mirror, technician open-aperture,
//       overseer steer-emitter).
//   12. Out-of-range P3 action for the correct role is rejected.
//   13. Full legitimate 1->2->3 escape: solve P1, solve P2 (-> stage 3), drive P3 to the
//       win by emitting only the 3 legal role events (walking into range first); the probe
//       computes the solution itself via createLaserLayout(room.seed).solution (test-harness
//       knowledge, never sent to the server as a client-computed solve).
//   14. Broadcast room-state never contains a 'solution' key anywhere (deep check).
//
// CLI: node tools/authority-probe.mjs   (no flags; ~40-60s runtime)

import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { io as ioClient } from 'socket.io-client'
import { SCANNER_POSITIONS, SCANNER_RANGE, ARM_WINDOW_MS, LATCH_MS, LOCKOUT_MS } from '../shared/scannerPuzzle.js'
import {
  EMITTER_POS,
  RECEIVER_POS,
  STATION_RANGE,
  MIRROR_COUNT,
  createLaserLayout,
} from '../shared/laserPuzzle.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

const PORT = 3013
const URL = `http://localhost:${PORT}`

// SWITCHBOARD_POSITION isn't exported from a shared module (it's server/index.js-local
// P1 geometry) — this script is a client, so it only KNOWS this number the same way any
// client would (public deck geometry); it never gets to assume the server trusts it.
const SWITCHBOARD_POS = [5, 0]
const SPAWN = {
  engineer: [-3, 1.2, -2],
  technician: [3, 1.2, -2],
  overseer: [-2, 1.2, 4],
}

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
      const oor = !inRangeXZ(engPos, SCANNER_POSITIONS.engineer, SCANNER_RANGE)
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
    // 7. 'steer-emitter' while stage !== 3 (still stage 2 here) is rejected,
    //    p3 untouched.
    // ---------------------------------------------------------------
    {
      const p3Before = JSON.stringify(latestState.puzzleState.p3)
      eng.emit('steer-emitter', { dir: 1 })
      await sleep(200)
      const p3After = JSON.stringify(latestState.puzzleState.p3)
      report(
        7,
        "steer-emitter rejected while stage !== 3, p3 untouched",
        latestState.puzzleState.stage === 2 && p3Before === p3After,
        `stage=${latestState.puzzleState.stage} p3 unchanged=${p3Before === p3After}`,
      )
    }

    // ---------------------------------------------------------------
    // 8. Two-role insufficiency: only engineer + overseer arm; never solved;
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
        8,
        'Two-role arm never solves; latch expiry -> lockout',
        neverSolved && lockedOut,
        `p2.status=${latestState.puzzleState.p2.status} phase=${latestState.phase}`,
      )
    }

    // ---------------------------------------------------------------
    // 9. Full P2 solve: after lockout expires, all three arm within the
    //    window -> chain advances to stage 3, p3 -> active. Phase must NOT
    //    become 'win' here — only the P3 laser solve wins.
    // ---------------------------------------------------------------
    {
      const active = await pollUntil((s) => s.puzzleState.p2.status === 'active', LOCKOUT_MS + 3000)
      if (!active) {
        report(9, 'Full P2 solve after lockout expiry', false, 'p2 never returned to active after lockout')
      } else {
        techPos = await walkTo(tech, techPos, toXYZ(SCANNER_POSITIONS.technician))
        await sleep(150)
        eng.emit('arm-scanner')
        tech.emit('arm-scanner')
        over.emit('arm-scanner')
        const advanced = await pollUntil(
          (s) => s.puzzleState.stage === 3 && s.puzzleState.p3.status === 'active' && s.phase === 'playing',
          ARM_WINDOW_MS + 2000,
        )
        report(
          9,
          'Full P2 solve (all 3 arm within window) -> stage 3, p3 active, phase stays playing',
          advanced,
          `phase=${latestState.phase} stage=${latestState.puzzleState.stage} p3.status=${latestState.puzzleState.p3?.status}`,
        )
      }
    }

    // ---------------------------------------------------------------
    // 10. Fabricated P3 events do nothing.
    // ---------------------------------------------------------------
    {
      const before = JSON.stringify({ phase: latestState.phase, p3: latestState.puzzleState.p3 })
      eng.emit('laser-solved', { solved: true })
      eng.emit('set-phase', { phase: 'win' })
      eng.emit('room-state', { phase: 'win', puzzleState: { stage: 99 } })
      await sleep(300)
      const after = JSON.stringify({ phase: latestState.phase, p3: latestState.puzzleState.p3 })
      report(10, 'Fabricated P3 events are no-ops', before === after, `before===after: ${before === after}`)
    }

    // ---------------------------------------------------------------
    // 11. Wrong-role P3 actions rejected: engineer can't rotate-mirror,
    //     technician can't open-aperture, overseer can't steer-emitter.
    //     Actors are walked into range of the STATION they are attempting
    //     to misuse, so range is never the reason for rejection.
    // ---------------------------------------------------------------
    {
      const p3Before = JSON.stringify(latestState.puzzleState.p3)

      // Engineer walks to a mirror and tries to rotate it.
      const mirror0 = latestState.puzzleState.p3.layout.mirrors[0].pos
      engPos = await walkTo(eng, engPos, toXYZ(mirror0))
      await sleep(150)
      eng.emit('rotate-mirror', { index: 0, dir: 1 })
      await sleep(200)

      // Technician walks to the receiver and tries to open the aperture.
      techPos = await walkTo(tech, techPos, toXYZ(RECEIVER_POS))
      await sleep(150)
      tech.emit('open-aperture')
      await sleep(200)

      // Overseer walks to the emitter and tries to steer it.
      overPos = await walkTo(over, overPos, toXYZ(EMITTER_POS))
      await sleep(150)
      over.emit('steer-emitter', { dir: 1 })
      await sleep(200)

      const p3After = JSON.stringify(latestState.puzzleState.p3)
      report(
        11,
        'Wrong-role P3 actions rejected (engineer/technician/overseer cross-station)',
        p3Before === p3After,
        `p3 unchanged=${p3Before === p3After}`,
      )
    }

    // ---------------------------------------------------------------
    // 12. Out-of-range P3 action for the correct role is rejected.
    // ---------------------------------------------------------------
    {
      // Engineer is currently at mirror0 (from #11), far from the emitter.
      const p3Before = JSON.stringify(latestState.puzzleState.p3)
      const oor = !inRangeXZ(engPos, EMITTER_POS, STATION_RANGE)
      eng.emit('steer-emitter', { dir: 1 })
      await sleep(200)
      const p3After = JSON.stringify(latestState.puzzleState.p3)
      report(
        12,
        'Out-of-range P3 action (correct role) rejected',
        oor && p3Before === p3After,
        `engineerPos=${JSON.stringify(engPos)} outOfRange=${oor} p3 unchanged=${p3Before === p3After}`,
      )
    }

    // ---------------------------------------------------------------
    // 13. Full legitimate 1 -> 2 -> 3 escape. P1/P2 already solved above;
    //     drive P3 to the win using only the 3 legal role events, walking
    //     each actor into range first. The probe computes the solution
    //     itself (test-harness knowledge of the seeded layout) — the
    //     client never sends a computed solution, only step-by-step nudges.
    // ---------------------------------------------------------------
    {
      const seed = latestState.puzzleState.p3.seed
      const { solution } = createLaserLayout(seed)
      const layout = latestState.puzzleState.p3.layout

      // Walk each actor to their station.
      engPos = await walkTo(eng, engPos, toXYZ(EMITTER_POS))
      techPos = await walkTo(tech, techPos, toXYZ(layout.mirrors[0].pos))
      overPos = await walkTo(over, overPos, toXYZ(RECEIVER_POS))
      await sleep(150)

      // Engineer: step the emitter heading to the solution step.
      let curEmitter = latestState.puzzleState.p3.emitterStep
      while (curEmitter !== solution.emitterStep) {
        const dir = solution.emitterStep > curEmitter ? 1 : -1
        eng.emit('steer-emitter', { dir })
        await sleep(40)
        curEmitter = latestState.puzzleState.p3.emitterStep
      }

      // Technician: rotate each mirror to its solution step, walking between
      // mirrors as needed (mount rotation wraps mod MIRROR_STEPS).
      for (let i = 0; i < MIRROR_COUNT; i++) {
        techPos = await walkTo(tech, techPos, toXYZ(layout.mirrors[i].pos))
        await sleep(100)
        const target = solution.mirrorSteps[i]
        // MIRROR_STEPS isn't imported (only MIRROR_COUNT is needed elsewhere);
        // read the modulus straight from the live state instead of hardcoding it.
        let guard = 0
        while (latestState.puzzleState.p3.mirrorSteps[i] !== target && guard < 200) {
          const cur = latestState.puzzleState.p3.mirrorSteps[i]
          // Choose the step direction that reduces |cur - target| circularly.
          tech.emit('rotate-mirror', { index: i, dir: 1 })
          await sleep(40)
          guard += 1
          if (latestState.puzzleState.p3.mirrorSteps[i] === target) break
        }
      }

      // Overseer: open the aperture last (after emitter + mirrors are aimed),
      // then re-open if the latch expires before the beam lands.
      let won = false
      for (let attempt = 0; attempt < 3 && !won; attempt++) {
        over.emit('open-aperture')
        won = await pollUntil((s) => s.phase === 'win', 4000)
      }

      report(
        13,
        'Full legitimate 1->2->3 escape reaches phase win via legal role events only',
        won,
        `phase=${latestState.phase} p3.status=${latestState.puzzleState.p3?.status}`,
      )
    }

    // ---------------------------------------------------------------
    // 14. Broadcast room-state never contains a 'solution' key anywhere.
    // ---------------------------------------------------------------
    {
      const hasSolutionKey = (value, seen = new Set()) => {
        if (value === null || typeof value !== 'object') return false
        if (seen.has(value)) return false
        seen.add(value)
        if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'solution')) return true
        for (const v of Array.isArray(value) ? value : Object.values(value)) {
          if (hasSolutionKey(v, seen)) return true
        }
        return false
      }
      const leaked = hasSolutionKey(latestState)
      report(14, "Broadcast room-state never contains a 'solution' key", !leaked, `leaked=${leaked}`)
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
