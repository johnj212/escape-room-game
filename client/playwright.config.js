import { defineConfig, devices } from '@playwright/test'

// Sector-9 Command Deck — Playwright e2e harness (Phase 0)
//
// WEBGPU FLAG NOTE (verified empirically this session — see docs/R3F-WEBGPU-NOTES.md):
// Playwright's default headless Chromium exposes `navigator.gpu` but
// `requestAdapter()` resolves to `null` with zero launch args. Passing
// `--enable-unsafe-webgpu --use-angle=metal` makes headless Chromium return a
// real, hardware-backed (Metal) adapter on this macOS/Apple-Silicon machine,
// with the exact same feature set as a headed run. Both flags are kept:
// `--use-angle=metal` alone was also observed to work on this Chrome version,
// but `--enable-unsafe-webgpu` is the documented/stable way to request it
// across Chrome versions, so both are passed for forward-compatibility.
//
// Separately (and just as important): `navigator.gpu` does NOT exist at all on
// `about:blank` / opaque-origin pages — WebGPU requires a real secure context
// (http://localhost, https://). The dev server below gives every test a real
// origin, so this is satisfied automatically.
const WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--use-angle=metal']

export default defineConfig({
  testDir: './e2e',
  // Serial, single-worker: Puzzle 1's solve path is driven by real Rapier
  // physics ticking on requestAnimationFrame, and this machine showed visible
  // frame-rate degradation (movement stalling for 2s+) when two Chromium
  // instances ran concurrently, which made the physics-timing assertions
  // flaky. Not a test bug — CPU contention between workers.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: WEBGPU_ARGS,
        },
      },
    },
  ],
  // The current build (pre-Phase-1) renders on WebGL via React Three Fiber v8
  // and runs entirely client-side in solo mode (no socket connection needed).
  // The Phase 0 e2e suite therefore only needs the Vite dev server, not the
  // Node/Socket.io server — see e2e/puzzle1.spec.js for the solo-swap flow
  // this proves. Phase 2+ multi-client sync tests will need the server too.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
