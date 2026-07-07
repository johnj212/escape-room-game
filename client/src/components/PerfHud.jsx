import { useEffect, useState } from 'react'

// Visible layer of the §5.5 performance HUD. The data layer is PerfProbe in
// GameCanvas, which publishes { fps, drawCalls, triangles } to window.__PERF__
// every frame from renderer.info — identical shape for WebGL today and
// WebGPURenderer at the Phase-1 swap. This overlay samples that object on a
// slow timer, so it costs nothing inside the render loop.
//
// Toggle: F3 at any time, or boot visible with `?hud=1` (the path the
// perf harness and mobile verification use — no keyboard required).

const SAMPLE_MS = 250

const fpsClass = (fps) => {
  if (fps >= 60) return 'ok'
  if (fps >= 30) return 'warn'
  return 'bad'
}

export const PerfHud = () => {
  const [visible, setVisible] = useState(() =>
    new URLSearchParams(window.location.search).has('hud')
  )
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F3') {
        e.preventDefault()
        setVisible((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    const id = setInterval(() => setStats(window.__PERF__ ?? null), SAMPLE_MS)
    return () => clearInterval(id)
  }, [visible])

  if (!visible) return null

  return (
    <div className="perf-hud" data-testid="perf-hud">
      <div className="perf-hud-row">
        <span>FPS</span>
        <span className={`perf-hud-fps ${stats ? fpsClass(stats.fps) : ''}`}>
          {stats ? stats.fps : '—'}
        </span>
      </div>
      <div className="perf-hud-row">
        <span>DRAW</span>
        <span>{stats ? stats.drawCalls : '—'}</span>
      </div>
      <div className="perf-hud-row">
        <span>TRIS</span>
        <span>{stats ? stats.triangles.toLocaleString('en-US') : '—'}</span>
      </div>
    </div>
  )
}
export default PerfHud
