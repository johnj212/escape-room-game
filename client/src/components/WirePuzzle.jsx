import { useRef, useState, useEffect } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

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

  // Floating hologram animation
  useFrame((state) => {
    if (hologramRef.current) {
      hologramRef.current.position.y = 1.8 + Math.sin(state.clock.getElapsedTime() * 2) * 0.1
      hologramRef.current.rotation.y = state.clock.getElapsedTime() * 0.5
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
        {/* Terminal Pedestal */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.5, 1, 1.5]} />
          <meshStandardMaterial color="#1f2533" roughness={0.5} metalness={0.8} />
        </mesh>

        {/* Emissive projector core */}
        <mesh position={[0, 0.51, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.05, 16]} />
          <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={1} />
        </mesh>
      </RigidBody>

      {/* Floating Holographic display */}
      <group ref={hologramRef} position={[-5, 1.8, 0]}>
        {/* Semi-transparent projector screen */}
        <mesh>
          <planeGeometry args={[1.6, 1.0]} />
          <meshBasicMaterial
            color="#00f3ff"
            transparent
            opacity={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
        
        {/* Border frame */}
        <lineSegments>
          <edgesGeometry attach="geometry" args={[new THREE.PlaneGeometry(1.6, 1.0)]} />
          <lineBasicMaterial attach="material" color="#00f3ff" linewidth={2} />
        </lineSegments>

        {/* 3 Hologram Wires reflecting the cipher */}
        {puzzleState.cipher.map((color, index) => (
          <mesh key={index} position={[0, 0.3 - index * 0.3, 0.05]}>
            <boxGeometry args={[1.2, 0.1, 0.05]} />
            <meshBasicMaterial color={getColorHex(color)} transparent opacity={0.8} />
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
        {/* Pedestal */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.5, 1, 1.5]} />
          <meshStandardMaterial color="#1f2533" roughness={0.5} metalness={0.8} />
        </mesh>
        
        {/* Board Face panel tilted */}
        <mesh position={[0, 0.52, 0]} rotation={[-Math.PI / 8, 0, 0]}>
          <boxGeometry args={[1.3, 0.1, 1.1]} />
          <meshStandardMaterial color="#0b0d12" roughness={0.6} metalness={0.5} />
        </mesh>
      </RigidBody>

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
