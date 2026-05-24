import { useRef, useState, useEffect, useMemo } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { generateWallTextures } from '../utils/textureGenerator'

export const WirePuzzle = () => {
  const isSolo = useGameStore((state) => state.isSolo)
  const activePlayerId = useGameStore((state) => state.activePlayerId)
  const players = useGameStore((state) => state.players)
  const puzzleState = useGameStore((state) => state.puzzleState)
  const toggleSwitch = useGameStore((state) => state.toggleSwitch)
  const gamePhase = useGameStore((state) => state.gamePhase)

  const [nearSwitchBoard, setNearSwitchBoard] = useState(false)
  const [showSwitchBoardUI, setShowSwitchBoardUI] = useState(false)
  
  const hologramRef = useRef(null)
  const scanLineRef = useRef(null)

  const consoleTextures = useMemo(() => generateWallTextures(), [])

  // Floating hologram and scanline animation
  useFrame((state) => {
    if (hologramRef.current) {
      hologramRef.current.position.y = 1.75 + Math.sin(state.clock.getElapsedTime() * 2) * 0.08
      hologramRef.current.rotation.y = state.clock.getElapsedTime() * 0.4
    }
    if (scanLineRef.current) {
      // Slide scanner up and down
      scanLineRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 3.5) * 0.42
    }
  })

  // Detect player proximity to switch board
  useFrame(() => {
    const activePlayer = players[activePlayerId]
    if (!activePlayer || !activePlayer.position) return

    const [px, py, pz] = activePlayer.position
    // Terminal position: [5, 0.5, 0]
    const distance = Math.sqrt((px - 5) ** 2 + (pz - 0) ** 2)
    
    // Check if player has role of technician (or solo mode) to access the board
    const isTechnician = activePlayer.role === 'technician' || isSolo
    
    if (distance < 2 && isTechnician && gamePhase === 'playing') {
      setNearSwitchBoard(true)
    } else {
      setNearSwitchBoard(false)
      setShowSwitchBoardUI(false)
    }
  })

  // Listen to spacebar to open terminal when near
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ' || e.key.toLowerCase() === 'e') {
        if (nearSwitchBoard) {
          setShowSwitchBoardUI(prev => !prev)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nearSwitchBoard])

  // Get color hex values
  const getColorHex = (colorName) => {
    switch (colorName) {
      case 'red': return '#ff3131'
      case 'blue': return '#00f3ff'
      case 'green': return '#39ff14'
      case 'yellow': return '#ffdf00'
      default: return '#ffffff'
    }
  }

  return (
    <group>
      {/* 1. Hologram Console (Left side - Engineer's Sector) */}
      <RigidBody type="fixed" colliders="cuboid" position={[-5, 0.5, 0]}>
        {/* Beveled Base Plate */}
        <mesh castShadow receiveShadow position={[0, -0.45, 0]}>
          <boxGeometry args={[1.7, 0.1, 1.7]} />
          <meshStandardMaterial color="#0b0d12" roughness={0.4} metalness={0.9} />
        </mesh>
        
        {/* Main Textured Column */}
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[1.3, 0.8, 1.3]} />
          <meshStandardMaterial {...consoleTextures} />
        </mesh>

        {/* Emissive Trim around console collar */}
        <mesh position={[0, 0.41, 0]}>
          <boxGeometry args={[1.34, 0.03, 1.34]} />
          <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={1.5} />
        </mesh>

        {/* Upper console top plate */}
        <mesh castShadow receiveShadow position={[0, 0.44, 0]}>
          <boxGeometry args={[1.4, 0.04, 1.4]} />
          <meshStandardMaterial color="#0d0e12" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Emissive projector core ring */}
        <mesh position={[0, 0.465, 0]}>
          <cylinderGeometry args={[0.42, 0.45, 0.02, 24]} />
          <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={2.5} />
        </mesh>
      </RigidBody>

      {/* Floating Holographic display */}
      <group ref={hologramRef} position={[-5, 1.8, 0]}>
        {/* Volumetric glow projection cone from pedestal to hologram */}
        <mesh position={[0, -0.7, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.7, 0.1, 1.1, 24, 1, true]} />
          <meshBasicMaterial
            color="#00f3ff"
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Semi-transparent projector screen */}
        <mesh>
          <planeGeometry args={[1.6, 1.0]} />
          <meshBasicMaterial
            color="#00f3ff"
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        
        {/* Border frame */}
        <lineSegments>
          <edgesGeometry attach="geometry" args={[new THREE.PlaneGeometry(1.6, 1.0)]} />
          <lineBasicMaterial attach="material" color="#00f3ff" linewidth={2} />
        </lineSegments>

        {/* Scanning grid line */}
        <mesh ref={scanLineRef} position={[0, 0, 0.04]}>
          <boxGeometry args={[1.58, 0.015, 0.01]} />
          <meshBasicMaterial color="#00f3ff" transparent opacity={0.65} />
        </mesh>

        {/* 3 Hologram Wires reflecting the cipher */}
        {puzzleState.cipher.map((color, index) => (
          <mesh key={index} position={[0, 0.3 - index * 0.3, 0.03]}>
            <boxGeometry args={[1.2, 0.08, 0.02]} />
            <meshBasicMaterial color={getColorHex(color)} transparent opacity={0.8} blending={THREE.AdditiveBlending} />
          </mesh>
        ))}

        <Html position={[0, 0.6, 0]} center>
          <div style={{
            fontFamily: 'Orbitron',
            fontSize: '0.65rem',
            color: '#00f3ff',
            textShadow: '0 0 5px rgba(0,243,255,0.8)',
            letterSpacing: '1px',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase'
          }}>
            SECURITY OVERRIDE CODE
          </div>
        </Html>
      </group>

      {/* 2. Switch Board Console (Right side - Technician's Sector) */}
      <RigidBody type="fixed" colliders="cuboid" position={[5, 0.5, 0]}>
        {/* Beveled Base Plate */}
        <mesh castShadow receiveShadow position={[0, -0.45, 0]}>
          <boxGeometry args={[1.7, 0.1, 1.7]} />
          <meshStandardMaterial color="#0b0d12" roughness={0.4} metalness={0.9} />
        </mesh>

        {/* Column */}
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[1.3, 0.8, 1.3]} />
          <meshStandardMaterial {...consoleTextures} />
        </mesh>

        {/* Collar trim */}
        <mesh position={[0, 0.41, 0]}>
          <boxGeometry args={[1.34, 0.03, 1.34]} />
          <meshStandardMaterial color="#ff007f" emissive="#ff007f" emissiveIntensity={1.5} />
        </mesh>

        {/* Top Plate */}
        <mesh castShadow receiveShadow position={[0, 0.44, 0]}>
          <boxGeometry args={[1.4, 0.04, 1.4]} />
          <meshStandardMaterial color="#0d0e12" roughness={0.3} metalness={0.8} />
        </mesh>
        
        {/* Board Face panel tilted */}
        <mesh position={[0, 0.52, 0]} rotation={[-Math.PI / 8, 0, 0]}>
          <boxGeometry args={[1.3, 0.08, 1.1]} />
          <meshStandardMaterial color="#1a1c24" roughness={0.5} metalness={0.7} />
        </mesh>
        
        {/* Emissive terminal monitor screen on panel */}
        <mesh position={[0, 0.57, -0.22]} rotation={[-Math.PI / 8, 0, 0]}>
          <boxGeometry args={[1.0, 0.01, 0.45]} />
          <meshStandardMaterial 
            color="#ff007f" 
            emissive="#ff007f" 
            emissiveIntensity={0.6} 
            roughness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* 4 physical wire sockets with colored LED rings on the Switch Board face */}
      {['red', 'blue', 'green', 'yellow'].map((colorName, idx) => {
        const isSwitchedOn = puzzleState.currentSwitches[colorName]
        const colorHex = getColorHex(colorName)
        
        // Position sockets on the tilted face (console center is at x=5, y=0.5, z=0)
        const xOffset = 5 - 0.45 + idx * 0.3
        const zOffset = 0.15
        const yOffset = 0.565
        
        return (
          <group key={colorName} position={[xOffset, yOffset, zOffset]} rotation={[-Math.PI / 8, 0, 0]}>
            {/* Socket Metal Outer Ring */}
            <mesh castShadow>
              <cylinderGeometry args={[0.07, 0.07, 0.04, 12]} />
              <meshStandardMaterial color="#111318" roughness={0.4} metalness={0.95} />
            </mesh>
            {/* LED Status Ring */}
            <mesh position={[0, 0.021, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.015, 12]} />
              <meshStandardMaterial
                color={colorHex}
                emissive={colorHex}
                emissiveIntensity={isSwitchedOn ? 2.5 : 0.2}
                roughness={0.1}
              />
            </mesh>
          </group>
        )
      })}


      {/* Proximity HUD Alert & HTML Switch Board Overlay */}
      {nearSwitchBoard && (
        <Html position={[5, 1.5, 0]} center>
          {!showSwitchBoardUI ? (
            <div className="glass-panel" style={{
              padding: '10px 15px',
              fontFamily: 'Orbitron',
              fontSize: '0.8rem',
              whiteSpace: 'nowrap',
              pointerEvents: 'auto',
              cursor: 'pointer'
            }} onClick={() => setShowSwitchBoardUI(true)}>
              Press <span style={{ color: '#00f3ff', fontWeight: 'bold' }}>SPACE / TAP</span> to access grid
            </div>
          ) : (
            <div className="glass-panel puzzle-mobile-overlay" style={{
              width: '280px',
              height: 'auto',
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '15px'
            }}>
              <div className="puzzle-mobile-header" style={{ border: 'none', margin: 0, padding: 0 }}>
                <span className="puzzle-mobile-title" style={{ fontSize: '0.9rem' }}>REACTOR GRID TOGGLE</span>
                <button className="puzzle-mobile-close" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => setShowSwitchBoardUI(false)}>X</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {Object.keys(puzzleState.currentSwitches).map((color) => {
                  const isActive = puzzleState.currentSwitches[color]
                  return (
                    <div
                      key={color}
                      className={`puzzle-wire-card ${isActive ? 'active' : ''}`}
                      style={{ padding: '10px', minHeight: '60px' }}
                      onClick={() => toggleSwitch(color)}
                    >
                      <div className="puzzle-wire-color-indicator" style={{
                        backgroundColor: getColorHex(color),
                        width: '20px',
                        height: '20px'
                      }}></div>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'Orbitron', textTransform: 'uppercase' }}>
                        {color}
                      </span>
                    </div>
                  )
                })}
              </div>

              {puzzleState.solved && (
                <div style={{
                  color: '#39ff14',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  fontFamily: 'Orbitron'
                }}>
                  GRID SYNCHRONIZED
                </div>
              )}
            </div>
          )}
        </Html>
      )}
    </group>
  )
}
export default WirePuzzle
