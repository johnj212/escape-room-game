import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree, addAfterEffect } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
// AdaptiveDpr was removed 2026-07-08: with a dpr clamp below the device's
// ratio it re-asserts its own dpr every frame, and each write resizes the
// canvas → full WebGPU pipeline rebuild → 1 fps. The Phase-4 quality ladder
// will drive dpr through fiber's performance API instead.
import { AdaptiveEvents } from '@react-three/drei'
import * as THREE from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { useGameStore } from '../store/gameStore'
import { Lighting } from '../render/Lighting'
import { PostFX } from '../render/PostFX'
import { Room } from './Room'
import { Player } from './Player'
import { WirePuzzle } from './WirePuzzle'
import { ScannerStations } from './ScannerStations'
import { LaserArray } from './LaserArray'

// Harness instrumentation: exposes live render stats + a scene-ready flag on
// `window` for the verification tooling (tools/perf-probe.mjs, PerfHud).
//
// Sampling happens in fiber's addAfterEffect — synchronously after
// `gl.render()` in the same rAF callback — NOT in useFrame: useFrame runs
// before the render, and three's WebGPURenderer runs an internal Animation
// rAF loop of its own that calls `info.reset()` every tick
// (three/src/renderers/common/Animation.js:75), so pre-render reads race the
// reset and report zeros. Per-frame draws are `info.render.drawCalls` under
// WebGPU (`calls` is cumulative since app start — Info.js).
const PerfProbe = () => {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const sample = { frames: 0, last: performance.now(), fps: 0 }
    return addAfterEffect(() => {
      const now = performance.now()
      sample.frames += 1
      const dt = now - sample.last
      if (dt >= 500) {
        sample.fps = Math.round((sample.frames * 1000) / dt)
        sample.frames = 0
        sample.last = now
      }

      const render = gl?.info?.render
      window.__PERF__ = {
        fps: sample.fps,
        drawCalls: render?.drawCalls ?? render?.calls ?? 0,
        triangles: render?.triangles ?? 0,
        // Last-write timestamp: lets the harness distinguish "loop alive,
        // stats zero" from "loop stalled" without instrumenting the page.
        t: Math.round(now),
      }
      if (!window.__SCENE_READY__) window.__SCENE_READY__ = true
    })
  }, [gl])

  return null
}

// Hero vantage (`?hero=1`): a fixed cinematic camera framing the deck the
// way reference/sector9_deck_hero.png does — reactor centered on the back
// wall, consoles flanking, ceiling trusses in the top third. Used by
// tools/capture-hero.mjs for the reference-delta loop so the shot judges the
// deck, not the patch of floor under the gameplay follow-camera. Set every
// frame (cheap) so nothing else can drift it between settle frames.
const HERO_CAMERA = {
  // On the partition line (x=0): the sector glass reads edge-on as a thin
  // energy divider down the frame center — same role as the reference's
  // floor-crossing beam — with the reactor dead center and a console per side.
  position: new THREE.Vector3(0, 4.6, 8.7),
  lookAt: new THREE.Vector3(0, 2.9, -9),
}

const HeroCamera = () => {
  const { camera } = useThree()
  useFrame(() => {
    camera.position.copy(HERO_CAMERA.position)
    camera.lookAt(HERO_CAMERA.lookAt)
  })
  return null
}

// Custom Camera Controller to smoothly track the active player
const CameraFollow = () => {
  const { camera } = useThree()
  const activePlayerId = useGameStore((state) => state.activePlayerId)
  const players = useGameStore((state) => state.players)
  const targetOffset = useRef(new THREE.Vector3(0, 5, 8)) // Cyberpunk high-angle follow

  useFrame((state, delta) => {
    const activePlayer = players[activePlayerId]
    if (!activePlayer || !activePlayer.position) return

    const [px, py, pz] = activePlayer.position
    if (isNaN(px) || isNaN(py) || isNaN(pz)) return
    
    // Smoothly calculate target camera position
    const targetCamX = px + targetOffset.current.x
    const targetCamY = py + targetOffset.current.y
    const targetCamZ = pz + targetOffset.current.z

    if (isNaN(camera.position.x) || isNaN(camera.position.y) || isNaN(camera.position.z)) {
      camera.position.set(targetCamX, targetCamY, targetCamZ)
    } else {
      // Clamp the lerp factor: on frame hitches (e.g. WebGPU pipeline
      // compiles) delta spikes push 5*delta past 1, which makes lerp
      // OVERSHOOT the target and oscillate — the camera never settles and
      // 3D-projected HTML overlays jitter forever.
      camera.position.lerp(
        new THREE.Vector3(targetCamX, targetCamY, targetCamZ),
        Math.min(1, 5 * delta)
      )
    }
    
    // Camera looks slightly ahead of player
    const lookAtPos = new THREE.Vector3(px, py, pz)
    camera.lookAt(lookAtPos)
  })

  return null
}

