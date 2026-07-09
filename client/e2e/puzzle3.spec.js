import { test, expect } from '@playwright/test'
import {
  createLaserLayout,
  MIRROR_STEPS,
  RECEIVER_HOLD_MS,
} from '../../shared/laserPuzzle.js'

// Phase 3 e2e — the full 1 → 2 → 3 escape, solo-swap (Pillar E), against the
// client's local run of the SAME shared/laserPuzzle.js machine the server
// executes.
//
// Puzzle 3 (Laser Deflection Array, brief §3.15) needs all three roles:
// the Engineer steers the emitter heading, the Technician rotates the three
// mirror mounts, the Overseer opens the receiver aperture (which latches open
// for RECEIVER_HOLD_MS — the latch is what lets a solo player carry the
// Overseer's action across character swaps). An aligned beam resting on a
// SHUT aperture is a sensor overload → lockout.
//
// The spec computes the solution itself from the seeded layout. That is the
// TEST HARNESS knowing the answer, not the client being told it: the run below
// only ever emits the three legal role actions, and `puzzleState.p3` never
// carries a solution (asserted).

// Seed 9 scatters mirrors on BOTH sides of the security partition, so the full
// escape below also exercises a sector crossing. Seed 132 keeps all three
// mirror mounts on the Technician's side — the lockout test cares about the
// misfire, not about pathfinding, so it takes the shorter walk.
const SEED = 9
const SEED_ONE_SECTOR = 351

// Movement keys (usePlayerControls): W = -z, S = +z, A = -x, D = +x.
//
// The deck is a cluttered room: two P1 consoles, three P2 pedestals, three
// SEEDED mirror mounts, and a security partition down x=0. All have colliders.
// An axis-by-axis walk (fine in puzzle1/puzzle2, whose targets sit on clear
// lines) gets pinned against a prop and never converges here. This walker steps
// greedily instead: every ~320 ms it picks whichever of the four movement keys
// most reduces distance to the goal without steering into a collider. It is a
// test harness routing a character around furniture — it never touches the
// puzzle's rules.
const IN_RANGE = 2.2 // comfortably inside STATION_RANGE (3 m), with drift margin
// The movement key stays HELD and only changes when the chosen direction does.
// Press/release stepping let the hover droid decelerate between every step and
// spent the walk in CDP round-trips — fine on an idle box, timing out inside a
// full suite on a loaded one.
const POLL_MS = 140
const PROBE = 0.8 // how far ahead a step is checked for clearance
const CAPSULE = 0.35 // player capsule radius + a little slack
const PROP_RADIUS = 0.4 // consoles, pedestals, mirror mounts
const PLAYER_RADIUS = 0.35 // an idle teammate is a solid capsule
const REACTOR = { pos: [0, -9], r: 1.9 }
// The inner wall is at 9.75 and a capsule can rest at ~9.45. Keep this bound
// OUTSIDE what the character can actually reach: if it sits beyond the bound,
// every probe scores as 'into the wall' and the walker deadlocks in a corner.
const WALL = 9.6
const PARTITION_END = 6.7 // the pane spans z ∈ [-6, 6] on x = 0 (Room.jsx)
const PARTITION_CLEAR = 0.5 // pane is 0.2 thick; clear it by a capsule

const KEYS = {
  KeyD: [1, 0],
  KeyA: [-1, 0],
  KeyS: [0, 1],
  KeyW: [0, -1],
}

const readXZ = (page, playerId) =>
  page.evaluate((id) => {
    const p = window.useGameStore.getState().players[id].position
    return [p[0], p[2]]
  }, playerId)

async function distTo(page, playerId, [tx, tz]) {
  const [x, z] = await readXZ(page, playerId)
  return Math.hypot(x - tx, z - tz)
}

// `1`/`2`/`3` swap the acting character. A swap that silently fails is the
// worst kind of e2e bug: the walker then drives the WRONG character around the
// deck while polling the position of one that never moves. Always confirm.
const SWAP_KEY = { 'player-1': '1', 'player-2': '2', 'player-3': '3' }

async function swapTo(page, playerId) {
  await page.keyboard.press(SWAP_KEY[playerId])
  await expect
    .poll(() => page.evaluate(() => window.useGameStore.getState().activePlayerId), {
      timeout: 5_000,
    })
    .toBe(playerId)
}

