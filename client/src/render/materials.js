// TSL procedural material library (§3.2, Pillar B): every surface is PBR and
// every pixel of texture detail is computed in shader — zero image files.
// Node materials only; these compile through WebGPURenderer's NodeBuilder.
//
// Convention: factories return a fresh material (call sites own disposal via
// React lifecycles); shared value nodes are built per-factory so materials
// stay independently tweakable.

import { useEffect, useState } from 'react'
import {
  MeshStandardNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshBasicNodeMaterial,
} from 'three/webgpu'
import {
  color,
  float,
  vec2,
  vec3,
  mix,
  mul,
  add,
  fract,
  floor,
  smoothstep,
  positionWorld,
  positionLocal,
  normalWorld,
  time,
  oscSine,
  mx_noise_float,
  mx_fractal_noise_float,
  mx_cell_noise_float,
} from 'three/tsl'

// Noise budget note (2026-07-08 fps-floor bisect): the material library's
// per-pixel noise measured ~20% of scene-pass cost at dpr-2 desktop res.
// Fractal noise below runs at 2 octaves (default is 3) — visually
// indistinguishable at gameplay camera distance, half the ALU.
const FRACTAL_OCTAVES = 2

// -- shared procedural ingredients -------------------------------------------

/** Anisotropic "brushed" streak field: noise stretched hard along one axis. */
const brushedStreaks = (p, along, across, scaleAlong, scaleAcross) =>
  mx_noise_float(vec2(mul(along, scaleAlong), mul(across, scaleAcross)).mul(p))

/** Stable per-cell random tint in [0,1] from a world-space cell id. */
const cellRandom = (cellId) => fract(mx_cell_noise_float(cellId).mul(43758.5453))

// -- floor --------------------------------------------------------------------

/**
 * Scratched deck plating. World-XZ driven so the pattern is seamless across
 * the instanced plates: per-plate tint variation, micro-scratch roughness,
 * grime accumulation toward plate seams.
 */
export function deckPlateMaterial({ plateSize = 2 } = {}) {
  const mat = new MeshStandardNodeMaterial()

  const cell = floor(positionWorld.xz.div(plateSize))
  const local = fract(positionWorld.xz.div(plateSize)) // 0..1 within plate

  // Base steel with subtle per-plate value shift (breaks the tiling read).
  const plateRand = cellRandom(cell) // reused below for rust, not just tint
  const base = mix(color('#181d26'), color('#232a38'), plateRand.mul(0.05).add(0.35))

  // Long directional scratches + fine wear noise.
  const scratches = brushedStreaks(1, positionWorld.x, positionWorld.z, 0.9, 14.0)
  const wear = mx_fractal_noise_float(positionWorld.xz.mul(3.0), FRACTAL_OCTAVES)

  // Seam darkening: grime collects at plate edges.
  const edgeX = smoothstep(0.0, 0.06, local.x).mul(smoothstep(1.0, 0.94, local.x))
  const edgeZ = smoothstep(0.0, 0.06, local.y).mul(smoothstep(1.0, 0.94, local.y))
  const seam = edgeX.mul(edgeZ) // 1 inside, 0 at seams

  // Delta round 2, gap #3 (floor grime/wear): the plate shader read as
  // uniform clean tile against the reference's oil-stained, worn plating.
  // Perf note: the first version of this spent THREE extra per-pixel noise
  // evaluations across the frame's dominant surface and cost ~9 fps off the
  // sacred floor (60 -> 51, measured via perf-probe). Cheapened to ONE new
  // noise call by reusing fields that already exist for other purposes:
  //  - grimeMask: one new low-frequency fractal call, large soot/oil patches
  //  - puddleMask: a different threshold band on that SAME grime field
  //    (no extra sampling) — glossy pooling reads naturally coincident with
  //    the grimiest patches, which is physically sensible anyway
  //  - rustMask: reuses `plateRand`, the per-plate cell-random already
  //    computed for the base tint, thresholded near its top end — rare
  //    whole-plate rust rather than a separate per-pixel noise field
  // Cost history (2026-07-08 bisect, this file's noise-budget note applies):
  // fractal-2 grime measured ~3 fps off the 60 floor on the frame's dominant
  // surface; a SINGLE-octave mx_noise at the same low frequency reads nearly
  // identical for the large soot/oil patches and halves the ALU again.
  const grime = mx_noise_float(positionWorld.xz.mul(0.35)).mul(0.5).add(0.5)
  const grimeMask = smoothstep(0.35, 0.78, grime)
  const puddleMask = smoothstep(0.84, 0.95, grime)
  const rustMask = smoothstep(0.9, 0.98, plateRand)

  let col = mix(base.mul(0.55), base, seam).add(vec3(scratches.mul(0.02)))
  col = mix(col, col.mul(0.5).add(vec3(0.012, 0.013, 0.015)), grimeMask.mul(0.75))
  col = mix(col, color('#2e1a10'), rustMask.mul(0.4))
  mat.colorNode = col
  mat.roughnessNode = float(0.42)
    .add(wear.mul(0.18))
    .add(scratches.mul(0.12))
    .add(grimeMask.mul(0.18))
    .sub(puddleMask.mul(0.3))
    .clamp(0.08, 0.9)
  mat.metalnessNode = float(0.85)
  return mat
}

