import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'

export const Room = () => {
  // Create stylized procedural textures/materials for a high-fidelity cyberpunk aesthetic
  
  // Metallic plating for floor and terminals
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: '#1a1d24',
    roughness: 0.4,
    metalness: 0.8,
  })

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: '#0f1115',
    roughness: 0.5,
    metalness: 0.9,
  })

  const neonBlueMaterial = new THREE.MeshStandardMaterial({
    color: '#00f3ff',
    emissive: '#00f3ff',
    emissiveIntensity: 1.5,
    roughness: 0.1,
  })

  const neonRedMaterial = new THREE.MeshStandardMaterial({
    color: '#ff007f',
    emissive: '#ff007f',
    emissiveIntensity: 1.5,
    roughness: 0.1,
  })

  // Grid texture for floor
  return (
    <group>
      {/* 1. Floor (Static RigidBody) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, -0.1, 0]}>
          <boxGeometry args={[20, 0.2, 20]} />
          <primitive object={floorMaterial} attach="material" />
        </mesh>
      </RigidBody>

      {/* Decorative Floor Grid Lines */}
      <gridHelper args={[20, 20, '#00f3ff', '#1f2533']} position={[0, 0.01, 0]} />

      {/* 2. Walls (Static Colliders) */}
      {/* Back Wall */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[0, 4, -10]}>
          <boxGeometry args={[20, 8, 0.5]} />
          <primitive object={wallMaterial} attach="material" />
        </mesh>
      </RigidBody>

      {/* Left Wall */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[-10, 4, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[20, 8, 0.5]} />
          <primitive object={wallMaterial} attach="material" />
        </mesh>
      </RigidBody>

      {/* Right Wall */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[10, 4, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <boxGeometry args={[20, 8, 0.5]} />
          <primitive object={wallMaterial} attach="material" />
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
            emissiveIntensity={0.6}
            transparent
            opacity={0.15}
            roughness={0.1}
            transmission={0.9} // Glass refraction
            thickness={1}
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
          <cylinderGeometry args={[1.5, 1.5, 8, 16]} />
          <primitive object={wallMaterial} attach="material" />
        </mesh>
        {/* Glow Core */}
        <mesh position={[0, 4, -7.4]}>
          <boxGeometry args={[0.8, 6, 0.2]} />
          <primitive object={neonRedMaterial} attach="material" />
        </mesh>
      </RigidBody>

      {/* Ceiling decorative piping / trusses */}
      <mesh position={[0, 7.8, 0]}>
        <boxGeometry args={[20, 0.2, 0.5]} />
        <primitive object={wallMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 7.8, -5]}>
        <boxGeometry args={[20, 0.2, 0.5]} />
        <primitive object={wallMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 7.8, 5]}>
        <boxGeometry args={[20, 0.2, 0.5]} />
        <primitive object={wallMaterial} attach="material" />
      </mesh>
    </group>
  )
}
export default Room
