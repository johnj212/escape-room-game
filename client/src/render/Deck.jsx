import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getWorldSeed, streamFor } from './prng'
import {
  deckPlateMaterial,
  wallPanelMaterial,
  structuralMetalMaterial,
  neonMaterial,
  reactorCoreMaterial,
  containmentGlassMaterial,
} from './materials'

// Procedural Sector-9 deck visuals (§3.3, Pillar B): floor plating, wall
// panels, ribs, pipe runs, ceiling trusses, hanging cables, greeble field and
// the reactor assembly — all generated geometry, all layout seeded
// (`?seed=N`, §1 Determinism). Pure visuals: physics colliders live in
// Room.jsx. Density constants below are the §2 triangle-floor tuning knobs.
//
// Room frame: 20×20 m footprint (walls at ±10), 8 m ceiling. Left sector
// (x<0) is the Engineer's — cyan accents; right is the Technician's —
// magenta. The reactor anchors the back wall at z=-9.

const ROOM = { half: 10, height: 8 }
const DENSITY = {
  plateDiv: 20, // floor plates per side (plateDiv² plates)
  rivetsPerPlate: 8, // corners + edge midpoints
  greebles: 6000, // wall greeble boxes
  cables: 100, // hanging ceiling cables
  ribEvery: 2, // wall rib spacing (m)
}

// Shared scratch objects for matrix composition.
const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _s = new THREE.Vector3()

/** Instanced mesh fed by [{ position:[x,y,z], rotation?:[x,y,z], scale?:[x,y,z] }] */
const Instances = ({ geometry, material, transforms, castShadow = false, receiveShadow = true }) => {
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    for (let i = 0; i < transforms.length; i++) {
      const t = transforms[i]
      _p.fromArray(t.position)
      _e.set(t.rotation?.[0] ?? 0, t.rotation?.[1] ?? 0, t.rotation?.[2] ?? 0)
      _q.setFromEuler(_e)
      _s.fromArray(t.scale ?? [1, 1, 1])
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [transforms])
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, transforms.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}

// ---- layout builders (pure, seeded) ----------------------------------------

function buildFloor(seed) {
  const { half } = ROOM
  const n = DENSITY.plateDiv
  const size = (half * 2) / n
  const plates = []
  const rivets = []
  const rng = streamFor(seed, 'floor')
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      const x = -half + size * (ix + 0.5)
      const z = -half + size * (iz + 0.5)
      // Tiny per-plate height jitter sells "worked metal", stays walkable.
      const y = -0.11 + rng() * 0.008
      plates.push({ position: [x, y, z] })
      const r = size / 2 - 0.09
      const spots = [[-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]]
      for (const [sx, sz] of spots.slice(0, DENSITY.rivetsPerPlate)) {
        rivets.push({ position: [x + sx, 0.005, z + sz] })
      }
    }
  }
  return { plates, rivets, size }
}

function buildWalls(seed) {
  const { half, height } = ROOM
  const rng = streamFor(seed, 'walls')
  const panels = []
  const ribs = []
  const rails = []
  const strips = []
  // Wall descriptors: [origin, alongAxis, normalAxis, yaw, accent]
  const walls = [
    { o: [0, 0, -half], along: 'x', yaw: 0, accent: '#7f8fff' }, // back
    { o: [-half, 0, 0], along: 'z', yaw: Math.PI / 2, accent: '#00f3ff' }, // left / Engineer
    { o: [half, 0, 0], along: 'z', yaw: -Math.PI / 2, accent: '#ff007f' }, // right / Technician
  ]
  const inset = 0.28 // off the collider face
  for (const w of walls) {
    for (let a = -half + 1; a <= half - 1; a += DENSITY.ribEvery) {
      const pos = (v, d) => (w.along === 'x' ? [a, v, w.o[2] + d] : [w.o[0] + d, v, a])
      const d = w.o[2] < 0 || w.o[0] < 0 ? inset : -inset
      // Two panel rows.
      panels.push({ position: pos(2.0, d), rotation: [0, w.yaw, 0] })
      panels.push({ position: pos(5.8, d), rotation: [0, w.yaw, 0] })
      // Rib at each panel boundary.
      ribs.push({ position: pos(height / 2, d * 1.35), rotation: [0, w.yaw, 0] })
      // ~35% of ribs carry a neon strip in the sector accent.
      if (rng() < 0.35) {
        strips.push({
          position: pos(height / 2, d * 1.6),
          rotation: [0, w.yaw, 0],
          accent: w.accent,
        })
      }
    }
    const d = w.o[2] < 0 || w.o[0] < 0 ? inset : -inset
    const railPos = (v) => (w.along === 'x' ? [0, v, w.o[2] + d * 1.2] : [w.o[0] + d * 1.2, v, 0])
    rails.push({ position: railPos(0.25), rotation: [0, w.yaw, 0] })
    rails.push({ position: railPos(7.55), rotation: [0, w.yaw, 0] })
  }
  return { panels, ribs, rails, strips }
}

