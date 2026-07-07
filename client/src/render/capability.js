// WebGPU capability gate — Sector-9 is WebGPU-only, with no WebGL fallback
// renderer (Project_Requirements.md §1 Fallback, Pillar E). A device either
// gets the game or the designed unsupported screen; never a crash, never a
// silent black screen, never a second render path.
//
// `WebGPURenderer` init is async (adapter/device request), so the gate awaits
// adapter acquisition. The probe adapter is discarded — three.js requests its
// own during renderer init; this module only decides the route.

const ADAPTER_TIMEOUT_MS = 3000

// Stable reason codes — the unsupported screen maps these to operator-facing
// text, and e2e asserts against them.
export const CAPABILITY_REASONS = {
  OK: 'ok',
  INSECURE_CONTEXT: 'insecure-context',
  NO_NAVIGATOR_GPU: 'no-navigator-gpu',
  NO_ADAPTER: 'no-adapter',
  ADAPTER_TIMEOUT: 'adapter-timeout',
  ADAPTER_ERROR: 'adapter-error',
}

/**
 * Probe WebGPU availability. Resolves with a routing decision:
 * `{ supported, reason, durationMs, features?, error? }`.
 *
 * Also mirrors the result onto `window.__CAPABILITY__` so the e2e suite can
 * assert the routing decision and the <500 ms routing floor (§2) without
 * re-probing.
 */
export async function detectWebGPUSupport({ timeoutMs = ADAPTER_TIMEOUT_MS } = {}) {
  const t0 = performance.now()

  const finish = (supported, reason, extra = {}) => {
    const result = {
      supported,
      reason,
      durationMs: Math.round(performance.now() - t0),
      ...extra,
    }
    window.__CAPABILITY__ = result
    if (!supported) {
      // Fail loudly with diagnostics (§1 Fallback) — but as a warn, not an
      // exception: Pillar E requires the unsupported screen to render with
      // zero console exceptions.
      console.warn(
        `[capability] WebGPU unavailable (${reason}) — routing to unsupported screen`,
        result
      )
    }
    return result
  }

  if (!('gpu' in navigator)) {
    // `navigator.gpu` is only exposed on secure contexts (https / localhost);
    // distinguish that from a browser with no WebGPU at all.
    return finish(
      false,
      window.isSecureContext
        ? CAPABILITY_REASONS.NO_NAVIGATOR_GPU
        : CAPABILITY_REASONS.INSECURE_CONTEXT
    )
  }

  let adapter
  try {
    adapter = await Promise.race([
      navigator.gpu.requestAdapter(),
      new Promise((resolve) =>
        setTimeout(() => resolve(CAPABILITY_REASONS.ADAPTER_TIMEOUT), timeoutMs)
      ),
    ])
  } catch (err) {
    return finish(false, CAPABILITY_REASONS.ADAPTER_ERROR, { error: String(err) })
  }

  if (adapter === CAPABILITY_REASONS.ADAPTER_TIMEOUT) {
    return finish(false, CAPABILITY_REASONS.ADAPTER_TIMEOUT)
  }
  if (!adapter) {
    // Browser ships the API but the platform/GPU has no adapter (headless
    // without flags, blocklisted GPU, missing Vulkan on Android, ...).
    return finish(false, CAPABILITY_REASONS.NO_ADAPTER)
  }

  return finish(true, CAPABILITY_REASONS.OK, {
    features: Array.from(adapter.features ?? []),
  })
}