// Every collider a character can wedge against, read live from the game so the
// spec can never drift from the layout it is walking through. Radii matter:
// the overseer's pedestal sits at [0, 8.5], right in the partition's only gap,
// so an over-generous keep-out radius seals the deck's one crossing point.
// The OTHER two characters are solid capsules and are obstacles too — an idle
// teammate parked in the doorway will stop the one you are driving.
async function obstacles(page, playerId) {
  const { props, others } = await page.evaluate((id) => {
    const g = window.useGameStore.getState()
    const scanners = Object.values(window.__SCANNER_POSITIONS__)
    const mirrors = g.puzzleState.p3.layout.mirrors.map((m) => m.pos)
    return {
      props: [[-5, 0], [5, 0], ...scanners, ...mirrors],
      others: Object.values(g.players)
        .filter((p) => p.id !== id)
        .map((p) => [p.position[0], p.position[2]]),
    }
  }, playerId)
  return [
    ...props.map((pos) => ({ pos, r: PROP_RADIUS })),
    ...others.map((pos) => ({ pos, r: PLAYER_RADIUS })),
    { pos: REACTOR.pos, r: REACTOR.r },
  ]
}

// A candidate point is blocked by a prop, a wall, or the partition pane.
// Obstacles at the goal are ignored: the goal IS a prop, and the character has
// to be allowed to walk up to it.
function blocked([x, z], obs, goal) {
  if (Math.abs(x) > WALL || Math.abs(z) > WALL) return true
  if (Math.abs(x) < PARTITION_CLEAR && Math.abs(z) < PARTITION_END) return true
  return obs.some(({ pos: [ox, oz], r }) => {
    if (Math.hypot(ox - goal[0], oz - goal[1]) < 1.0) return false // the goal itself
    return Math.hypot(x - ox, z - oz) < r + CAPSULE
  })
}

async function greedyWalk(page, playerId, goal, tolerance) {
  const active = await page.evaluate(() => window.useGameStore.getState().activePlayerId)
  expect(active, 'walking a character that is not the active one').toBe(playerId)
  const obs = await obstacles(page, playerId)
  const deadline = Date.now() + 120_000
  let lastDist = Infinity
  let stalls = 0
  let held = null

  const hold = async (key) => {
    if (held === key) return
    if (held) await page.keyboard.up(held)
    held = key
    if (key) await page.keyboard.down(key)
  }

  try {
    for (;;) {
    const pos = await readXZ(page, playerId)
    const dist = Math.hypot(pos[0] - goal[0], pos[1] - goal[1])
    if (dist < tolerance) return

    if (Date.now() > deadline) {
      const ctx = await page.evaluate(() => {
        const g = window.useGameStore.getState()
        return {
          active: g.activePlayerId,
          players: Object.fromEntries(
            Object.entries(g.players).map(([k, v]) => [k, [+v.position[0].toFixed(2), +v.position[2].toFixed(2)]])
          ),
          mirrors: g.puzzleState.p3.layout.mirrors.map((m) => m.pos.map((n) => +n.toFixed(2))),
        }
      })
      throw new Error(
        `${playerId}: could not reach [${goal}] — stopped at [${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}], dist ${dist.toFixed(2)}\n` +
          `  active=${ctx.active} players=${JSON.stringify(ctx.players)} mirrors=${JSON.stringify(ctx.mirrors)}`
      )
    }

    stalls = dist > lastDist - 0.05 ? stalls + 1 : 0
    lastDist = dist

    let best = null
    for (const [key, [dx, dz]] of Object.entries(KEYS)) {
      const probe = [pos[0] + dx * PROBE, pos[1] + dz * PROBE]
      if (blocked(probe, obs, goal)) continue
      const score = Math.hypot(probe[0] - goal[0], probe[1] - goal[1])
      // Once we stop improving, favour a lateral move: perpendicular motion is
      // what slides a capsule off the face of a prop it is pressed against.
      const lateral = stalls > 6 && Math.abs(score - dist) < 0.35 ? -0.4 : 0
      if (!best || score + lateral < best.score) best = { key, score: score + lateral }
    }

    if (!best) {
      // Wedged with every probe rejected. Back toward the middle of the room:
      // it is always legal ground, and it unsticks both a corner and a prop
      // face. Prefer the axis we are furthest out on.
      const key =
        Math.abs(pos[1]) > Math.abs(pos[0])
          ? pos[1] > 0
            ? 'KeyW'
            : 'KeyS'
          : pos[0] > 0
            ? 'KeyA'
            : 'KeyD'
      best = { key }
    }

    await hold(best.key)
    await page.waitForTimeout(POLL_MS)
    }
  } finally {
    await hold(null) // never leave a movement key stuck down
  }
}

