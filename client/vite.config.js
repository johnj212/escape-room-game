import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const threeWebgpuShim = fileURLToPath(
  new URL('./src/render/three-webgpu-shim.js', import.meta.url)
)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Single-renderer bundle (§2 critical-bundle floor): every `three`
    // import — ours, fiber's, drei's — resolves to the WebGPU build, so the
    // WebGL renderer code never ships. three.webgpu.js re-exports the full
    // core (both builds share three.core.js), so core classes stay
    // identical; fiber only touches WebGLRenderer when no custom `gl`
    // factory is supplied, which never happens here (capability gate +
    // async WebGPURenderer factory).
    alias: [
      // Exact match only — `three/webgpu`, `three/tsl` and
      // `three/examples/*` must pass through untouched. The shim re-exports
      // three/webgpu plus throwing stubs for WebGL-only names that some
      // dependencies import (never construct) — see the shim's header.
      { find: /^three$/, replacement: threeWebgpuShim },
      // Route the subpath entries to source too — one copy of everything,
      // maximally tree-shakeable.
      { find: /^three\/webgpu$/, replacement: 'three/src/Three.WebGPU.js' },
      { find: /^three\/tsl$/, replacement: 'three/src/Three.TSL.js' },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        // Isolate Rapier: @dimforge/rapier3d-compat embeds its ~2.2 MB WASM
        // binary INSIDE rapier.mjs, so it must live in its own chunk for the
        // §2 bundle floor's explicit "excl. Rapier WASM" carve-out (D-1) to
        // be measurable — tools/perf-probe.mjs excludes `rapier-wasm-*`.
        manualChunks(id) {
          if (id.includes('@dimforge')) return 'rapier-wasm'
          return undefined
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true
  },
  test: {
    // Vitest runs unit tests only; Playwright owns e2e/ (its test.describe
    // is incompatible with the vitest runner). See STATUS.md.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**']
  }
})
