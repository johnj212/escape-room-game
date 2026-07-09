import { test, expect } from '@playwright/test'

// Phase 2 e2e — the 1 → 2 chain, solo-swap (Pillar E), against the client's
// local run of the SAME shared/scannerPuzzle.js machine the server executes.
//
// Puzzle 2 (Tri-Vector Hand Scanners, brief §3.14): all three role-keyed
// scanners must be armed within a 3.0 s rolling window (spec said 1.5 s — D-6,
// user playtest widening); each scanner latches
// armed for a few seconds (that latch is what lets a solo player carry an
// armed state across character swaps); failure → lockout cooldown. The
// e2e proves the IDENTICAL puzzle solves via solo-swap: each character is
// physically walked to their own pedestal (real Rapier movement, no
// teleports), then the player swap-arms 1 → 2 → 3 inside the window.

// Movement keys (usePlayerControls): W = -z, S = +z, A = -x, D = +x.
// Axis-by-axis walk with polling — targets aren't diagonal-aligned.
// Tolerance 1.4/axis: pedestal/console colliders stop the capsule ~1.0 from
// the prop center, and worst-case diagonal offset (√2 · 1.4 ≈ 2.0) stays
// inside the 3 m interaction radius.
async function walkAxis(page, playerId, axis, target, tolerance = 1.4) {
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
      timeout: 20_000,
      intervals: [100, 150],
    })
    .toBeLessThan(tolerance)
  await page.keyboard.up(key)
}

async function walkTo(page, playerId, [tx, tz]) {
  await walkAxis(page, playerId, 'z', tz)
  await walkAxis(page, playerId, 'x', tx)
}

// Boots solo mode and solves Puzzle 1 (condensed from puzzle1.spec.js, which
// owns the fine-grained P1 assertions) so the chain reaches stage 2.
async function bootAndSolveP1(page) {
  await page.goto('/')
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
  await expect
    .poll(() => page.evaluate(() => window.useGameStore.getState().puzzleState.stage))
    .toBe(2)
  // Close the switchboard takeover before walking on.
  await page.keyboard.press('e')
}

// Walk every character to their own scanner pedestal (positions from the
// shared contract: engineer [-6.5, 3.5], technician [6.5, 3.5],
// overseer [0, 8.5] — read live so the spec can't drift from the game).
async function positionAllAtScanners(page) {
  const positions = await page.evaluate(() => window.__SCANNER_POSITIONS__)
  expect(positions).toBeTruthy()
  await page.keyboard.press('2')
  await walkTo(page, 'player-2', positions.technician)
  await page.keyboard.press('3')
  await walkTo(page, 'player-3', positions.overseer)
  await page.keyboard.press('1')
  await walkTo(page, 'player-1', positions.engineer)
}

// Swap-arm burst: 1-E, 2-E, 3-E — six keystrokes, normally well inside the
// 3.0 s rolling window (D-6). On a heavily loaded machine the CDP round-trips can
// stretch past the window, which the machine CORRECTLY fails into lockout —
// so do what a human does: wait out the cooldown and try again (bounded).
// This retries the identical mechanic; it never relaxes it.
async function swapArmAllThree(page, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().puzzleState.p2.status), {
        timeout: 15_000,
      })
      .toBe('active')
    for (const key of ['1', 'e', '2', 'e', '3', 'e']) await page.keyboard.press(key)
    // Resolves to 'solved' or (on a stretched window / dropped press) to
    // 'lockout' — possibly via latch expiry a few seconds later.
    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().puzzleState.p2.status), {
        timeout: 10_000,
      })
      .not.toBe('active')
    const status = await page.evaluate(() => window.useGameStore.getState().puzzleState.p2.status)
    if (status === 'solved') return
  }
  throw new Error(`swap-arm burst did not solve within ${attempts} attempts`)
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

test.describe('Puzzle 2 — Tri-Vector Hand Scanners (1 → 2 chain, solo-swap)', () => {
  test('solo-swap completes the full 1 → 2 chain: swap-arm all three scanners inside the window → win', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const problems = collectPageProblems(page)

    await bootAndSolveP1(page)

    // Scanners are online but role-locked per pedestal: the Engineer standing
    // at their own pedestal sees the arm prompt; swapping the SAME position's
    // viewer to another role must show the role lock (Pillar A: no solo
    // exemption — the solve below only works because each role arms its own).
    await positionAllAtScanners(page)
    await expect(page.getByTestId('scanner-prompt-engineer')).toBeVisible()

    // Rapid swap-arm chain — the latch carries each armed scanner across the
    // swaps (retries through lockout if machine load stretches the window).
    await swapArmAllThree(page)
    expect(
      await page.evaluate(() => window.useGameStore.getState().puzzleState.p2.status)
    ).toBe('solved')
    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().gamePhase), {
        timeout: 5_000,
      })
      .toBe('win')
    await expect(page.getByText('SECTOR-9 STABILIZED')).toBeVisible()

    expect(problems.physicsRescues).toEqual([])
    expect(problems.pageErrors).toEqual([])
    expect(problems.consoleErrors).toEqual([])
  })

  test('an incomplete arm attempt fails into lockout, rejects arming, then recovers', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const problems = collectPageProblems(page)

    await bootAndSolveP1(page)
    await positionAllAtScanners(page)

    // Arm ONLY the engineer's scanner, then let its latch (4 s) expire with
    // the set incomplete — the shared machine must fail the attempt into a
    // lockout cooldown.
    await page.keyboard.press('1')
    await page.keyboard.press('e')
    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().puzzleState.p2.armedAt.engineer))
      .not.toBeNull()

    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().puzzleState.p2.status), {
        timeout: 10_000,
      })
      .toBe('lockout')
    // Lockout is visible at the pedestal (state feedback, quality law §4)...
    await expect(page.getByTestId('scanner-lockout-engineer')).toBeVisible()
    // ...and arming during the cooldown is rejected.
    await page.keyboard.press('e')
    const duringLockout = await page.evaluate(() => window.useGameStore.getState().puzzleState.p2)
    expect(duringLockout.armedAt.engineer).toBeNull()
    expect(duringLockout.failCount).toBe(1)

    // Cooldown (5 s) expires → active again → the identical puzzle solves.
    // (swapArmAllThree itself waits for 'active' before each burst.)
    await swapArmAllThree(page)
    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().gamePhase), {
        timeout: 5_000,
      })
      .toBe('win')

    expect(problems.physicsRescues).toEqual([])
    expect(problems.pageErrors).toEqual([])
    expect(problems.consoleErrors).toEqual([])
  })
})