// -- walls --------------------------------------------------------------------

/**
 * Wall panel alloy: vertical brushing, per-panel tint bands, faint oxidation
 * blotches. Panel id derives from world position so instancing stays varied.
 */
export function wallPanelMaterial({ panelWidth = 2 } = {}) {
  const mat = new MeshStandardNodeMaterial()

  const panelId = floor(add(positionWorld.x, positionWorld.z).div(panelWidth))
  const tint = cellRandom(vec2(panelId, floor(positionWorld.y.div(2.0))))

  const base = mix(color('#1b212d'), color('#262f40'), tint)
  const brushing = brushedStreaks(1, positionWorld.y, add(positionWorld.x, positionWorld.z), 0.6, 18.0)
  const blotch = mx_fractal_noise_float(positionWorld.xz.add(positionWorld.yy).mul(0.8), FRACTAL_OCTAVES)

  mat.colorNode = base
    .add(vec3(brushing.mul(0.015)))
    .sub(vec3(smoothstep(0.45, 0.8, blotch).mul(0.03)))
  mat.roughnessNode = float(0.5).add(blotch.mul(0.2)).clamp(0.3, 0.8)
  // 0.55, not 0.75: pure metal has no diffuse lobe, and with the environment
  // probe benched (D-4) there is nothing to reflect — walls away from the
  // sector washes crushed to black (Pillar C, delta round 1 gap #3). A
  // painted-alloy read keeps enough diffuse for the hemisphere fill to carry.
  mat.metalnessNode = float(0.55)
  return mat
}

// -- trim / structural metal ---------------------------------------------------

/** Darker structural alloy for beams, pipes, cages, greebles.
 *  Metalness 0.7 (not 0.9): with the environment probe benched (D-4) a
 *  near-pure metal has almost no diffuse lobe and crushes to black away
 *  from direct light — Pillar C (gate-verifier flag, 2026-07-08). */
export function structuralMetalMaterial({ tone = '#12161f' } = {}) {
  const mat = new MeshStandardNodeMaterial()
  const grain = mx_noise_float(positionWorld.xyz.mul(6.0))
  mat.colorNode = color(tone).add(vec3(grain.mul(0.012)))
  mat.roughnessNode = float(0.55).add(grain.mul(0.15))
  mat.metalnessNode = float(0.7)
  return mat
}

// -- emissives ------------------------------------------------------------------

/**
 * Neon emitter. `flicker` adds a subtle high-frequency instability (Pillar F:
 * a frozen frame should read as one second from motion).
 */
export function neonMaterial({ tint = '#00f3ff', intensity = 2.2, flicker = 0.08 } = {}) {
  const mat = new MeshStandardNodeMaterial()
  const instability = mx_noise_float(vec2(time.mul(9.0), positionWorld.y.mul(2.0)))
    .mul(flicker)
    .add(1.0)
  mat.colorNode = color(tint)
  mat.emissiveNode = color(tint).mul(float(intensity).mul(instability))
  mat.roughnessNode = float(0.15)
  mat.metalnessNode = float(0.1)
  return mat
}

/**
 * Reactor core plasma: slow pressure pulse + churning interior noise.
 * The core is the room's emotional anchor — it must visibly breathe.
 */
export function reactorCoreMaterial({ intensity = 5.0 } = {}) {
  const mat = new MeshStandardNodeMaterial()
  const pulse = oscSine(time.mul(0.25)).mul(0.35).add(0.75) // 0.4..1.1 slow breath
  const churn = mx_fractal_noise_float(
    positionLocal.xyz.mul(2.2).add(vec3(0, time.mul(-0.6), 0))
  )
  const heat = smoothstep(-0.2, 0.9, churn)
  mat.colorNode = mix(color('#ff2d00'), color('#ffb46b'), heat)
  mat.emissiveNode = mix(color('#c81800'), color('#ff9a3d'), heat).mul(
    float(intensity).mul(pulse)
  )
  mat.roughnessNode = float(0.4)
  mat.metalnessNode = float(0.0)
  return mat
}

// -- glass ----------------------------------------------------------------------

/** Containment / partition glass with a cool tint.
 *  Transmission stays 0 (plain alpha transparency): transmission > 0 makes
 *  the renderer regenerate a full-res transmission target + mip chain every
 *  frame — measured ~20% of scene-pass cost at dpr-2 (2026-07-08 fps bisect)
 *  for a refraction read nobody sees on thin flat panes. */
