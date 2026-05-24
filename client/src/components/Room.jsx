import { useMemo } from 'react'
import { RigidBody } from '@react-three/rapier'
import { ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { generateFloorTextures, generateWallTextures, generateReactorTextures } from '../utils/textureGenerator'

export const Room = () => {
  // Memoize textures so they aren't generated/re-instantiated on every re-render
  const floorTextures = useMemo(() => generateFloorTextures(), [])
  const wallTextures = useMemo(() => generateWallTextures(), [])
  const reactorTextures = useMemo(() => generateReactorTextures(), [])

  const neonBlueMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#00f3ff',
    emissive: '#00f3ff',
    emissiveIntensity: 2.2,
    roughness: 0.1,
  }), [])

  const neonRedMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff007f',
    emissive: '#ff007f',
    emissiveIntensity: 2.2,
    roughness: 0.1,
  }), [])

  return (
    <group>
      {/* 1. Floor (Static RigidBody) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, -0.1, 0]}>
          <boxGeometry args={[20, 0.2, 20]} />
          <meshStandardMaterial 
            {...floorTextures}
            bumpScale={0.08}
          />
        </mesh>
      </RigidBody>

      {/* Contact Shadows for soft ambient occlusion underneath characters & props */}
      <ContactShadows
        position={[0, 0.015, 0]}
        opacity={0.8}
        scale={20}
        blur={1.6}
        far={3}
      />

      {/* Decorative Floor Grid Lines */}
      <gridHelper args={[20, 30, '#00f3ff', '#07090e']} position={[0, 0.01, 0]} />

      {/* 2. Walls (Static Colliders) */}
      {/* Back Wall */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[0, 4, -10]}>
          <boxGeometry args={[20, 8, 0.5]} />
          <meshStandardMaterial {...wallTextures} />
        </mesh>
      </RigidBody>

      {/* Left Wall */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[-10, 4, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[20, 8, 0.5]} />
          <meshStandardMaterial {...wallTextures} />
        </mesh>
      </RigidBody>

      {/* Right Wall */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[10, 4, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <boxGeometry args={[20, 8, 0.5]} />
          <meshStandardMaterial {...wallTextures} />
        </mesh>
      </RigidBody>

      {/* Front Wall (behind camera) - Physics only, mesh invisible so camera can see inside */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 4, 10]} rotation={[0, Math.PI, 0]}>
        <mesh visible={false}>
          <boxGeometry args={[20, 8, 0.5]} />
        </mesh>
      </RigidBody>

      {/* 3. The Security Grid / Laser Fence Partition */}
      {/* Splits room into left (Engineer) and right (Technician) sectors */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 2, 0]}>
          <boxGeometry args={[0.2, 4, 16]} />
          <meshPhysicalMaterial
            color="#00f3ff"
            emissive="#00f3ff"
            emissiveIntensity={1.5}
            transparent
            opacity={0.18}
            roughness={0.05}
            metalness={0.1}
            transmission={0.95} // High glass refraction
            thickness={1.5}
            clearcoat={1.0}
            clearcoatRoughness={0.02}
          />
        </mesh>
        
        {/* Neon Posts along the partition */}
        <mesh position={[0, 2, -8]}>
          <cylinderGeometry args={[0.1, 0.1, 4]} />
          <primitive object={neonBlueMaterial} attach="material" />
        </mesh>
        <mesh position={[0, 2, 8]}>
          <cylinderGeometry args={[0.1, 0.1, 4]} />
          <primitive object={neonBlueMaterial} attach="material" />
        </mesh>
      </RigidBody>

      {/* 4. Reactor Core Cylinder (Static decorative object at the back center) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow position={[0, 4, -9]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 8, 32]} />
          <meshStandardMaterial {...reactorTextures} />
        </mesh>
        {/* Glow Core */}
        <mesh position={[0, 4, -7.4]}>
          <boxGeometry args={[0.8, 6, 0.2]} />
          <primitive object={neonRedMaterial} attach="material" />
        </mesh>
      </RigidBody>

      {/* Ceiling decorative piping / trusses */}
      <mesh position={[0, 7.8, 0]}>
        <boxGeometry args={[20, 0.2, 0.6]} />
        <meshStandardMaterial {...wallTextures} />
      </mesh>
      <mesh position={[0, 7.8, -5]}>
        <boxGeometry args={[20, 0.2, 0.6]} />
        <meshStandardMaterial {...wallTextures} />
      </mesh>
      <mesh position={[0, 7.8, 5]}>
        <boxGeometry args={[20, 0.2, 0.6]} />
        <meshStandardMaterial {...wallTextures} />
      </mesh>

      {/* Neon ceiling lighting conduits running along the beams */}
      <mesh position={[0, 7.68, -4.9]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 20, 8]} />
        <primitive object={neonBlueMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 7.68, 4.9]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 20, 8]} />
        <primitive object={neonBlueMaterial} attach="material" />
      </mesh>
    </group>
  )
}
export default Room
