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

const SEED = 9

// Movement keys (usePlayerControls): W = -z, S = +z, A = -x, D = +x.
async function walkAxis(page, playerId, axis, target, tolerance = 1.2) {
  const axisIndex = axis === 'x' ? 0 : 2
  const readPos = () =>
    page.evaluate(
      ([id, idx]) => window.useGameStore.getState().players[id].position[idx],
      [playerId, axisIndex]
    )
  const current = await readPos()
  if (Math.abs(current - target) < tolerance) return
  const key = axis === 'x' ? (target > current ? 'KeyD' : 'KeyA') : target > current ? 'KeyS' : 'KeyW'
  await page.keyboard.down(key)
  await expect
    .poll(async () => Math.abs((await readPos()) - target), {
      timeout: 25_000,
      intervals: [100, 150],
    })
    .toBeLessThan(tolerance)
  await page.keyboard.up(key)
}

// The security partition is a solid pane on x=0 spanning z ∈ [-8, 8]. Crossing
// sectors means walking around its open end (the room's inner wall is at
// ±9.75), so a naive z-then-x walk would just press a character into glass.
const PARTITION_HALF_LENGTH = 8
const BYPASS_Z = 9.1

async function walkTo(page, playerId, [tx, tz]) {
  const startX = await page.evaluate(
    (id) => window.useGameStore.getState().players[id].position[0],
    playerId
  )
  const crossesPartition = Math.sign(startX) !== Math.sign(tx) && Math.abs(tx) > 0.01
  if (crossesPartition) {
    await walkAxis(page, playerId, 'z', BYPASS_Z)
    await walkAxis(page, playerId, 'x', tx)
  }
  await walkAxis(page, playerId, 'z', tz)
  await walkAxis(page, playerId, 'x', tx)
  // A diagonal target can leave the z-axis short after the x correction.
  await walkAxis(page, playerId, 'z', tz)
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

async function steerEmitterTo(page, target) {
  let guard = 0
  while ((await p3(page)).emitterStep !== target) {
    if (++guard > 60) throw new Error('emitter never reached its target step')
    await ensureActive(page)
    const cur = (await p3(page)).emitterStep
    await act(page, cur < target ? 'e' : 'q')
  }
}

// Mirror mounts wrap (mod MIRROR_STEPS), so turn whichever way is shorter.
function shortestDir(from, to) {
  const diff = (((to - from) % MIRROR_STEPS) + MIRROR_STEPS) % MIRROR_STEPS
  return diff <= MIRROR_STEPS / 2 ? 1 : -1
}

async function rotateMirrorTo(page, index, target, { holdBackLastStep = false } = {}) {
  let guard = 0
  for (;;) {
    const cur = (await p3(page)).mirrorSteps[index]
    if (cur === target) return null
    if (++guard > MIRROR_STEPS + 5) throw new Error(`mirror ${index} never reached its target`)
    const dir = shortestDir(cur, target)
    const nextStep = (((cur + dir) % MIRROR_STEPS) + MIRROR_STEPS) % MIRROR_STEPS
    if (holdBackLastStep && nextStep === target) return dir === 1 ? 'e' : 'q'
    await ensureActive(page)
    await act(page, dir === 1 ? 'e' : 'q')
  }
}

// Boot solo mode at a fixed seed and drive the chain through P1 and P2 so the
// laser array is live at stage 3. (puzzle1/puzzle2 specs own the fine-grained
// assertions for those stages.)
async function bootToStage3(page) {
  await page.goto(`/?seed=${SEED}`)
  await page.getByRole('button', { name: /Launch Offline Reactor/i }).click()
  await expect
    .poll(() => page.evaluate(() => window.useGameStore.getState().gamePhase))
    .toBe('playing')

  const cipher = await page.evaluate(() => window.useGameStore.getState().puzzleState.p1.cipher)
  await page.keyboard.press('2')
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
  await page.keyboard.press('2')
  await walkTo(page, 'player-2', scanners.technician)
  await page.keyboard.press('3')
  await walkTo(page, 'player-3', scanners.overseer)
  await page.keyboard.press('1')
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
    test.setTimeout(300_000)
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
    await page.keyboard.press('1')
    await walkTo(page, 'player-1', stations.EMITTER_POS)
    await steerEmitterTo(page, solution.emitterStep)
    expect((await p3(page)).emitterStep).toBe(solution.emitterStep)

    // --- TECHNICIAN: rotate each mirror. Hold back the very last step of the
    // last mirror that needs turning — completing the alignment now, with the
    // aperture still sealed, is a sensor overload by design.
    await page.keyboard.press('2')
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
    await page.keyboard.press('3')
    await walkTo(page, 'player-3', stations.RECEIVER_POS)
    await ensureActive(page)
    await act(page, 'e')
    const opened = await p3(page)
    expect(opened.apertureOpenedAt).not.toBeNull()

    // --- Swap back to the Technician (still standing at the last mirror) and
    // land the held-back step inside the latch.
    const swappedAt = Date.now()
    await page.keyboard.press('2')
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
    test.setTimeout(300_000)
    const problems = collectPageProblems(page)

    await bootToStage3(page)
    const { solution } = createLaserLayout(SEED)
    const live = await p3(page)
    const stations = await page.evaluate(() => window.__LASER_STATIONS__)

    // Align the beam completely WITHOUT the Overseer ever opening the aperture.
    await page.keyboard.press('1')
    await walkTo(page, 'player-1', stations.EMITTER_POS)
    await steerEmitterTo(page, solution.emitterStep)

    await page.keyboard.press('2')
    for (const i of [0, 1, 2]) {
      if (live.mirrorSteps[i] === solution.mirrorSteps[i]) continue
      await walkTo(page, 'player-2', live.layout.mirrors[i].pos)
      await rotateMirrorTo(page, i, solution.mirrorSteps[i])
    }

    // The beam now rests on a sealed receiver → sensor overload → lockout.
    await expect.poll(async () => (await p3(page)).status, { timeout: 15_000 }).toBe('lockout')
    const locked = await p3(page)
    expect(locked.solved).toBe(false)
    expect(locked.failCount).toBeGreaterThanOrEqual(1)
    expect(await page.evaluate(() => window.useGameStore.getState().gamePhase)).toBe('playing')

    // Input is rejected during the cooldown...
    const stepBefore = locked.emitterStep
    await page.keyboard.press('1')
    await act(page, 'e')
    expect((await p3(page)).emitterStep).toBe(stepBefore)

    // ...and the cooldown restores 'active' with the alignment work preserved.
    await ensureActive(page)
    const recovered = await p3(page)
    expect(recovered.emitterStep).toBe(solution.emitterStep)
    expect(recovered.mirrorSteps).toEqual(solution.mirrorSteps)

    expect(problems.physicsRescues).toEqual([])
    expect(problems.pageErrors).toEqual([])
    expect(problems.consoleErrors).toEqual([])
  })
})
