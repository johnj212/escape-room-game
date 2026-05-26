import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

export const Player = ({ id, playerInfo, inputRef, emitMovement }) => {
  const activePlayerId = useGameStore((state) => state.activePlayerId)
  const myPlayerId = useGameStore((state) => state.myPlayerId)
  const isSolo = useGameStore((state) => state.isSolo)
  const updatePlayerPosition = useGameStore((state) => state.updatePlayerPosition)
  
  const rbRef = useRef(null)
  const meshRef = useRef(null)
  const droidRef = useRef(null)
  
  const isActive = activePlayerId === id
  // In multiplayer, you only control your own player. In solo, you control the active swap player.
  const isControlling = isSolo ? isActive : myPlayerId === id

  // Pick color based on player role
  const getRoleColor = (role) => {
    switch (role) {
      case 'engineer': return '#00f3ff' // Cyan
      case 'technician': return '#ff007f' // Pink
      case 'overseer': return '#ffdf00' // Yellow
      default: return '#ffffff'
    }
  }
  const color = getRoleColor(playerInfo.role)

  // Get default role spawn positions for rescue snap
  const getSpawnPosition = (role) => {
    switch (role) {
      case 'engineer': return [-3, 1.2, -2]
      case 'technician': return [3, 1.2, -2]
      case 'overseer': return [-2, 1.2, 4]
      default: return [0, 1.2, 0]
    }
  }

  // Sync initial position
  useEffect(() => {
    if (rbRef.current && playerInfo.position) {
      const [x, y, z] = playerInfo.position
      rbRef.current.setTranslation({ x, y, z }, true)
    }
  }, [rbRef])

  useFrame((state, delta) => {
    if (!rbRef.current) return

    if (isControlling) {
      // Local input handling
      const inputs = inputRef.current
      const linvel = rbRef.current.linvel()
      const velY = linvel && typeof linvel.y === 'number' && !isNaN(linvel.y) ? linvel.y : 0
      
      // Calculate movement vector
      let moveX = 0
      let moveZ = 0

      // Keyboard support
      moveX += inputs.right - inputs.left
      moveZ += inputs.backward - inputs.forward

      // Mobile joystick support
      if (inputs.joystickMove.x !== 0 || inputs.joystickMove.y !== 0) {
        moveX = inputs.joystickMove.x
        moveZ = -inputs.joystickMove.y // Reverse joystick y for WebGL z coords
      }

      // Normalize speed
      const speed = 4
      const velX = moveX * speed
      const velZ = moveZ * speed

      // Apply linear velocity in Rapier (keep gravity y velocity)
      rbRef.current.setLinvel({ x: velX, y: velY, z: velZ }, true)

      // Apply rotation if moving
      if (moveX !== 0 || moveZ !== 0) {
        const targetRotation = Math.atan2(moveX, moveZ)
        // Smoothly rotate mesh
        if (meshRef.current) {
          meshRef.current.rotation.y = THREE.MathUtils.lerp(
            meshRef.current.rotation.y,
            targetRotation,
            10 * delta
          )
        }
      }

      // Sync local state to Zustand store so HUD and other elements know
      const translation = rbRef.current.translation()
      const rotation = meshRef.current ? meshRef.current.rotation.y : 0
      
      if (translation && !isNaN(translation.x) && !isNaN(translation.y) && !isNaN(translation.z)) {
        // Safety Fall Rescue: If player clips below floor (Y < -1.0), snap back to spawn
        if (translation.y < -1.0) {
          console.warn(`[Player] ${playerInfo.name} fell through floor (Y: ${translation.y}). Rescuing...`)
          const spawnPos = getSpawnPosition(playerInfo.role)
          rbRef.current.setTranslation({ x: spawnPos[0], y: spawnPos[1], z: spawnPos[2] }, true)
          rbRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
          updatePlayerPosition(id, spawnPos, rotation)
          emitMovement(spawnPos, rotation)
        } else {
          const newPos = [translation.x, translation.y, translation.z]
          updatePlayerPosition(id, newPos, rotation)
          
          // Emit to server
          emitMovement(newPos, rotation)
        }
      }
    } else {
      // Remote player or inactive player (in solo mode) - smoothly lerp position
      const targetPos = playerInfo.position
      const targetRot = playerInfo.rotation
      
      if (targetPos && rbRef.current) {
        const currentPos = rbRef.current.translation()
        const nextX = THREE.MathUtils.lerp(currentPos.x, targetPos[0], 10 * delta)
        const nextY = THREE.MathUtils.lerp(currentPos.y, targetPos[1], 10 * delta)
        const nextZ = THREE.MathUtils.lerp(currentPos.z, targetPos[2], 10 * delta)
        
        rbRef.current.setTranslation({ x: nextX, y: nextY, z: nextZ }, true)
        
        // Reset velocity to prevent remote avatars from falling through floor due to physics friction
        rbRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      }
      
      if (targetRot !== undefined && meshRef.current) {
        meshRef.current.rotation.y = THREE.MathUtils.lerp(
          meshRef.current.rotation.y,
          targetRot,
          10 * delta
        )
      }
    }

    // Floating bobbing and stabilizer rotation inside the droid group
    if (droidRef.current) {
      const elapsed = state.clock.getElapsedTime()
      // Unique frequency/phase offset per droid based on role name
      const phaseOffset = id.charCodeAt(0)
      droidRef.current.position.y = Math.sin(elapsed * 2.5 + phaseOffset) * 0.05
      
      const stabilizer = droidRef.current.getObjectByName('stabilizer')
      if (stabilizer) {
        stabilizer.rotation.z = elapsed * 1.5
      }

      // Slightly flicker engine nozzle light
      const engineLight = droidRef.current.getObjectByName('engineLight')
      if (engineLight) {
        engineLight.intensity = (isControlling ? 2.0 : 1.0) + Math.sin(elapsed * 12) * 0.3
      }
    }
  })

  return (
    <RigidBody
      ref={rbRef}
      type={isControlling ? "dynamic" : "kinematicPosition"}
      colliders={false}
      enabledRotations={[false, false, false]} // Keep capsule upright
      position={playerInfo.position || [0, 0.5, 0]}
    >
      <CapsuleCollider args={[0.3, 0.3]} />
      
      <group ref={meshRef}>
        <group ref={droidRef}>
          {/* Central Mech Sphere Core */}
          <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial
              color="#0d0e12"
              roughness={0.35}
              metalness={0.9}
            />
          </mesh>

          {/* Curved Outer Stabilizer Ring (spinning) */}
          <mesh name="stabilizer" castShadow position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.27, 0.03, 8, 24]} />
            <meshStandardMaterial
              color="#3a4050"
              roughness={0.15}
              metalness={0.95}
            />
          </mesh>

          {/* Role Color Visor / Camera Lens */}
          <mesh position={[0, 0.22, 0.17]}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={2.5}
              roughness={0.1}
            />
          </mesh>
          
          {/* Lens Shield Visor Hood */}
          <mesh position={[0, 0.25, 0.11]} rotation={[Math.PI / 6, 0, 0]}>
            <boxGeometry args={[0.2, 0.08, 0.12]} />
            <meshStandardMaterial
              color="#1a1c24"
              roughness={0.4}
              metalness={0.85}
            />
          </mesh>

          {/* Jet Thruster base */}
          <mesh castShadow position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.07, 0.04, 0.1, 8]} />
            <meshStandardMaterial 
              color="#2a303f" 
              roughness={0.4} 
              metalness={0.9} 
            />
          </mesh>

          {/* Glowing Jet Engine flame plume */}
          <mesh position={[0, -0.06, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.045, 0.15, 8]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.65}
            />
          </mesh>

          {/* Side Thrusters */}
          <group position={[-0.3, 0.2, 0]}>
            <mesh castShadow rotation={[0, 0, -Math.PI / 10]}>
              <cylinderGeometry args={[0.015, 0.025, 0.08, 8]} />
              <meshStandardMaterial color="#1a1c24" roughness={0.3} metalness={0.8} />
            </mesh>
          </group>
          <group position={[0.3, 0.2, 0]}>
            <mesh castShadow rotation={[0, 0, Math.PI / 10]}>
              <cylinderGeometry args={[0.015, 0.025, 0.08, 8]} />
              <meshStandardMaterial color="#1a1c24" roughness={0.3} metalness={0.8} />
            </mesh>
          </group>

          {/* Cyber Antenna */}
          <mesh castShadow position={[-0.08, 0.4, -0.08]} rotation={[Math.PI / 6, 0, -Math.PI / 12]}>
            <cylinderGeometry args={[0.005, 0.005, 0.22, 6]} />
            <meshStandardMaterial color="#0b0d10" roughness={0.2} metalness={0.9} />
          </mesh>

          {/* Dynamic local lighting reflecting hover plasma */}
          <pointLight
            name="engineLight"
            position={[0, -0.2, 0]}
            intensity={isControlling ? 1.8 : 0.8}
            distance={2.5}
            decay={2}
            color={color}
          />
        </group>
        
        {/* Status indicator tag */}
        <Html distanceFactor={6} position={[0, 1.2, 0]} center>
          <div className={`hud-player-badge ${playerInfo.role} ${isControlling ? 'active-player' : ''}`}>
            <div className="hud-player-avatar-dot"></div>
            <span className="hud-player-role">
              {playerInfo.name} {isControlling && '(YOU)'}
            </span>
          </div>
        </Html>
      </group>
    </RigidBody>
  )
}
export default Player