// Greedy descent cannot cross the security partition: rounding its open end
// means walking AWAY from the goal first, which no distance-reducing step will
// ever choose. Sector changes therefore get explicit waypoints.
// z=7.4 sits in the doorway past the partition's +z end, clear of both the
// pane (ends at z=6) and the overseer pedestal at [0, 8.5].
const BYPASS = { z: 7.4, x: 2.2 }

async function walkTo(page, playerId, goal) {
  const [startX] = await readXZ(page, playerId)
  const side = (v) => (v > PARTITION_CLEAR ? 1 : v < -PARTITION_CLEAR ? -1 : 0)
  const from = side(startX)
  const to = side(goal[0])

  if (from !== 0 && to !== 0 && from !== to) {
    await greedyWalk(page, playerId, [from * BYPASS.x, BYPASS.z], 1.0)
    await greedyWalk(page, playerId, [to * BYPASS.x, BYPASS.z], 1.0)
  }
  await greedyWalk(page, playerId, goal, IN_RANGE)
}

const p3 = (page) => page.evaluate(() => window.useGameStore.getState().puzzleState.p3)

// Wait out a misfire lockout. Sweeping a mirror can transiently rest the beam
// on the still-sealed receiver, which the machine CORRECTLY punishes — the
// alignment survives the cooldown, so we simply wait and continue. This never
// relaxes the mechanic.
async function ensureActive(page) {
  await expect
    .poll(async () => (await p3(page)).status, { timeout: 20_000, intervals: [200, 300] })
    .toBe('active')
}

// One role action = one keypress. LaserArray throttles input at 90 ms.
async function act(page, key) {
  await page.keyboard.press(key)
  await page.waitForTimeout(120)
}

// A press landing during a misfire lockout is REJECTED — that is the mechanic,
// not a flake. So bound these drivers by wall-clock and by consecutive
// no-progress attempts, never by a raw press count: a run that waits out three
// cooldowns is still making progress, one step at a time.
const NO_PROGRESS_LIMIT = 8

async function steerEmitterTo(page, target) {
  const deadline = Date.now() + 120_000
  let stuck = 0
  for (;;) {
    const cur = (await p3(page)).emitterStep
    if (cur === target) return
    if (Date.now() > deadline || stuck > NO_PROGRESS_LIMIT) {
      throw new Error(`emitter stuck at step ${cur}, target ${target}`)
    }
    await ensureActive(page)
    await act(page, cur < target ? 'e' : 'q')
    stuck = (await p3(page)).emitterStep === cur ? stuck + 1 : 0
  }
}

// Mirror mounts wrap (mod MIRROR_STEPS), so turn whichever way is shorter.
function shortestDir(from, to) {
  const diff = (((to - from) % MIRROR_STEPS) + MIRROR_STEPS) % MIRROR_STEPS
  return diff <= MIRROR_STEPS / 2 ? 1 : -1
}

async function rotateMirrorTo(
  page,
  index,
  target,
  { holdBackLastStep = false, stopOnLockout = false } = {}
) {
  const deadline = Date.now() + 150_000
  let stuck = 0
  for (;;) {
    const state = await p3(page)
    // The beam can land on the sealed receiver BEFORE the last mirror reaches
    // its target — the solution config is not the only one that hits. When the
    // caller is hunting the misfire, that lockout is the result, not a failure.
    if (stopOnLockout && state.status === 'lockout') return 'lockout'
    const cur = state.mirrorSteps[index]
    if (cur === target) return null
    if (Date.now() > deadline || stuck > NO_PROGRESS_LIMIT) {
      throw new Error(`mirror ${index} stuck at step ${cur}, target ${target}`)
    }
    const dir = shortestDir(cur, target)
    const nextStep = (((cur + dir) % MIRROR_STEPS) + MIRROR_STEPS) % MIRROR_STEPS
    if (holdBackLastStep && nextStep === target) return dir === 1 ? 'e' : 'q'
    await ensureActive(page)
    await act(page, dir === 1 ? 'e' : 'q')
    stuck = (await p3(page)).mirrorSteps[index] === cur ? stuck + 1 : 0
  }
}

