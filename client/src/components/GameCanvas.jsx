import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree, addAfterEffect } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import * as THREE from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { useGameStore } from '../store/gameStore'
import { Lighting } from '../render/Lighting'
import { PostFX } from '../render/PostFX'
import { Room } from './Room'
import { Player } from './Player'
import { WirePuzzle } from './WirePuzzle'

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

  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={isMobile ? [1, 1.2] : [1, 2]}
      // WebGPU-only render path (Pillar E / §1): fiber v9 awaits this async
      // factory; the factory must await renderer.init() itself (adapter +
      // device acquisition) — verified against installed fiber source,
      // docs/R3F-WEBGPU-NOTES.md 2026-07-07. No WebGL fallback exists; the
      // capability gate in App.jsx guarantees WebGPU before this mounts.
      gl={async (props) => {
        const renderer = new WebGPURenderer({
          ...props,
          antialias: !isMobile,
        })
        await renderer.init()
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.35
        return renderer
      }}
      camera={{ position: [0, 5, 8], fov: 60 }}
    >
      {/* Fog starts beyond the far wall distance (camera-to-wall runs
          15-20 m) — the old 10..25 band was crushing every wall to the fog
          color, which read as black (Pillar C). */}
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#070a12', 16, 46]} />

      {/* Lighting rig (render/Lighting.jsx): CSM key light, fixture-driven
          fills, sector washes, reactor glow — Pillars C + F. */}
      <Lighting isMobile={isMobile} />

      <Physics gravity={[0, -9.81, 0]}>
        <Room />
        <WirePuzzle />
        
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

      <CameraFollow />
      <PerfProbe />

      {/* Post stack (render/PostFX.jsx): GTAO + bloom + CA + vignette on
          three/webgpu PostProcessing + TSL display nodes, profile-gated. */}
      <PostFX isMobile={isMobile} />

      {/* Low-spec helpers to adapt performance */}
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </Canvas>
  )
}
export default GameCanvas
