import { useEffect, useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CSMShadowNode } from 'three/examples/jsm/csm/CSMShadowNode.js'
import { neonMaterial, alarmEscalation, alarmPulse, usePrefersReducedMotion } from './materials'
import { sceneLights } from './lightRegistry'
import { useGameStore } from '../store/gameStore'

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
  // Intensity/reach raised 2026-07-09 (Phase-2 gate, Pillar C): the side
  // walls sit near the fills' old `distance` cutoff, reading ~0 — the hero
  // frame's edge bands pixel-measured 98%/55% below the 5%-sRGB bar
  // (tools/pixel-check.mjs). Same light count, zero per-pixel cost.
  fills: [
    [-7, 4.5, 0, '#00f3ff', 24, 17], // Engineer wall + console wash
    [7, 4.5, 0, '#ff007f', 36, 19], // Technician wall + console wash
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

// Alarm escalation (Pillar F, §3.17): as the meltdown timer burns down, the
// reactor glow, the alarm spot and the two sector fills shift hue toward red
// and pulse harder — driven entirely by mutating the existing Light
// instances' `.color`/`.intensity` each frame (no new lights, no TSL —
// same "plain per-frame mutation" pattern ScannerStations.jsx uses for its
// pedestal materials). `alarmEscalation`/`alarmPulse` (render/materials.js)
// are the single source of truth also read by components/EndgameSequence.jsx
// so the two systems can't drift. Reads the store via `getState()` inside
// useFrame (not a subscription) — this must run every frame regardless of
// React re-renders, and a subscription would double-drive it.
const REACTOR_BASE_COLOR = new THREE.Color('#ff6a2a')
const REACTOR_ALARM_COLOR = new THREE.Color('#ff1a1a')
const ALARM_SPOT_BASE_COLOR = new THREE.Color('#ff007f')
const ALARM_SPOT_CRITICAL_COLOR = new THREE.Color('#ff0000')
const FILL_CRITICAL_COLOR = new THREE.Color('#ff2020')

const AlarmEscalation = ({ reactorRef, alarmSpotRef, fillRefs, fillBaseColors }) => {
  const reducedMotion = usePrefersReducedMotion()
  const scratch = useRef(new THREE.Color()).current

  useFrame((state, delta) => {
    const { timer, gamePhase } = useGameStore.getState()
    const e = alarmEscalation(timer, gamePhase)
    const pulse = alarmPulse(state.clock.elapsedTime, e, reducedMotion)
    // Clamp to <=1: WebGPU pipeline-compile frame hitches spike delta, and an
    // unclamped lerp factor overshoots and oscillates forever (STATUS.md
    // gotcha log).
    const k = Math.min(1, 2.5 * delta)

    const reactor = reactorRef.current
    if (reactor) {
      scratch.copy(REACTOR_BASE_COLOR).lerp(REACTOR_ALARM_COLOR, e)
      reactor.color.lerp(scratch, k)
      const target = (55 + e * 90) * pulse
      reactor.intensity = THREE.MathUtils.lerp(reactor.intensity, target, k)
    }

    const alarmSpot = alarmSpotRef.current
    if (alarmSpot) {
      scratch.copy(ALARM_SPOT_BASE_COLOR).lerp(ALARM_SPOT_CRITICAL_COLOR, e)
      alarmSpot.color.lerp(scratch, k)
      const target = (140 + e * 220) * pulse
      alarmSpot.intensity = THREE.MathUtils.lerp(alarmSpot.intensity, target, k)
    }

    fillRefs.current.forEach((light, i) => {
      if (!light) return
      const base = fillBaseColors[i]
      scratch.copy(base).lerp(FILL_CRITICAL_COLOR, e * 0.7)
      light.color.lerp(scratch, k)
      const baseIntensity = base.__intensity ?? light.intensity
      const target = baseIntensity * (1 + e * 0.6) * (0.85 + pulse * 0.15)
      light.intensity = THREE.MathUtils.lerp(light.intensity, target, k)
    })
  })

  return null
}

export const Lighting = ({ isMobile = false }) => {
  const reactorRef = useRef(null)
  const alarmSpotRef = useRef(null)
  const fillRefs = useRef([])
  // Base intensities captured once so the escalation target is always
  // relative to the authored value, never compounding onto its own output.
  const fillBaseColors = useMemo(
    () =>
      FIXTURES.fills.map(([, , , tint, intensity]) => {
        const c = new THREE.Color(tint)
        c.__intensity = intensity
        return c
      }),
    []
  )
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
      {/* Raised 2026-07-08 after the Phase-1 gate-verifier pixel-measured
          37–77% near-black side-wall area post-D-5 (Pillar C flag). Same
          light count — intensity-only, zero per-pixel cost. */}
      {/* Raised again 2026-07-09 (Phase-2 gate-verifier, Pillar C): right
          hero band measured 98.5% below 5%-sRGB luminance vs the reference's
          37% (tools/pixel-check.mjs, --band 0.85,1.0). Ground tint warmed so
          the lift carries the reactor-red wall color instead of graying it. */}
      <hemisphereLight args={['#46587e', '#2a2430', 8.5]} />
      <ambientLight intensity={2.9} color="#3a5560" />

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
          ref={(light) => {
            fillRefs.current[i] = light
          }}
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
        ref={alarmSpotRef}
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
          reactorRef.current = light
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

      {/* Alarm escalation (Pillar F): mutates the fixtures above every
          frame, zero new lights/draw calls. */}
      <AlarmEscalation
        reactorRef={reactorRef}
        alarmSpotRef={alarmSpotRef}
        fillRefs={fillRefs}
        fillBaseColors={fillBaseColors}
      />
    </>
  )
}
export default Lighting