// Boot solo mode at a fixed seed and drive the chain through P1 and P2 so the
// laser array is live at stage 3. (puzzle1/puzzle2 specs own the fine-grained
// assertions for those stages.)
async function bootToStage3(page, seed = SEED) {
  await page.goto(`/?seed=${seed}`)
  await page.getByRole('button', { name: /Launch Offline Reactor/i }).click()
  await expect
    .poll(() => page.evaluate(() => window.useGameStore.getState().gamePhase))
    .toBe('playing')

  const cipher = await page.evaluate(() => window.useGameStore.getState().puzzleState.p1.cipher)
  await swapTo(page, 'player-2')
  await walkTo(page, 'player-2', [5, 0])
  await page.keyboard.press('e')
  await expect(page.getByText('REACTOR GRID TOGGLE')).toBeVisible()
  for (const color of cipher) {
    await page.locator('.puzzle-wire-card', { hasText: new RegExp(`^${color}$`, 'i') }).click()
  }
  await expect.poll(() => page.evaluate(() => window.useGameStore.getState().puzzleState.stage)).toBe(2)
  await page.keyboard.press('e') // close the switchboard takeover

  // P2: walk each character to their own pedestal, then swap-arm inside the window.
  const scanners = await page.evaluate(() => window.__SCANNER_POSITIONS__)
  await swapTo(page, 'player-2')
  await walkTo(page, 'player-2', scanners.technician)
  await swapTo(page, 'player-3')
  await walkTo(page, 'player-3', scanners.overseer)
  await swapTo(page, 'player-1')
  await walkTo(page, 'player-1', scanners.engineer)

  for (let attempt = 0; attempt < 4; attempt++) {
    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().puzzleState.p2.status), {
        timeout: 15_000,
      })
      .toBe('active')
    for (const key of ['1', 'e', '2', 'e', '3', 'e']) await page.keyboard.press(key)
    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().puzzleState.p2.status), {
        timeout: 10_000,
      })
      .not.toBe('active')
    if ((await page.evaluate(() => window.useGameStore.getState().puzzleState.p2.status)) === 'solved') break
  }

  await expect.poll(() => page.evaluate(() => window.useGameStore.getState().puzzleState.stage)).toBe(3)
}

function collectPageProblems(page) {
  const problems = { consoleErrors: [], pageErrors: [], physicsRescues: [] }
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.consoleErrors.push(msg.text())
    if (/fell through floor/i.test(msg.text())) problems.physicsRescues.push(msg.text())
  })
  page.on('pageerror', (err) => problems.pageErrors.push(String(err)))
  return problems
}

