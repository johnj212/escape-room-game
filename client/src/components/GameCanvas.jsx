import { useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { OrbitControls, AdaptiveDpr, AdaptiveEvents, Environment } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { Room } from './Room'
import { Player } from './Player'
import { WirePuzzle } from './WirePuzzle'

// Harness instrumentation: exposes live render stats + a scene-ready flag on `window`
// for the verification tooling (tools/perf-probe.mjs, tools/capture-hero.mjs). Reads
// renderer.info.render, which is identical for WebGL now and WebGPU at the Phase-1 swap.
// This is the data layer of the §5 performance HUD; the visual HUD is a later deliverable.
const PerfProbe = () => {
  const gl = useThree((state) => state.gl)
  const sample = useRef({ frames: 0, last: performance.now(), fps: 0 })

  useFrame(() => {
    const now = performance.now()
    const s = sample.current
    s.frames += 1
    const dt = now - s.last
    if (dt >= 500) {
      s.fps = Math.round((s.frames * 1000) / dt)
      s.frames = 0
      s.last = now
    }

    const render = gl?.info?.render
    window.__PERF__ = {
      fps: s.fps,
      drawCalls: render?.calls ?? 0,
      triangles: render?.triangles ?? 0,
    }
    if (!window.__SCENE_READY__) window.__SCENE_READY__ = true
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
      camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 5 * delta)
    }
    
    // Camera looks slightly ahead of player
    const lookAtPos = new THREE.Vector3(px, py, pz)
    camera.lookAt(lookAtPos)
  })

  return null
}

export const GameCanvas = ({ inputRef, emitMovement }) => {
  const players = useGameStore((state) => state.players)
  const isSolo = useGameStore((state) => state.isSolo)
  const myPlayerId = useGameStore((state) => state.myPlayerId)
  
  // Detect mobile
  const isMobile = /Mobi|Android/i.test(navigator.userAgent)

  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={isMobile ? [1, 1.2] : [1, 2]}
      gl={{
        antialias: !isMobile,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      camera={{ position: [0, 5, 8], fov: 60 }}
    >
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', 10, 25]} />
      
      {/* PBR reflection probe environment */}
      <Environment preset="city" intensity={0.12} />
      
      {/* Dynamic Cyberpunk Lighting */}
      <ambientLight intensity={0.15} color="#00f3ff" />
      
      <directionalLight
        castShadow={!isMobile}
        position={[8, 12, 6]}
        intensity={1.0}
        color="#c9d6ff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0005}
      />
      
      {/* Emissive reactor spot light */}
      <spotLight
        position={[0, 7.5, -9]}
        angle={Math.PI / 2.5}
        penumbra={0.9}
        intensity={6}
        distance={20}
        decay={2}
        color="#ff007f"
        castShadow={!isMobile}
        shadow-bias={-0.0002}
      />

      {/* Local lighting above the Engineer's Hologram Console */}
      <pointLight
        position={[-5, 1.6, 0]}
        intensity={2.5}
        distance={6}
        decay={2}
        color="#00f3ff"
        castShadow={!isMobile}
      />

      {/* Local lighting above the Technician's Switch Board */}
      <pointLight
        position={[5, 1.6, 0]}
        intensity={2.5}
        distance={6}
        decay={2}
        color="#ff007f"
        castShadow={!isMobile}
      />

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

      {/* Post-Processing Effects (Disabled on Mobile for performance) */}
      {!isMobile && (
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.15}
            luminanceSmoothing={0.7}
            intensity={1.2}
          />
          <Vignette eskil={false} offset={0.2} darkness={1.05} />
          <ChromaticAberration
            offset={new THREE.Vector2(0.0008, 0.0008)}
          />
        </EffectComposer>
      )}

      {/* Low-spec helpers to adapt performance */}
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </Canvas>
  )
}
export default GameCanvas
