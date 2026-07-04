import { test, expect } from '@playwright/test'

// Sector-9 Command Deck — Phase 0 e2e harness.
//
// IMPORTANT CONTEXT (read before editing): the Project_Requirements.md / STATUS.md
// end-state for this game is a WebGPU-only renderer with no WebGL fallback. That
// renderer rewrite is Phase 1 and has NOT happened yet — as of this suite, the app
// (client/src/components/GameCanvas.jsx) still boots a stock React Three Fiber v8
// <Canvas>, which creates a WebGLRenderer. There is no capability gate / designed
// "unsupported" screen yet either (that is also explicitly listed as Phase 0
// remainder work in STATUS.md).
//
// So this suite does two separate things and does not conflate them:
//   1. Proves the *harness* can get a real WebGPU adapter in the Playwright-
//      controlled browser (playwright.config.js launch flags), so Phase 1 can
//      build on this immediately without re-deriving the flag investigation.
//   2. Exercises the *actual current app* (WebGL) end-to-end: boot, canvas/GL
//      context live, zero console errors, and a full solo-swap solve of Puzzle 1.
//
// When Phase 1 lands the WebGPURenderer, the "app boot" test's WebGL-context
// assertion must be swapped for a WebGPU-adapter-on-the-app-canvas assertion,
// and a capability-gate test (forced non-WebGPU -> unsupported screen, zero
// console exceptions) must be added. Tracked in STATUS.md, not here.

test.describe('WebGPU harness capability (forward-looking, Phase 1 prep)', () => {
  test('Playwright-controlled Chromium acquires a real, non-null WebGPU adapter', async ({ page }) => {
    // Deliberately navigated to the real app origin (not about:blank): WebGPU is
    // only exposed on a secure context, and about:blank has an opaque origin.
    await page.goto('/')

    const gpuProbe = await page.evaluate(async () => {
      if (!('gpu' in navigator)) return { hasGpu: false }
      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) return { hasGpu: true, adapter: null }
      return {
        hasGpu: true,
        adapter: true,
        features: Array.from(adapter.features || []),
      }
    })

    expect(gpuProbe.hasGpu).toBe(true)
    expect(gpuProbe.adapter).toBe(true)
    // Hardware (Metal) backing, not a stub/software fallback: real Metal-backed
    // adapters on this machine report tier-1/2 texture format support and f16
    // shaders; a software (SwiftShader) fallback would not.
    expect(gpuProbe.features).toEqual(expect.arrayContaining(['shader-f16']))
  })
})

test.describe('App boot + solo-swap solve of Puzzle 1 (Decoupled Power Grid)', () => {
  test('boots without errors, mounts a live render context, and solves P1 via character-swap', async ({ page }) => {
    const consoleErrors = []
    const pageErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => pageErrors.push(String(err)))

    await page.goto('/')

    // 1. Lobby renders (no "unsupported" screen, no crash).
    await expect(page.getByText('Sector-9 Command Deck')).toBeVisible()
    // Solo mode is the default game-store state; assert the offline launch
    // affordance STATUS.md's "solo-swap solve of Puzzle 1" flow depends on.
    const launchButton = page.getByRole('button', { name: /Launch Offline Reactor/i })
    await expect(launchButton).toBeVisible()
    await launchButton.click()

    // 2. Game canvas mounts and has a genuinely live render context.
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
    const contextInfo = await page.evaluate(() => {
      const el = document.querySelector('canvas')
      if (!el) return { found: false }
      // R3F v8 / three.js WebGLRenderer creates a 'webgl2' context. Re-requesting
      // the same context type on an already-initialized canvas returns the
      // existing live context per spec (it does not create a new one).
      const gl = el.getContext('webgl2') || el.getContext('webgl')
      if (!gl) return { found: true, live: false }
      return {
        found: true,
        live: true,
        drawingBufferWidth: gl.drawingBufferWidth,
        drawingBufferHeight: gl.drawingBufferHeight,
      }
    })
    expect(contextInfo.found).toBe(true)
    expect(contextInfo.live).toBe(true)
    expect(contextInfo.drawingBufferWidth).toBeGreaterThan(0)
    expect(contextInfo.drawingBufferHeight).toBeGreaterThan(0)

    // Confirm the store actually transitioned into the playing phase (server-free
    // in solo mode: useMultiplayer disconnects the socket entirely when isSolo).
    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().gamePhase))
      .toBe('playing')

    // 3. Read the cipher the Engineer's hologram displays (Puzzle 1's
    // "information" half) directly from authoritative client state - this is a
    // read-only assertion of what the hologram shows, not a solve shortcut.
    const cipher = await page.evaluate(() => window.useGameStore.getState().puzzleState.cipher)
    expect(Array.isArray(cipher)).toBe(true)
    expect(cipher.length).toBeGreaterThan(0)

    // 4. Character-swap (key "2") into the Technician, who holds the "action"
    // half of the puzzle (the switchboard). This is the co-op-in-one-body
    // mechanic Pillar E requires for solo play.
    await page.keyboard.press('2')
    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().activePlayerId))
      .toBe('player-2')

    // 5. Walk the Technician to the switchboard at world position [5, y, 0] by
    // holding real keyboard input (D = +x, S = +z) - actual physics-driven
    // movement via Rapier, not a teleport.
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

    // 6. Open the switchboard terminal (Space/E) now that the Technician is in
    // proximity, and toggle exactly the cipher's colors.
    await page.keyboard.press('e')
    await expect(page.getByText('REACTOR GRID TOGGLE')).toBeVisible()

    for (const color of cipher) {
      await page.locator('.puzzle-wire-card', { hasText: new RegExp(`^${color}$`, 'i') }).click()
    }

    // 7. Server-free solo validation (gameStore.toggleSwitch) flips the game to
    // 'win' ~1s after the correct combination is set. Assert the real win screen.
    await expect(page.getByText('GRID SYNCHRONIZED')).toBeVisible({ timeout: 5_000 })
    await expect
      .poll(() => page.evaluate(() => window.useGameStore.getState().gamePhase))
      .toBe('win')

    // 8. Zero console exceptions across the entire flow (Pillar E rule).
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })
})