export function containmentGlassMaterial({ tint = '#8fd8ff', opacity = 0.16 } = {}) {
  const mat = new MeshPhysicalNodeMaterial()
  mat.transparent = true
  mat.opacity = opacity
  mat.transmission = 0
  mat.thickness = 0.6
  mat.roughness = 0.08
  mat.metalness = 0.05
  mat.colorNode = color(tint)
  // Rim glow: brighter where glancing (cheap fresnel via view-normal falloff).
  const facing = normalWorld.dot(vec3(0, 0, 1)).abs()
  mat.emissiveNode = color(tint).mul(smoothstep(0.9, 0.2, facing).mul(0.25))
  return mat
}

// -- atmosphere -------------------------------------------------------------

/**
 * Drifting dust motes. Unlit (MeshBasicNodeMaterial, not Standard): these
 * render hundreds of instances and must never enter the PBR light loop —
 * that loop is the measured desktop fps ceiling (docs/DEVIATIONS.md D-5).
 * No depth-write so overlapping motes soften instead of z-fighting.
 * Per-instance flicker only (no positional animation) — cheap, and Pillar
 * F's "reads as one second from motion" is satisfied by the brightness
 * instability alone, same trick as `neonMaterial`.
 *
 * Round-2 gotcha found the hard way: additive blending on hundreds of
 * overlapping instances stacks past the bloom threshold wherever two or
 * more motes overlap on screen — the bloom pass then blows each stack into
 * a screen-space-sized halo, independent of the true (tiny) sphere size,
 * turning "dust" into giant blurred orbs that ate the whole frame. Plain
 * alpha blending (no stacking past 1.0) plus a low intensity ceiling keeps
 * every mote comfortably under the bloom threshold.
 */
export function motesMaterial({ tint = '#cfe8ff' } = {}) {
  const mat = new MeshBasicNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  const drift = mx_noise_float(vec2(time.mul(0.5), positionWorld.y.mul(2.4).add(positionWorld.x)))
    .mul(0.5)
    .add(0.5)
  mat.colorNode = color(tint).mul(drift.mul(0.25).add(0.35))
  mat.opacityNode = drift.mul(0.1).add(0.05)
  return mat
}

// -- alarm escalation (Pillar F, §3.17) --------------------------------------
//
// Single source of truth for "how urgent the room is right now", shared by
// render/Lighting.jsx (fixture color/intensity) and
// components/EndgameSequence.jsx (blast door / meltdown wash) so the two
// systems can never drift out of sync — the same lesson D-6 (docs/DEVIATIONS.md)
// already paid for once with a duplicated timing constant. Lives here (not a
// material, but this is the one file both owners share) rather than as a
// third new file, per the Phase-3 file-ownership split.
//
// Bands over the 900s meltdown timer: nominal (>300s) -> elevated (300-120s,
// gentle ramp) -> critical (<120s, "the last two minutes" per the brief,
// where the ramp is steep). `lose` forces max urgency; `win` fades to calm
// regardless of the clock.
export const ALARM_ELEVATED_S = 300
export const ALARM_CRITICAL_S = 120
// Pulse frequency cap: stays well under the ~3 Hz flash-safety line even at
// maximum escalation (photosensitivity hazard, brief §4).
export const ALARM_MAX_PULSE_HZ = 2.2

/**
 * Pure escalation factor in [0,1] from the live meltdown timer + gamePhase.
 * 0 = nominal room tone, 1 = maximum urgency.
 */
export function alarmEscalation(timerSeconds, gamePhase) {
  const creep = Math.min(1, Math.max(0, 1 - timerSeconds / 900))
  let criticalT
  if (timerSeconds <= ALARM_CRITICAL_S) {
    criticalT = Math.min(1, Math.max(0, 1 - timerSeconds / ALARM_CRITICAL_S))
  } else if (timerSeconds <= ALARM_ELEVATED_S) {
    criticalT =
      Math.min(
        1,
        Math.max(0, 1 - (timerSeconds - ALARM_CRITICAL_S) / (ALARM_ELEVATED_S - ALARM_CRITICAL_S))
      ) * 0.35
  } else {
    criticalT = 0
  }
  let e = Math.min(1, creep * 0.25 + criticalT * 0.9)
  if (gamePhase === 'lose') e = 1
  if (gamePhase === 'win') e = 0
  return e
}

/**
 * Pulse multiplier for emissive/light intensity: both amplitude and
 * frequency grow with escalation, both capped (never a strobe). Reduced
 * motion holds the mean (1.0) instead of oscillating — the pulse itself is
 * the thing `prefers-reduced-motion` must kill.
 */
export function alarmPulse(elapsedSeconds, escalation, reducedMotion) {
  if (reducedMotion) return 1
  const hz = 0.25 + escalation * (ALARM_MAX_PULSE_HZ - 0.25)
  return 1 + Math.sin(elapsedSeconds * hz * Math.PI * 2) * (0.08 + escalation * 0.3)
}

/**
 * Shared `prefers-reduced-motion` read, live-updating on OS/browser change.
 * Every escalation-driven pulse (Lighting.jsx, EndgameSequence.jsx) must
 * gate through this — quality law §4: every overlay/effect respects it.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}
