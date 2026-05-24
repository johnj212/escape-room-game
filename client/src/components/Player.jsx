import { useRef, useEffect } from 'react'
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
        const newPos = [translation.x, translation.y, translation.z]
        updatePlayerPosition(id, newPos, rotation)
        
        // Emit to server
        emitMovement(newPos, rotation)
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
        {/* Futuristic capsule mesh representation of player */}
        <mesh castShadow position={[0, 0, 0]}>
          <capsuleGeometry args={[0.3, 0.6, 8, 16]} />
          <meshStandardMaterial
            color={color}
            roughness={0.2}
            metalness={0.8}
            emissive={isControlling ? color : '#000000'}
            emissiveIntensity={0.2}
          />
        </mesh>
        
        {/* Glow Ring visor */}
        <mesh position={[0, 0.4, 0.15]}>
          <boxGeometry args={[0.35, 0.1, 0.1]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.5}
          />
        </mesh>
        
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