test.describe('Puzzle 3 — Laser Deflection Array (full 1 → 2 → 3 escape, solo-swap)', () => {
  test('solo-swap completes the full escape: all three roles act, the beam lands, phase → win', async ({
    page,
  }) => {
    test.setTimeout(480_000)
    const problems = collectPageProblems(page)

    await bootToStage3(page)

    // The array is live and the client holds the layout — but never the answer.
    const live = await p3(page)
    expect(live.status).toBe('active')
    expect(live.seed).toBe(SEED)
    expect(JSON.stringify(live)).not.toContain('solution')

    // The harness derives the solution from the same seeded generator the
    // server uses. The RUN below only ever emits legal role actions.
    const { solution } = createLaserLayout(SEED)
    const stations = await page.evaluate(() => window.__LASER_STATIONS__)

    // --- ENGINEER: steer the emitter. Safe to do first — with the mirrors at
    // their initial angles, NO heading can reach the receiver (Pillar A), so
    // the beam cannot misfire onto the sealed aperture here.
    await swapTo(page, 'player-1')
    await walkTo(page, 'player-1', stations.EMITTER_POS)
    await steerEmitterTo(page, solution.emitterStep)
    expect((await p3(page)).emitterStep).toBe(solution.emitterStep)

    // --- TECHNICIAN: rotate each mirror. Hold back the very last step of the
    // last mirror that needs turning — completing the alignment now, with the
    // aperture still sealed, is a sensor overload by design.
    await swapTo(page, 'player-2')
    const mirrors = live.layout.mirrors
    const pending = [0, 1, 2].filter((i) => live.mirrorSteps[i] !== solution.mirrorSteps[i])
    expect(pending.length).toBeGreaterThan(0) // else there is no final step to hold back

    let finalKey = null
    for (const i of pending) {
      await walkTo(page, 'player-2', mirrors[i].pos)
      const isLast = i === pending[pending.length - 1]
      finalKey = await rotateMirrorTo(page, i, solution.mirrorSteps[i], { holdBackLastStep: isLast })
    }
    expect(finalKey).not.toBeNull()

    // Two roles have acted and the puzzle is NOT solved — the Overseer is
    // still required (Pillar A, live and in the browser).
    expect((await p3(page)).solved).toBe(false)
    expect(await page.evaluate(() => window.useGameStore.getState().gamePhase)).toBe('playing')

    // --- OVERSEER: open the receiver aperture. It latches for RECEIVER_HOLD_MS,
    // which is exactly what lets the solo player swap back to the Technician.
    await swapTo(page, 'player-3')
    await walkTo(page, 'player-3', stations.RECEIVER_POS)
    await ensureActive(page)
    await act(page, 'e')
    const opened = await p3(page)
    expect(opened.apertureOpenedAt).not.toBeNull()

    // --- Swap back to the Technician (still standing at the last mirror) and
    // land the held-back step inside the latch.
    const swappedAt = Date.now()
    await swapTo(page, 'player-2')
    await act(page, finalKey)
    expect(Date.now() - swappedAt).toBeLessThan(RECEIVER_HOLD_MS)

    await expect.poll(async () => (await p3(page)).status, { timeout: 10_000 }).toBe('solved')
    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().gamePhase), { timeout: 5_000 })
      .toBe('win')

    expect(problems.physicsRescues).toEqual([])
    expect(problems.pageErrors).toEqual([])
    expect(problems.consoleErrors).toEqual([])
  })

  test('an aligned beam on a sealed aperture misfires into lockout, rejects input, then recovers', async ({
    page,
  }) => {
    test.setTimeout(480_000)
    const problems = collectPageProblems(page)

    await bootToStage3(page, SEED_ONE_SECTOR)
    const { solution } = createLaserLayout(SEED_ONE_SECTOR)
    const live = await p3(page)
    expect(live.seed).toBe(SEED_ONE_SECTOR)
    const stations = await page.evaluate(() => window.__LASER_STATIONS__)

    // Align the beam completely WITHOUT the Overseer ever opening the aperture.
    await swapTo(page, 'player-1')
    await walkTo(page, 'player-1', stations.EMITTER_POS)
    await steerEmitterTo(page, solution.emitterStep)

    // Visit the mirrors on the Technician's own side of the partition first:
    // every sector change is a long walk around its open end, and the fewer of
    // them this run makes, the less of its budget goes into pathfinding.
    await swapTo(page, 'player-2')
    const [techX] = await readXZ(page, 'player-2')
    const order = [0, 1, 2]
      .filter((i) => live.mirrorSteps[i] !== solution.mirrorSteps[i])
      .sort((a, b) => {
        const near = (i) => (Math.sign(live.layout.mirrors[i].pos[0]) === Math.sign(techX) ? 0 : 1)
        return near(a) - near(b)
      })
    // Rotate toward the solution until the beam lands on the sealed receiver.
    // It may do so a step or two before the exact solution config — many mirror
    // combinations hit the disc at the solution heading — and that misfire is
    // precisely what this test is after, so stop as soon as it trips.
    for (const i of order) {
      if ((await p3(page)).status === 'lockout') break
      await walkTo(page, 'player-2', live.layout.mirrors[i].pos)
      const outcome = await rotateMirrorTo(page, i, solution.mirrorSteps[i], {
        stopOnLockout: true,
      })
      if (outcome === 'lockout') break
    }

    // The beam rests on a sealed receiver → sensor overload → lockout.
    await expect.poll(async () => (await p3(page)).status, { timeout: 15_000 }).toBe('lockout')
    const locked = await p3(page)
    expect(locked.solved).toBe(false)
    expect(locked.failCount).toBeGreaterThanOrEqual(1)
    expect(await page.evaluate(() => window.useGameStore.getState().gamePhase)).toBe('playing')

    // Input is rejected during the cooldown...
    const stepBefore = locked.emitterStep
    await swapTo(page, 'player-1')
    await act(page, 'e')
    expect((await p3(page)).emitterStep).toBe(stepBefore)

    // ...and the cooldown restores 'active' with the alignment work preserved.
    // The penalty is meltdown-clock time, never the Engineer's and Technician's
    // work: whatever they had dialled in survives the lockout untouched.
    await ensureActive(page)
    const recovered = await p3(page)
    expect(recovered.emitterStep).toBe(locked.emitterStep)
    expect(recovered.mirrorSteps).toEqual(locked.mirrorSteps)
    expect(recovered.emitterStep).toBe(solution.emitterStep) // the Engineer's steer stands
    expect(recovered.apertureOpenedAt).toBeNull() // but the aperture was sealed

    expect(problems.physicsRescues).toEqual([])
    expect(problems.pageErrors).toEqual([])
    expect(problems.consoleErrors).toEqual([])
  })
})
