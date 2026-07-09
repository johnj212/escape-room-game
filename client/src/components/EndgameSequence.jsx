import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { alarmEscalation, alarmPulse, usePrefersReducedMotion } from '../render/materials'

// Diegetic win/lose sequences (§3.17, Pillar F) — the deck itself reacts,
// not just the UIOverlays.jsx DOM modal. Deliberately geometry-light (a
// handful of small meshes, ZERO new lights — the reactor's shadow-casting
// point light is the only one the budget allows, docs/DEVIATIONS.md D-5) so
// it costs nothing measurable against the 60 fps / 2M-tri floor. Every
// reactive value here is a plain per-frame mutation on a THREE material/
// object3D — same pattern components/ScannerStations.jsx uses for its
// pedestal materials — so none of this needs a TSL node graph.
//
// - Meltdown (gamePhase 'lose'): an unlit, additive-blended sphere wrapped
//   around the reactor pushes its color past 1.0 so it clears the post
//   stack's bloom threshold (render/PostFX.jsx, `bloom(beauty, ..., 1.0)`)
//   and blooms out red, with a capped, non-strobing pulse.
// - Escape-pod launch (gamePhase 'win'): the two blast-door leaves on the
//   front wall (z=+10 — the wall behind the player's spawn, Room.jsx; the
//   only wall that has always been camera-passable) slide open and a
//   green-glowing pod rises into the gap — legible as "launch" in a single
//   still frame. The deck calms: `alarmEscalation` returns 0 for 'win', so
//   Lighting.jsx's fixtures fade back to their cool nominal palette in the
//   same frame budget.
// - Both respect `prefers-reduced-motion` (materials.js `usePrefersReduced-
//   Motion`, shared with Lighting.jsx): motion is held at the end state
//   instead of animating, and the pulse itself (the strobe hazard) is
//   forced flat. Audio is out of scope — deferred stretch goal (brief §9),
//   not a stub.

const DOOR_CLOSED_X = 0.82
const DOOR_OPEN_X = 2.6
const DOOR_Z = 9.6
const DOOR_Y = 2.6
const REACTOR_WASH_POS = new THREE.Vector3(0, 3.9, -8.8)

export const EndgameSequence = () => {
  const reducedMotion = usePrefersReducedMotion()

  const leftDoorRef = useRef(null)
  const rightDoorRef = useRef(null)
  const podRef = useRef(null)
  const washRef = useRef(null)

  const doorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#161b24', roughness: 0.45, metalness: 0.75 }),
    []
  )
  const trimMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#00f3ff',
        emissive: '#00f3ff',
        emissiveIntensity: 1.2,
        roughness: 0.2,
      }),
    []
  )
  const podMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#123018',
        emissive: '#39ff14',
        emissiveIntensity: 0,
        roughness: 0.25,
        metalness: 0.4,
      }),
    []
  )
  const washMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ff2010',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  )

  useFrame((state, delta) => {
    const { timer, gamePhase } = useGameStore.getState()
    const e = alarmEscalation(timer, gamePhase)
    const pulse = alarmPulse(state.clock.elapsedTime, e, reducedMotion)
    // Clamp to <=1 (STATUS.md gotcha): unclamped lerp factors overshoot and
    // oscillate forever on WebGPU pipeline-compile delta spikes.
    const k = Math.min(1, 3 * delta)

    // -- meltdown wash: invisible at nominal, blooms red at critical/lose.
    const targetOpacity = gamePhase === 'lose' ? 0.55 : e * 0.22
    washMat.opacity = THREE.MathUtils.lerp(washMat.opacity, targetOpacity * pulse, k)
    const boost = gamePhase === 'lose' ? 2.4 : 1 + e * 1.2
    washMat.color.setRGB(boost, 0.12 * boost, 0.06 * boost)
    if (washRef.current) {
      const targetScale = gamePhase === 'lose' ? 1 + Math.max(0, pulse - 1) * 0.4 : 1
      const nextScale = THREE.MathUtils.lerp(washRef.current.scale.x, targetScale, k)
      washRef.current.scale.setScalar(nextScale)
    }

    // -- blast door + pod: sealed/dark until 'win', then opens and lights up.
    const openT = gamePhase === 'win' ? 1 : 0
    const doorK = reducedMotion ? 1 : Math.min(1, 1.6 * delta)
    if (leftDoorRef.current && rightDoorRef.current) {
      const targetX = THREE.MathUtils.lerp(DOOR_CLOSED_X, DOOR_OPEN_X, openT)
      leftDoorRef.current.position.x = THREE.MathUtils.lerp(
        leftDoorRef.current.position.x,
        -targetX,
        doorK
      )
      rightDoorRef.current.position.x = THREE.MathUtils.lerp(
        rightDoorRef.current.position.x,
        targetX,
        doorK
      )
    }
    if (podRef.current) {
      const targetY = DOOR_Y - 0.4 + openT * 0.6
      podRef.current.position.y = THREE.MathUtils.lerp(podRef.current.position.y, targetY, doorK)
    }
    const podPulse = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 2) * 0.3
    const targetGlow = openT * (2.6 + podPulse)
    podMat.emissiveIntensity = THREE.MathUtils.lerp(podMat.emissiveIntensity, targetGlow, k)
    trimMat.color.set(gamePhase === 'win' ? '#39ff14' : '#00f3ff')
    trimMat.emissive.set(gamePhase === 'win' ? '#39ff14' : '#00f3ff')
  })

  return (
    <group>
      {/* Meltdown wash: unlit sphere wrapping the reactor, invisible except
          during escalation/lose. Low-poly — a bloom carrier, not a detail
          surface. */}
      <mesh ref={washRef} position={REACTOR_WASH_POS} material={washMat}>
        <sphereGeometry args={[2.6, 12, 8]} />
      </mesh>

      {/* Blast door: two leaves on the front wall (z=+10, Room.jsx) — the
          entrance the player spawned through, sealed until win. */}
      <mesh ref={leftDoorRef} position={[-DOOR_CLOSED_X, DOOR_Y, DOOR_Z]} material={doorMat}>
        <boxGeometry args={[1.5, 4.6, 0.3]} />
      </mesh>
      <mesh ref={rightDoorRef} position={[DOOR_CLOSED_X, DOOR_Y, DOOR_Z]} material={doorMat}>
        <boxGeometry args={[1.5, 4.6, 0.3]} />
      </mesh>
      <mesh position={[0, DOOR_Y + 2.35, DOOR_Z]} material={trimMat}>
        <boxGeometry args={[3.4, 0.12, 0.32]} />
      </mesh>

      {/* Escape pod: dark until win, then glows and rises into the doorway
          gap — legible as "launch" in a single still frame. */}
      <mesh ref={podRef} position={[0, DOOR_Y - 0.4, DOOR_Z - 0.4]} material={podMat}>
        <capsuleGeometry args={[0.55, 1.4, 4, 10]} />
      </mesh>
    </group>
  )
}
export default EndgameSequence
