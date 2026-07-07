import { useMemo, useLayoutEffect } from 'react'
import { RigidBody } from '@react-three/rapier'
import { Deck } from '../render/Deck'
import { containmentGlassMaterial, neonMaterial } from '../render/materials'

// Room = physics shell + the security partition. All visual detail lives in
// render/Deck.jsx (procedural, seeded, TSL materials — Pillar B). Colliders
// here are collision-only: their meshes are invisible so the deck geometry
// is the single visual source of truth.
export const Room = () => {
  const glassMat = useMemo(() => containmentGlassMaterial(), [])
  const postMat = useMemo(() => neonMaterial({ tint: '#00f3ff', intensity: 2.2 }), [])

  useLayoutEffect(() => {
    return () => {
      glassMat.dispose()
      postMat.dispose()
    }
  }, [glassMat, postMat])

  return (
    <group>
      {/* Procedural deck visuals (floor plating, walls, pipes, reactor, ...) */}
      <Deck />

      {/* 1. Floor collider (visuals: Deck floor plates) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh visible={false} position={[0, -0.1, 0]}>
          <boxGeometry args={[20, 0.2, 20]} />
        </mesh>
      </RigidBody>

      {/* 2. Wall colliders (visuals: Deck wall panelling). The front wall
          (z=+10, behind the camera) has always been physics-only so the
          third-person camera can see into the room — that now holds for all
          four: visible={false}, collision-only. */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh visible={false} position={[0, 4, -10]}>
          <boxGeometry args={[20, 8, 0.5]} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh visible={false} position={[-10, 4, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[20, 8, 0.5]} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh visible={false} position={[10, 4, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <boxGeometry args={[20, 8, 0.5]} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" position={[0, 4, 10]} rotation={[0, Math.PI, 0]}>
        <mesh visible={false}>
          <boxGeometry args={[20, 8, 0.5]} />
        </mesh>
      </RigidBody>

      {/* 3. Security partition: splits Engineer (left) / Technician (right)
          sectors — the physical enforcement of P1's information/action split. */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 2, 0]} material={glassMat}>
          <boxGeometry args={[0.2, 4, 16]} />
        </mesh>
        <mesh position={[0, 2, -8]} material={postMat}>
          <cylinderGeometry args={[0.1, 0.1, 4, 16]} />
        </mesh>
        <mesh position={[0, 2, 8]} material={postMat}>
          <cylinderGeometry args={[0.1, 0.1, 4, 16]} />
        </mesh>
      </RigidBody>

      {/* 4. Reactor collider (visuals: Deck reactor assembly at z=-9) */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh visible={false} position={[0, 4, -9]}>
          <cylinderGeometry args={[1.8, 1.8, 8, 12]} />
        </mesh>
      </RigidBody>
    </group>
  )
}
export default Room