function buildPipes(seed) {
  const { half } = ROOM
  const rng = streamFor(seed, 'pipes')
  const runs = [] // horizontal near-ceiling runs (full wall length)
  const drops = [] // vertical drops
  const joints = []
  const walls = [
    { yaw: 0, at: (d) => [0, 0, -half + d], axis: 'x' },
    { yaw: Math.PI / 2, at: (d) => [-half + d, 0, 0], axis: 'z' },
    { yaw: -Math.PI / 2, at: (d) => [half - d, 0, 0], axis: 'z' },
  ]
  for (const w of walls) {
    const heights = [6.6, 6.9, 7.15]
    heights.forEach((h, i) => {
      const [x, , z] = w.at(0.55 + i * 0.18)
      runs.push({
        position: [x, h, z],
        rotation: w.axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0],
        scale: [1, half * 2 - 0.6, 1],
        radius: i === 1 ? 1.4 : 1,
      })
    })
    // 4–5 drops per wall at seeded positions.
    const nDrops = 9 + Math.floor(rng() * 3)
    for (let i = 0; i < nDrops; i++) {
      const a = -half + 1.5 + rng() * (half * 2 - 3)
      const [x, , z] = w.at(0.55)
      const px = w.axis === 'x' ? a : x
      const pz = w.axis === 'x' ? z : a
      const len = 2.2 + rng() * 3.4
      drops.push({ position: [px, 6.6 - len / 2, pz], scale: [1, len, 1] })
      joints.push({ position: [px, 6.6, pz] })
      joints.push({ position: [px, 6.6 - len, pz] })
    }
  }
  return { runs, drops, joints }
}

function buildGreebles(seed) {
  const { half } = ROOM
  const rng = streamFor(seed, 'greebles')
  const out = []
  for (let i = 0; i < DENSITY.greebles; i++) {
    const wall = Math.floor(rng() * 3)
    const a = -half + 0.6 + rng() * (half * 2 - 1.2)
    const y = 0.5 + rng() * 6.6
    const depth = 0.05 + rng() * 0.14
    const w = 0.08 + rng() * 0.3
    const h = 0.08 + rng() * 0.3
    const inset = 0.16 + depth / 2
    let position, rotation
    if (wall === 0) {
      position = [a, y, -half + inset]
      rotation = [0, 0, 0]
    } else if (wall === 1) {
      position = [-half + inset, y, a]
      rotation = [0, Math.PI / 2, 0]
    } else {
      position = [half - inset, y, a]
      rotation = [0, -Math.PI / 2, 0]
    }
    out.push({ position, rotation, scale: [w, h, depth] })
  }
  return out
}

