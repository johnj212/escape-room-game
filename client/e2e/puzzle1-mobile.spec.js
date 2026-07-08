import { test, expect } from '@playwright/test'

// Regression test for a reported mobile bug: tapping the on-screen "USE"
// button did nothing, while desktop Space/E opened the switchboard terminal
// fine. Root cause (client/src/components/UIOverlays.jsx +
// client/src/hooks/usePlayerControls.js): the USE button's touchstart/
// touchend handlers dispatched a 'mobile-interact' window CustomEvent that
// only fed usePlayerControls' inputRef.interact — a value nothing ever read.
// WirePuzzle.jsx (and ScannerStations.jsx) only listened for real 'keydown'
// events, so the mobile control had no wired action. Fixed by having both
// components also listen for 'mobile-interact' and act on its rising edge,
// mirroring the existing keydown handlers.
//
// Runs in the 'chromium' project (WebGPU launch flags), with a mobile
// UA/viewport/touch context override so UIOverlays.jsx's
// `/Mobi|Android/i.test(navigator.userAgent)` gate renders the mobile
// control layer. Landscape viewport avoids the CSS portrait-warning overlay
// (index.css `.portrait-warning`), which would otherwise cover the controls.

test.use({
  userAgent:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36',
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
})

test.describe('Mobile USE button — switchboard terminal (Puzzle 1)', () => {
  test('tapping the on-screen USE button opens the terminal like desktop Space/E', async ({ page }) => {
    const consoleErrors = []
    const pageErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => pageErrors.push(String(err)))

    await page.goto('/')

    const launchButton = page.getByRole('button', { name: /Launch Offline Reactor/i })
    await expect(launchButton).toBeVisible()
    await launchButton.click()

    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().gamePhase))
      .toBe('playing')

    // Mobile control layer must actually be live for this test to mean
    // anything — confirms the isMobile branch of UIOverlays.jsx rendered.
    const useButton = page.locator('.mobile-action-btn')
    await expect(useButton).toBeVisible()
    await expect(useButton).toHaveText('USE')

    // Swap into the Technician (holds the switchboard half of Puzzle 1) and
    // walk to the console. Movement itself is not the regression under test,
    // so it's driven the same way the desktop spec does (real keyboard input
    // still works under a mobile UA/viewport override).
    await page.keyboard.press('2')
    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().activePlayerId))
      .toBe('player-2')

    await page.keyboard.down('KeyD')
    await page.keyboard.down('KeyS')
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const p = window.useGameStore.getState().players['player-2'].position
            if (!p) return null
            const [x, , z] = p
            return Math.sqrt((x - 5) ** 2 + (z - 0) ** 2)
          }),
        { timeout: 15_000, intervals: [100, 200, 300] }
      )
      .toBeLessThan(2)
    await page.keyboard.up('KeyD')
    await page.keyboard.up('KeyS')

    // The regression: a real touch tap (touchstart/touchend — not a
    // synthetic click) on the USE button must open the terminal.
    await useButton.tap()
    await expect(page.getByText('REACTOR GRID TOGGLE')).toBeVisible()

    // And tapping again closes it, mirroring desktop's toggle behavior.
    await useButton.tap()
    await expect(page.getByText('REACTOR GRID TOGGLE')).toHaveCount(0)

    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })
})
