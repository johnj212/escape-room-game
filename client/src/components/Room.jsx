import { useMemo, useLayoutEffect } from 'react'
import { RigidBody } from '@react-three/rapier'
import { Deck } from '../render/Deck'
import { containmentGlassMaterial, neonMaterial } from '../render/materials'

// Room = physics shell + the security partition. All visual detail lives in
// render/Deck.jsx (procedural, seeded, TSL materials — Pillar B). Colliders
// here are collision-only: their meshes are invisible so the deck geometry
// is the single visual source of truth.
export const Room = () => {
  // Deeper cyan + matte-er than the reactor glass: edge-on in the hero
  // framing the partition is the frame's central beam — it should read as
  // sector-cyan energy, not a blown-white specular runway (delta round 1).
  const glassMat = useMemo(
    () => containmentGlassMaterial({ tint: '#2ec8e6', opacity: 0.22 }),
    []
  )
  // 0.9: under the bloom threshold (1.0). Since the doorway fix the +z post
  // stands 2.7 m in front of the hero camera — at 2.2 it bloomed into a
  // frame-wide white column that obscured the deck center (delta round 3 #1).
  const postMat = useMemo(() => neonMaterial({ tint: '#00f3ff', intensity: 0.9 }), [])

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
      <RigidBody type="fixed" colliders="cuboid" includeInvisible>
        <mesh visible={false} position={[0, -0.1, 0]}>
          <boxGeometry args={[20, 0.2, 20]} />
        </mesh>
      </RigidBody>

      {/* 2. Wall colliders (visuals: Deck wall panelling). The front wall
          (z=+10, behind the camera) has always been physics-only so the
          third-person camera can see into the room — that now holds for all
          four: visible={false}, collision-only. */}
      <RigidBody type="fixed" colliders="cuboid" includeInvisible>
        <mesh visible={false} position={[0, 4, -10]}>
          <boxGeometry args={[20, 8, 0.5]} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" includeInvisible>
        <mesh visible={false} position={[-10, 4, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[20, 8, 0.5]} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" includeInvisible>
        <mesh visible={false} position={[10, 4, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <boxGeometry args={[20, 8, 0.5]} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" includeInvisible position={[0, 4, 10]} rotation={[0, Math.PI, 0]}>
        <mesh visible={false}>
          <boxGeometry args={[20, 8, 0.5]} />
        </mesh>
      </RigidBody>

      {/* 3. Security partition: splits Engineer (left) / Technician (right)
          sectors — the physical enforcement of P1's information/action split.
          It spans z ∈ [-6, 6], NOT the full room: the deck's only crossing is
          the doorway past its +z end, and the overseer's scanner pedestal sits
          in that doorway at [0, 8.5]. At the original 16 m length the gap left
          roughly 0.3 m of walkable floor between pedestal and back wall — P1
          and P2 never require a character to cross, so nothing caught it, but
          P3 seeds mirror mounts on BOTH sides and the Technician must get
          through. 12 m leaves a clear ~1.5 m doorway either side of the
          pedestal without weakening the sector split (the consoles sit at z=0,
          and role separation is enforced by the role gates regardless). */}
      <RigidBody type="fixed" colliders="cuboid" includeInvisible>
        <mesh position={[0, 2, 0]} material={glassMat}>
          <boxGeometry args={[0.2, 4, 12]} />
        </mesh>
        <mesh position={[0, 2, -6]} material={postMat}>
          <cylinderGeometry args={[0.1, 0.1, 4, 16]} />
        </mesh>
        <mesh position={[0, 2, 6]} material={postMat}>
          <cylinderGeometry args={[0.1, 0.1, 4, 16]} />
        </mesh>
      </RigidBody>

      {/* 4. Reactor collider (visuals: Deck reactor assembly at z=-9) */}
      <RigidBody type="fixed" colliders="cuboid" includeInvisible>
        <mesh visible={false} position={[0, 4, -9]}>
          <cylinderGeometry args={[1.8, 1.8, 8, 12]} />
        </mesh>
      </RigidBody>
    </group>
  )
}
export default Room