function buildCeiling(seed) {
  const { half } = ROOM
  const rng = streamFor(seed, 'ceiling')
  const beams = []
  for (const z of [-5, 0, 5]) beams.push({ position: [0, 7.8, z], scale: [half * 2, 1, 1] })
  const cross = []
  for (let x = -8; x <= 8; x += 2.66) {
    cross.push({ position: [x, 7.65, 0], rotation: [0, Math.PI / 2, 0], scale: [half * 2, 0.7, 0.7] })
  }
  // Hanging cable curves: sag between random beam anchor points.
  const cables = []
  for (let i = 0; i < DENSITY.cables; i++) {
    const x0 = -half + 1 + rng() * (half * 2 - 2)
    const z0 = [-5, 0, 5][Math.floor(rng() * 3)]
    const x1 = THREE.MathUtils.clamp(x0 + (rng() - 0.5) * 6, -half + 1, half - 1)
    const z1 = [-5, 0, 5][Math.floor(rng() * 3)]
    const sag = 0.5 + rng() * 1.1
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x0, 7.7, z0),
      new THREE.Vector3((x0 + x1) / 2, 7.7 - sag, (z0 + z1) / 2),
      new THREE.Vector3(x1, 7.7, z1),
    ])
    cables.push(new THREE.TubeGeometry(curve, 56, 0.022 + rng() * 0.02, 12, false))
  }
  return { beams, cross, cables }
}

// ---- component ---------------------------------------------------------------

