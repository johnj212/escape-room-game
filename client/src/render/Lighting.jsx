import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CSMShadowNode } from 'three/examples/jsm/csm/CSMShadowNode.js'
import { neonMaterial } from './materials'
import { sceneLights } from './lightRegistry'

// Sector-9 lighting rig (§3.4, Pillars C + F).
//
// Desktop profile: key directional light through a 4-cascade CSMShadowNode
// (first-party WebGPU CSM, three/examples/jsm/csm) at 2048² per cascade,
// PCFSoft-filtered. Mobile profile: 2 cascades at 1024² (§2 scaling).
// PCSS contact hardening is a pending Phase-1 sub-step (tracked in
// STATUS.md) — the filter hook is `light.shadow.shadowNode`, same seam.
//
// Until the irradiance-probe GI bake lands, bounce is approximated by:
// hemisphere skylight + sector-tinted shadowless fill points + fixture
// lights tied to visible emissive geometry (every light has a diegetic
// source — Pillar B/C: light must *come from somewhere*).

const FIXTURES = {
  // Ceiling light panels: [x, z, tint, intensity(candela), hasLight]
  // All five panels glow (emissive quads); only three carry point lights —
  // the forward light loop prices every punctual light on every fragment,
  // and the 2026-07-08 fps-floor bisect measured the panel lights as ~25%
  // of scene-pass cost. Back corners ride the reactor glow + alarm spot.
  panels: [
    [-5, -5, '#bcd2ff', 20, false],
    [5, -5, '#bcd2ff', 20, false],
    [-5, 5, '#bcd2ff', 22, true],
    [5, 5, '#bcd2ff', 22, true],
    [0, 0, '#d6e4ff', 24, true],
  ],
  // Sector bounce fills (shadowless, mimic wall-neon bounce until probes).
  // Pulled toward the consoles (±7) since the dedicated console task lights
  // were consolidated away — one light per sector does both jobs now.
  fills: [
    [-7, 3.2, 0, '#00f3ff', 11, 10], // Engineer wall + console wash
    [7, 3.2, 0, '#ff007f', 11, 10], // Technician wall + console wash
  ],
}

const CSMKeyLight = ({ isMobile }) => {
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const light = new THREE.DirectionalLight('#c9d6ff', 2.6)
    light.position.set(8, 12, 6)
    light.castShadow = true
    const mapSize = isMobile ? 1024 : 2048
    light.shadow.mapSize.set(mapSize, mapSize)
    light.shadow.bias = -0.0004
    light.shadow.normalBias = 0.025
    light.shadow.camera.far = 60

    const csm = new CSMShadowNode(light, {
      cascades: isMobile ? 2 : 4,
      maxFar: 45,
      mode: 'practical',
      lightMargin: 25,
    })
    csm.fade = true
    light.shadow.shadowNode = csm

    scene.add(light)
    scene.add(light.target)
    return () => {
      scene.remove(light.target)
      scene.remove(light)
      light.dispose()
    }
  }, [scene, isMobile])

  return null
}

export const Lighting = ({ isMobile = false }) => {
  const panelMat = useMemo(
    // 1.7: just over the bloom threshold for a tight halo — 3.2 blew the
    // ceiling into a frame-wide white haze (delta round 1, gap #1 family).
    () => neonMaterial({ tint: '#cfe0ff', intensity: 1.7, flicker: 0.02 }),
    []
  )
  const panelGeo = useMemo(() => new THREE.BoxGeometry(1.8, 0.06, 0.9), [])
  useEffect(() => {
    return () => {
      panelMat.dispose()
      panelGeo.dispose()
    }
  }, [panelMat, panelGeo])

  return (
    <>
      {/* Skylight fill: shadowed metal reads cool, never black (Pillar C).
          Intensities are physical units (candela for point/spot, decay 2). */}
      <hemisphereLight args={['#46587e', '#141826', 4.2]} />
      <ambientLight intensity={0.7} color="#22525e" />

      {/* Key light: 4-cascade CSM (desktop) / 2-cascade (mobile) */}
      <CSMKeyLight isMobile={isMobile} />

      {/* Ceiling fixtures: emissive panel + (for three of five) a point light */}
      {FIXTURES.panels.map(([x, z, tint, intensity, hasLight], i) => (
        <group key={`panel-${i}`} position={[x, 7.55, z]}>
          <mesh geometry={panelGeo} material={panelMat} />
          {hasLight && (
            <pointLight
              position={[0, -0.35, 0]}
              color={tint}
              intensity={intensity}
              distance={13}
              decay={2}
            />
          )}
        </group>
      ))}

      {/* Sector neon bounce washes (interim until probe GI) */}
      {FIXTURES.fills.map(([x, y, z, tint, intensity, distance], i) => (
        <pointLight
          key={`fill-${i}`}
          position={[x, y, z]}
          color={tint}
          intensity={intensity}
          distance={distance}
          decay={2}
        />
      ))}

      {/* Reactor: magenta alarm spot from above + the core's own hot glow.
          Shadowless: a wide soft wash reads identically without occlusion,
          and its shadow map was a full extra render pass per frame. */}
      <spotLight
        position={[0, 7.5, -9]}
        angle={Math.PI / 2.5}
        penumbra={0.9}
        intensity={140}
        distance={20}
        decay={2}
        color="#ff007f"
      />
      <pointLight
        // Shadow-casting so GodraysNode can raymarch its shafts (the effect
        // requires the driving light to cast shadows). 512² cube faces are
        // plenty for soft volumetric occlusion.
        ref={(light) => {
          sceneLights.reactor = light ?? undefined
        }}
        position={[0, 3.9, -8.8]}
        color="#ff6a2a"
        intensity={55}
        distance={15}
        decay={2}
        castShadow={!isMobile}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.0015}
      />

      {/* Console task lighting comes from the consoles' own emissive trim +
          bloom; their dedicated point lights were cut in the 2026-07-08
          light-count consolidation (fps floor). The sector fills above keep
          role color pooling on the plating near each console. */}
    </>
  )
}
export default Lighting
