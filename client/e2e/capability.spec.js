import { test, expect } from '@playwright/test'

// Capability-gate test (verification battery #6, Pillar E rule): a forced
// non-WebGPU context must render the DESIGNED unsupported screen with zero
// console exceptions — never a crash, never a blank page, and never a WebGL
// fallback canvas.
//
// This spec runs ONLY in the `chromium-no-webgpu` Playwright project (see
// playwright.config.js): headless Chromium launched WITHOUT the WebGPU flags
// exposes `navigator.gpu` but resolves `requestAdapter()` to null (verified
// empirically — docs/R3F-WEBGPU-NOTES.md 2026-07-04). That is a REAL
// no-adapter environment, the same shape as a blocklisted GPU or a
// Vulkan-less Android device — not a query-param simulation.

test.describe('Capability gate — forced non-WebGPU context', () => {
  test('renders the designed unsupported screen with zero console exceptions', async ({ page }) => {
    const consoleErrors = []
    const pageErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => pageErrors.push(String(err)))

    await page.goto('/')

    // 1. The designed unsupported screen renders — not a blank page.
    const screen = page.getByTestId('unsupported-screen')
    await expect(screen).toBeVisible()
    await expect(page.getByText('RENDER CORE INCOMPATIBLE')).toBeVisible()
    // Honest diagnostics + a concrete path to a supported device.
    await expect(page.getByText(/DIAG :: /)).toBeVisible()
    await expect(page.getByText(/Supported deployment targets/i)).toBeVisible()

    // 2. The gate's routing decision is exposed and correct.
    const capability = await page.evaluate(() => window.__CAPABILITY__)
    expect(capability.supported).toBe(false)
    // Headless-no-flags yields 'no-adapter' today; the other codes are
    // legitimate unsupported routes should the environment shape change.
    expect(['no-adapter', 'no-navigator-gpu', 'adapter-timeout', 'adapter-error']).toContain(
      capability.reason
    )
    // §2 floor: detected and routed in < 500 ms.
    expect(capability.durationMs).toBeLessThan(500)

    // 3. The game never mounts behind the screen: no canvas exists at all
    //    (a WebGL fallback canvas here would be a banned outcome).
    expect(await page.locator('canvas').count()).toBe(0)
    // The lobby must not be reachable either.
    await expect(page.getByText('Launch Offline Reactor', { exact: false })).toHaveCount(0)

    // 4. Zero console exceptions (Pillar E). Diagnostics go out as a
    //    console.warn, which is allowed — errors and pageerrors are not.
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })
})
