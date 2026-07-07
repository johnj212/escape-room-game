import { AlertTriangle, Monitor } from 'lucide-react'

// Designed unsupported screen (Pillar E / §1 Fallback): what a non-WebGPU
// device gets instead of the game. Diegetic framing — the ship refuses to
// boot its render core — plus honest diagnostics and a concrete path to a
// supported device. Never a crash, never a blank screen, no WebGL fallback.
//
// The recorded-demo hook (§3.1) lands once WebGPU hero footage exists to
// record (tracked in STATUS.md) — no dead button ships before then.

const REASON_TEXT = {
  'insecure-context':
    'This page is not running in a secure context (https or localhost), so the GPU interface is unavailable.',
  'no-navigator-gpu':
    'This browser does not expose WebGPU (navigator.gpu is missing).',
  'no-adapter':
    'The browser exposes WebGPU but reported no compatible GPU adapter on this device.',
  'adapter-timeout':
    'The GPU adapter request timed out — the graphics driver did not respond.',
  'adapter-error':
    'The GPU adapter request failed with an error.',
}

export const UnsupportedScreen = ({ capability }) => {
  const reason = capability?.reason ?? 'no-navigator-gpu'

  return (
    <div className="overlay-screen" data-testid="unsupported-screen">
      <div className="unsupported-beacon" aria-hidden="true">
        <AlertTriangle size={34} color="var(--neon-red)" />
      </div>
      <h1 className="overlay-title" style={{ color: 'var(--neon-red)' }}>
        RENDER CORE INCOMPATIBLE
      </h1>
      <p className="overlay-subtitle">
        Sector-9 runs on WebGPU only — this device or browser cannot initialize it.
      </p>

      <div className="glass-panel unsupported-panel">
        <div className="unsupported-diag">
          <span className="unsupported-diag-code">DIAG :: {reason.toUpperCase()}</span>
          <span>{REASON_TEXT[reason] ?? REASON_TEXT['no-navigator-gpu']}</span>
          {capability?.error && (
            <span className="unsupported-diag-detail">{capability.error}</span>
          )}
        </div>

        <div className="unsupported-reqs">
          <div className="unsupported-reqs-title">
            <Monitor size={16} color="var(--neon-cyan)" />
            <span>Supported deployment targets</span>
          </div>
          <ul>
            <li>Desktop — Chrome / Edge 113+, Safari 18+, Firefox 141+</li>
            <li>iPhone / iPad — iOS 18+ Safari</li>
            <li>Android — Chrome 121+ with a Vulkan-capable GPU</li>
          </ul>
          <p className="unsupported-hint">
            Open this address on one of the above — desktop Chrome is the surest route in.
          </p>
        </div>
      </div>
    </div>
  )
}
export default UnsupportedScreen