export const Deck = () => {
  const seed = useMemo(() => getWorldSeed(), [])

  const layout = useMemo(
    () => ({
      floor: buildFloor(seed),
      walls: buildWalls(seed),
      pipes: buildPipes(seed),
      greebles: buildGreebles(seed),
      ceiling: buildCeiling(seed),
    }),
    [seed]
  )

  const geo = useMemo(() => {
    // Beveled plate: REAL chamfered edges that catch light at every seam —
    // justified tessellation, not flat-quad padding.
    const half = (layout.floor.size - 0.06) / 2
    const shape = new THREE.Shape()
    shape.moveTo(-half, -half)
    shape.lineTo(half, -half)
    shape.lineTo(half, half)
    shape.lineTo(-half, half)
    shape.closePath()
    const plate = new THREE.ExtrudeGeometry(shape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.02,
      bevelSegments: 2,
    })
    plate.rotateX(-Math.PI / 2)
    plate.translate(0, 0.11, 0)
    return {
      plate,
      rivet: new THREE.CylinderGeometry(0.028, 0.034, 0.026, 20),
      panel: new THREE.BoxGeometry(DENSITY.ribEvery - 0.18, 3.6, 0.1),
      rib: new THREE.BoxGeometry(0.16, ROOM.height - 0.5, 0.22),
      rail: new THREE.BoxGeometry(ROOM.half * 2 - 0.2, 0.14, 0.1),
      strip: new THREE.BoxGeometry(0.05, ROOM.height - 1.6, 0.04),
      pipe: new THREE.CylinderGeometry(0.055, 0.055, 1, 20, 1, true),
      joint: new THREE.SphereGeometry(0.085, 18, 14),
      greeble: new THREE.BoxGeometry(1, 1, 1),
      beam: new THREE.BoxGeometry(1, 0.22, 0.5),
      conduit: new THREE.CylinderGeometry(0.03, 0.03, ROOM.half * 2, 16),
      reactorBase: new THREE.CylinderGeometry(2.3, 2.55, 0.6, 96),
      reactorGlass: new THREE.CylinderGeometry(1.5, 1.5, 6.2, 96, 1, true),
      reactorCore: new THREE.IcosahedronGeometry(0.95, 6),
      reactorRing: new THREE.TorusGeometry(1.68, 0.07, 28, 300),
      reactorStrut: new THREE.BoxGeometry(0.14, 6.4, 0.2),
      reactorDuct: new THREE.CylinderGeometry(0.75, 1.0, 1.6, 32),
    }
  }, [layout.floor.size])

  const mat = useMemo(
    () => ({
      plate: deckPlateMaterial({ plateSize: layout.floor.size }),
      wall: wallPanelMaterial({ panelWidth: DENSITY.ribEvery }),
      structural: structuralMetalMaterial(),
      dark: structuralMetalMaterial({ tone: '#0d1017' }),
      cyan: neonMaterial({ tint: '#00f3ff', intensity: 2.4 }),
      magenta: neonMaterial({ tint: '#ff007f', intensity: 2.4 }),
      violet: neonMaterial({ tint: '#7f8fff', intensity: 1.8, flicker: 0.05 }),
      core: reactorCoreMaterial(),
      glass: containmentGlassMaterial(),
    }),
    [layout.floor.size]
  )

  // Dispose GPU resources on unmount (reset/replay churn).
  useLayoutEffect(() => {
    return () => {
      Object.values(geo).forEach((g) => g.dispose())
      layout.ceiling.cables.forEach((g) => g.dispose())
      Object.values(mat).forEach((m) => m.dispose())
    }
  }, [geo, mat, layout.ceiling.cables])

  const stripByAccent = useMemo(() => {
    const groups = {}
    for (const s of layout.walls.strips) {
      if (!groups[s.accent]) groups[s.accent] = []
      groups[s.accent].push(s)
    }
    return groups
  }, [layout.walls.strips])

  return (
    <group>
      {/* Floor plating + rivets */}
      <Instances geometry={geo.plate} material={mat.plate} transforms={layout.floor.plates} />
      <Instances geometry={geo.rivet} material={mat.structural} transforms={layout.floor.rivets} />

      {/* Wall panelling, ribs, rails, neon strips */}
      <Instances geometry={geo.panel} material={mat.wall} transforms={layout.walls.panels} castShadow />
      <Instances geometry={geo.rib} material={mat.dark} transforms={layout.walls.ribs} castShadow />
      <Instances geometry={geo.rail} material={mat.dark} transforms={layout.walls.rails} />
      {Object.entries(stripByAccent).map(([accent, strips]) => (
        <Instances
          key={accent}
          geometry={geo.strip}
          material={accent === '#00f3ff' ? mat.cyan : accent === '#ff007f' ? mat.magenta : mat.violet}
          transforms={strips}
        />
      ))}

      {/* Pipe runs, drops, joints */}
      <Instances geometry={geo.pipe} material={mat.structural} transforms={layout.pipes.runs} castShadow />
      <Instances geometry={geo.pipe} material={mat.structural} transforms={layout.pipes.drops} castShadow />
      <Instances geometry={geo.joint} material={mat.dark} transforms={layout.pipes.joints} />

      {/* Greeble field */}
      <Instances geometry={geo.greeble} material={mat.dark} transforms={layout.greebles} />

      {/* Ceiling trusses + cross beams + conduits + cables */}
      <Instances geometry={geo.beam} material={mat.structural} transforms={layout.ceiling.beams} castShadow />
      <Instances geometry={geo.beam} material={mat.dark} transforms={layout.ceiling.cross} />
      <mesh position={[0, 7.68, -4.9]} rotation={[0, 0, Math.PI / 2]} material={mat.cyan} geometry={geo.conduit} />
      <mesh position={[0, 7.68, 4.9]} rotation={[0, 0, Math.PI / 2]} material={mat.magenta} geometry={geo.conduit} />
      {layout.ceiling.cables.map((cable, i) => (
        <mesh key={i} geometry={cable} material={mat.dark} />
      ))}

      {/* Reactor assembly (visual; collider in Room.jsx) */}
      <group position={[0, 0, -9]}>
        <mesh geometry={geo.reactorBase} material={mat.structural} position={[0, 0.3, 0]} receiveShadow castShadow />
        <mesh geometry={geo.reactorCore} material={mat.core} position={[0, 3.9, 0]} />
        <mesh geometry={geo.reactorGlass} material={mat.glass} position={[0, 3.9, 0]} />
        <Instances
          geometry={geo.reactorStrut}
          material={mat.dark}
          transforms={Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            return {
              position: [Math.cos(a) * 1.62, 3.9, Math.sin(a) * 1.62],
              rotation: [0, -a, 0],
            }
          })}
          castShadow
        />
        <Instances
          geometry={geo.reactorRing}
          material={mat.structural}
          transforms={[1.2, 3.9, 6.6].map((y) => ({ position: [0, y, 0], rotation: [Math.PI / 2, 0, 0] }))}
          castShadow
        />
        <mesh geometry={geo.reactorDuct} material={mat.dark} position={[0, 7.2, 0]} castShadow />
      </group>
    </group>
  )
}
export default Deck
