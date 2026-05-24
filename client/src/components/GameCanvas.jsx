import { useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { OrbitControls, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { Room } from './Room'
import { Player } from './Player'
import { WirePuzzle } from './WirePuzzle'

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
      shadows={!isMobile}
      dpr={isMobile ? [1, 1.2] : [1, 2]}
      gl={{ antialias: !isMobile }}
      camera={{ position: [0, 5, 8], fov: 60 }}
    >
      <color attach="background" args={['#06070a']} />
      <fog attach="fog" args={['#06070a', 10, 25]} />
      
      {/* Dynamic Cyberpunk Lighting */}
      <ambientLight intensity={0.2} color="#00f3ff" />
      
      <directionalLight
        castShadow={!isMobile}
        position={[5, 10, 5]}
        intensity={1.2}
        color="#ffffff"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      
      {/* Emissive reactor spot light */}
      <spotLight
        position={[0, 8, 0]}
        angle={Math.PI / 3}
        penumbra={0.8}
        intensity={3}
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
      
      {/* Low-spec helpers to adapt performance */}
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </Canvas>
  )
}
export default GameCanvas