export const GameCanvas = ({ inputRef, emitMovement }) => {
  const players = useGameStore((state) => state.players)

  // Detect mobile
  const isMobile = /Mobi|Android/i.test(navigator.userAgent)

  // Reference-delta hero framing (capture tooling only; no gameplay effect).
  const isHeroView = new URLSearchParams(window.location.search).has('hero')

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      // Desktop dpr clamp 1.5 (§2 allows dpr ≤ 2): with the D-5 internal
      // scene scale this sets the whole post chain's pixel budget — measured
      // 2026-07-08 as the difference between ~28 and ~50 fps at 1440p-class
      // output. Retina text/HUD stays DOM-rendered at native dpr.
      dpr={isMobile ? [1, 1.2] : [1, 1.5]}
      // WebGPU-only render path (Pillar E / §1): fiber v9 awaits this async
      // factory; the factory must await renderer.init() itself (adapter +
      // device acquisition) — verified against installed fiber source,
      // docs/R3F-WEBGPU-NOTES.md 2026-07-07. No WebGL fallback exists; the
      // capability gate in App.jsx guarantees WebGPU before this mounts.
      gl={async (props) => {
        const renderer = new WebGPURenderer({
          ...props,
          // MSAA off: 4x samples on the PostFX scene pass (MRT color+normal)
          // at dpr-2 desktop res was the single biggest fill-rate cost —
          // measured 2026-07-07 during the fps-floor turn. Post-stack CA +
          // bloom already soften edges; FXAA is the seam if aliasing shows.
          antialias: false,
        })
        await renderer.init()
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.35
        return renderer
      }}
      camera={{ position: [0, 5, 8], fov: 60 }}
    >
      {/* Fog band 13..42 (delta round 2, ambient haze): pulled in from 16..46
          so the far half of the deck carries visible atmosphere, with a
          slightly LIGHTER fog color so hazed surfaces drift toward airglow,
          not black — the old 10..25 band crushed walls to fog-black (Pillar
          C); wall band re-pixel-checked after this change. Linear fog, not
          FogExp2: the exp2 variant measured ~1 fps (per-pixel exp() in every
          material) in the 2026-07-08 re-bisect. */}
      {/* Fog color lifted #0b101b → #1c2136 (2026-07-09, Phase-2 gate,
          Pillar C): the far right hero band measured 98% below 5%-sRGB
          luminance and light-intensity raises didn't move it — those pixels
          are fog-dominated, so only the fog color itself can lift them.
          Doubles as the reference's visible-haze airglow (DELTA #3). */}
      <color attach="background" args={['#0a0d16']} />
      <fog attach="fog" args={['#1c2136', 13, 42]} />

      {/* Lighting rig (render/Lighting.jsx): CSM key light, fixture-driven
          fills, sector washes, reactor glow — Pillars C + F. */}
      <Lighting isMobile={isMobile} />

      {/* render/EnvironmentProbe.jsx (baked scene-radiance → environment)
          is NOT mounted: functionally correct but drops 60 fps → 1 fps
          under the current stack (suspected per-frame pipeline churn when
          scene.environment is combined with the PostFX scene pass + cube
          shadows). Tracked in STATUS.md with D-4 — needs its own debugging
          round before the fps floor can afford it. */}

      <Physics gravity={[0, -9.81, 0]}>
        <Room />
        <WirePuzzle />
        <ScannerStations />
        <LaserArray />

        {/* Render all players in the room */}
        {Object.values(players).map((p) => (
          <Player
            key={p.id}
            id={p.id}
            playerInfo={p}
            inputRef={inputRef}
            emitMovement={emitMovement}
          />
        ))}
      </Physics>

      {isHeroView ? <HeroCamera /> : <CameraFollow />}
      <PerfProbe />

      {/* Post stack (render/PostFX.jsx): GTAO + bloom + CA + vignette on
          three/webgpu PostProcessing + TSL display nodes, profile-gated. */}
      <PostFX isMobile={isMobile} />

      <AdaptiveEvents />
    </Canvas>
  )
}
export default GameCanvas
