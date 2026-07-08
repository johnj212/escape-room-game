// TSL procedural material library (§3.2, Pillar B): every surface is PBR and
// every pixel of texture detail is computed in shader — zero image files.
// Node materials only; these compile through WebGPURenderer's NodeBuilder.
//
// Convention: factories return a fresh material (call sites own disposal via
// React lifecycles); shared value nodes are built per-factory so materials
// stay independently tweakable.

import {
  MeshStandardNodeMaterial,
  MeshPhysicalNodeMaterial,
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
  const tint = cellRandom(cell).mul(0.05)
  const base = mix(color('#181d26'), color('#232a38'), tint.add(0.35))

  // Long directional scratches + fine wear noise.
  const scratches = brushedStreaks(1, positionWorld.x, positionWorld.z, 0.9, 14.0)
  const wear = mx_fractal_noise_float(positionWorld.xz.mul(3.0), FRACTAL_OCTAVES)

  // Seam darkening: grime collects at plate edges.
  const edgeX = smoothstep(0.0, 0.06, local.x).mul(smoothstep(1.0, 0.94, local.x))
  const edgeZ = smoothstep(0.0, 0.06, local.y).mul(smoothstep(1.0, 0.94, local.y))
  const seam = edgeX.mul(edgeZ) // 1 inside, 0 at seams

  mat.colorNode = mix(base.mul(0.55), base, seam).add(
    vec3(scratches.mul(0.02))
  )
  mat.roughnessNode = float(0.42)
    .add(wear.mul(0.18))
    .add(scratches.mul(0.12))
    .clamp(0.25, 0.85)
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

/** Darker structural alloy for beams, pipes, cages, greebles. */
export function structuralMetalMaterial({ tone = '#12161f' } = {}) {
  const mat = new MeshStandardNodeMaterial()
  const grain = mx_noise_float(positionWorld.xyz.mul(6.0))
  mat.colorNode = color(tone).add(vec3(grain.mul(0.012)))
  mat.roughnessNode = float(0.55).add(grain.mul(0.15))
  mat.metalnessNode = float(0.9)
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
