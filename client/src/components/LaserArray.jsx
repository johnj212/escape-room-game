import { useRef, useState, useEffect, useMemo, useLayoutEffect } from 'react'
import { RigidBody } from '@react-three/rapier'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { laserStationAccess, RANGE_HYSTERESIS } from '../game/roleGates'
import { neonMaterial } from '../render/materials'
import {
  EMITTER_POS,
  RECEIVER_POS,
  RECEIVER_RADIUS,
  MIRROR_WIDTH,
  MIRROR_COUNT,
  STATION_RANGE,
  MAX_BOUNCES,
  traceLaser,
  emitterHeading,
  mirrorAngle,
  isApertureOpen,
  apertureRemaining,
  lockoutRemaining,
} from '../../../shared/laserPuzzle.js'

// Puzzle 3 — Laser Deflection Array (Pillar A, all 3 roles).
//
// The emitter (Engineer), the three mirror mounts (Technician), and the
// receiver aperture (Overseer) are procedural props whose live pose is
// driven directly from shared/laserPuzzle.js state — the SAME machine the
// server runs. The beam is rendered from traceLaser(...).points every
// frame; there is no separate client simulation of where the beam goes
// (one source of truth, per the brief).
//
// Controls (documented in the HUD objective text too):
//   Q / E — the universal "rotate" pair, gated by proximity + role exactly
//     like every other console on the deck. Standing at the emitter as the
//     Engineer, Q/E steers the heading -1/+1 step. Standing at whichever
//     mirror is in range as the Technician, Q/E rotates THAT mirror -1/+1
//     step (proximity auto-targets the nearest in-range mirror — no
//     separate "select" input is needed because STATION_RANGE keeps at
//     most one mirror reachable at a time, the same proximity-only pattern
//     every other station in the deck already uses).
//   E (tap) / mobile USE button — opens the receiver aperture, same
//     single-tap idiom as arming a P2 scanner.
//   Mobile: a ◀ / ▶ button pair (shown only at stage 3) mirrors Q/E for
//     the emitter/mirror steer-and-rotate actions; the existing USE button
//     mirrors E for the receiver (Pillar E: every action reachable on
//     touch AND keyboard).

if (typeof window !== 'undefined') {
  window.__LASER_STATIONS__ = { EMITTER_POS, RECEIVER_POS }
}

const BEAM_Y = 1.0 // fixed render height for the emitter/mirror/receiver plane
const BEAM_THICKNESS = 0.06

const ROLE_TINTS = {
  engineer: '#00f3ff',
  technician: '#ff007f',
  overseer: '#ffdf00',
}

// -- shared status panel (mirrors ScannerStations' Html readout) -----------

function StationPanel({ testId, x, z, tint, title, children }) {
  return (
    <Html position={[x, 1.9, z]} center>
      <div
        data-testid={testId}
        className="glass-panel"
        style={{
          padding: '8px 14px',
          fontFamily: 'var(--font-hud)',
          fontSize: '0.72rem',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          letterSpacing: '1px',
          color: tint,
          border: `1px solid ${tint}55`,
          pointerEvents: 'none',
        }}
      >
        <div style={{ marginBottom: '3px' }}>{title}</div>
        {children}
      </div>
    </Html>
  )
}

// -- emitter (Engineer) ------------------------------------------------------

function EmitterStation({ p3, access, now }) {
  const barrelRef = useRef(null)
  const ringRef = useRef(null)
  const tint = ROLE_TINTS.engineer
  const online = p3.status !== 'locked'
  const lockedOut = p3.status === 'lockout'
  const solved = p3.status === 'solved'
  const heading = emitterHeading(p3.emitterStep)

  useFrame((state) => {
    const barrel = barrelRef.current
    // Gimbal yaw: local +X is the housing's "forward"; rotation.y = -heading
    // aligns it with the emitter's (cos h, sin h) world-XZ ray direction —
    // the identical convention Beam uses for each traced segment, so the
    // barrel always visibly points down the live beam.
    if (barrel) barrel.rotation.y = -heading

    const ring = ringRef.current?.material
    if (!ring) return
    const t = state.clock.getElapsedTime()
    let intensity
    if (solved) intensity = 2.2
    else if (!online) intensity = 0.15
    else if (lockedOut) intensity = 1.6 + Math.sin(t * 14) * 1.4
    else {
      const near = access !== 'out-of-range'
      intensity = (near ? 1.9 : 0.9) + Math.sin(t * 2.4) * 0.35
    }
    ring.emissiveIntensity = intensity
  })

  const showPanel = access !== 'out-of-range'
  const showPrompt = access === 'operate' && online && !lockedOut

  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid" position={[EMITTER_POS[0], BEAM_Y, EMITTER_POS[1]]}>
        <mesh receiveShadow position={[0, -0.4, 0]}>
          <cylinderGeometry args={[0.42, 0.5, 0.4, 8]} />
          <meshStandardMaterial color="#0b0d12" roughness={0.4} metalness={0.9} />
        </mesh>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.36, 0.35, 8]} />
          <meshStandardMaterial color="#1a2230" roughness={0.45} metalness={0.78} />
        </mesh>
        <mesh ref={ringRef} position={[0, 0.24, 0]}>
          <torusGeometry args={[0.32, 0.035, 8, 24]} />
          <meshStandardMaterial
            color={lockedOut ? '#ff3131' : tint}
            emissive={lockedOut ? '#ff3131' : solved ? '#39ff14' : tint}
            emissiveIntensity={1}
            roughness={0.2}
          />
        </mesh>
        {/* Housing detail: cooling fins + a conduit stub + breaker box
            (delta round 3 #2 — the array is hero geometry, §4) */}
        {[-0.32, 0.32].map((x) => (
          <mesh key={x} castShadow position={[x, -0.18, 0]}>
            <boxGeometry args={[0.08, 0.3, 0.5]} />
            <meshStandardMaterial color="#10141d" roughness={0.4} metalness={0.85} />
          </mesh>
        ))}
        <mesh receiveShadow position={[0, -0.45, -0.42]}>
          <boxGeometry args={[0.34, 0.26, 0.18]} />
          <meshStandardMaterial color="#1a2230" roughness={0.5} metalness={0.75} />
        </mesh>
        <mesh position={[0, -0.28, -0.4]} rotation={[Math.PI / 4, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.32, 6]} />
          <meshStandardMaterial color="#12161f" roughness={0.5} metalness={0.8} />
        </mesh>
        {/* Gimballed barrel — the piece that visibly yaws with emitterStep */}
        <group ref={barrelRef} position={[0, 0.05, 0]}>
          <mesh castShadow position={[0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.11, 0.15, 0.75, 8]} />
            <meshStandardMaterial color="#10141d" roughness={0.35} metalness={0.85} />
          </mesh>
          <mesh position={[0.78, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.08, 8]} />
            <meshStandardMaterial
              color={tint}
              emissive={tint}
              emissiveIntensity={solved ? 2.5 : 1.4}
              roughness={0.15}
            />
          </mesh>
        </group>
      </RigidBody>

      {showPanel && (
        <StationPanel testId="laser-panel-emitter" x={EMITTER_POS[0]} z={EMITTER_POS[1]} tint={tint} title="EMITTER GIMBAL">
          {!online && !solved && (
            <div data-testid="laser-offline-emitter" style={{ color: '#8f9cae' }}>
              OFFLINE :: TRI-VECTOR LOCK REQUIRED
            </div>
          )}
          {solved && <div style={{ color: '#39ff14' }}>BEAM LOCKED ON RECEIVER</div>}
          {online && lockedOut && (
            <div data-testid="laser-lockout-emitter" style={{ color: '#ff3131' }}>
              SENSOR OVERLOAD — {Math.ceil(lockoutRemaining(p3, now) / 1000)}s
            </div>
          )}
          {online && !lockedOut && !solved && access === 'role-locked' && (
            <div data-testid="laser-role-lock-emitter" style={{ color: '#ff3131' }}>
              ROLE LOCK — ENGINEER PALM REQUIRED
            </div>
          )}
          {showPrompt && (
            <div data-testid="laser-prompt-emitter" style={{ color: 'var(--text-primary, #e8eef7)' }}>
              Q / ◀ steer left · E / ▶ steer right
            </div>
          )}
        </StationPanel>
      )}
    </group>
  )
}

// -- mirrors (Technician) ----------------------------------------------------

function MirrorStation({ index, pos, p3, access, now }) {
  const groupRef = useRef(null)
  const panelRef = useRef(null)
  const tint = ROLE_TINTS.technician
  const online = p3.status !== 'locked'
  const lockedOut = p3.status === 'lockout'
  const solved = p3.status === 'solved'
  const angle = mirrorAngle(p3.mirrorSteps[index])

  useFrame((state) => {
    const group = groupRef.current
    // Same rotation.y = -angle convention as the emitter/Beam: local +X
    // becomes the mirror's reflective face tangent (cos a, sin a).
    if (group) group.rotation.y = -angle

    // State feedback lives on the glow FRAME around the face, not the face
    // itself: a full-face emissive read as a flat unlit slab in the hero
    // frame (delta round 3 #2) — the face is now a real mirror surface.
    const panel = panelRef.current?.material
    if (!panel) return
    const t = state.clock.getElapsedTime()
    let intensity
    if (!online) intensity = 0.2
    else if (lockedOut) intensity = 1.3 + Math.sin(t * 14) * 1.1
    else {
      const near = access !== 'out-of-range'
      intensity = (near ? 1.7 : 0.85) + Math.sin(t * 2.2) * 0.3
    }
    panel.emissiveIntensity = intensity
  })

  const showPanel = access !== 'out-of-range'
  const showPrompt = access === 'operate' && online && !lockedOut

  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid" position={[pos[0], BEAM_Y, pos[1]]}>
        <mesh receiveShadow position={[0, -0.55, 0]}>
          <cylinderGeometry args={[0.2, 0.26, 0.45, 8]} />
          <meshStandardMaterial color="#12161f" roughness={0.5} metalness={0.75} />
        </mesh>
        {/* Yoke column: pedestal → gimbal (the slab used to float) */}
        <mesh receiveShadow position={[0, -0.32, 0]}>
          <boxGeometry args={[0.14, 0.55, 0.14]} />
          <meshStandardMaterial color="#1a2230" roughness={0.45} metalness={0.8} />
        </mesh>
        <group ref={groupRef}>
          {/* Reflective face: bright metal, barely-there emissive */}
          <mesh castShadow>
            <boxGeometry args={[MIRROR_WIDTH, 0.5, 0.03]} />
            <meshStandardMaterial
              color="#dfe8f2"
              emissive="#5fd0ff"
              emissiveIntensity={0.15}
              roughness={0.05}
              metalness={0.98}
            />
          </mesh>
          {/* Glow frame behind the face — carries the animated state light */}
          <mesh ref={panelRef} position={[0, 0, -0.025]}>
            <boxGeometry args={[MIRROR_WIDTH + 0.09, 0.59, 0.02]} />
            <meshStandardMaterial
              color="#10141d"
              emissive={lockedOut ? '#ff3131' : '#5fd0ff'}
              emissiveIntensity={1}
              roughness={0.3}
              metalness={0.6}
            />
          </mesh>
          {/* Back armature: spine rib + two mount brackets */}
          <mesh castShadow position={[0, 0, -0.07]}>
            <boxGeometry args={[0.12, 0.62, 0.06]} />
            <meshStandardMaterial color="#12161f" roughness={0.5} metalness={0.8} />
          </mesh>
          <mesh position={[-MIRROR_WIDTH / 2 + 0.06, 0, -0.055]}>
            <boxGeometry args={[0.05, 0.56, 0.05]} />
            <meshStandardMaterial color="#1a2230" roughness={0.45} metalness={0.8} />
          </mesh>
          <mesh position={[MIRROR_WIDTH / 2 - 0.06, 0, -0.055]}>
            <boxGeometry args={[0.05, 0.56, 0.05]} />
            <meshStandardMaterial color="#1a2230" roughness={0.45} metalness={0.8} />
          </mesh>
        </group>
      </RigidBody>

      {showPanel && (
        <StationPanel testId={`laser-panel-mirror${index}`} x={pos[0]} z={pos[1]} tint={tint} title={`DEFLECTOR MOUNT ${index + 1}`}>
          {!online && (
            <div data-testid={`laser-offline-mirror${index}`} style={{ color: '#8f9cae' }}>
              OFFLINE :: TRI-VECTOR LOCK REQUIRED
            </div>
          )}
          {solved && <div style={{ color: '#39ff14' }}>BEAM LOCKED ON RECEIVER</div>}
          {online && lockedOut && (
            <div data-testid={`laser-lockout-mirror${index}`} style={{ color: '#ff3131' }}>
              SENSOR OVERLOAD — {Math.ceil(lockoutRemaining(p3, now) / 1000)}s
            </div>
          )}
          {online && !lockedOut && !solved && access === 'role-locked' && (
            <div data-testid={`laser-role-lock-mirror${index}`} style={{ color: '#ff3131' }}>
              ROLE LOCK — TECHNICIAN PALM REQUIRED
            </div>
          )}
          {showPrompt && (
            <div data-testid={`laser-prompt-mirror${index}`} style={{ color: 'var(--text-primary, #e8eef7)' }}>
              Q / ◀ rotate CCW · E / ▶ rotate CW
            </div>
          )}
        </StationPanel>
      )}
    </group>
  )
}

// -- receiver (Overseer) -----------------------------------------------------

function ReceiverStation({ p3, access, now, onOpen }) {
  const irisRef = useRef(null)
  const ringRef = useRef(null)
  const tint = ROLE_TINTS.overseer
  const online = p3.status !== 'locked'
  const lockedOut = p3.status === 'lockout'
  const solved = p3.status === 'solved'
  const open = isApertureOpen(p3, now)

  useFrame((state, delta) => {
    const iris = irisRef.current
    if (iris) {
      const targetScale = open || solved ? 0.18 : 1
      // Clamped lerp factor (docs/R3F-WEBGPU-NOTES.md): never let a delta
      // spike from a pipeline compile push this past 1 and overshoot.
      const f = Math.min(1, 8 * delta)
      iris.scale.setScalar(iris.scale.x + (targetScale - iris.scale.x) * f)
    }
    const ring = ringRef.current?.material
    if (!ring) return
    const t = state.clock.getElapsedTime()
    let intensity
    if (solved) intensity = 2.4
    else if (!online) intensity = 0.15
    else if (lockedOut) intensity = 1.6 + Math.sin(t * 14) * 1.4
    else if (open) intensity = 3.0 + Math.sin(t * 10) * 0.5
    else {
      const near = access !== 'out-of-range'
      intensity = (near ? 1.9 : 0.9) + Math.sin(t * 2.4) * 0.35
    }
    ring.emissiveIntensity = intensity
  })

  const showPanel = access !== 'out-of-range'
  const showPrompt = access === 'operate' && online && !lockedOut && !solved

  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid" position={[RECEIVER_POS[0], BEAM_Y, RECEIVER_POS[1]]}>
        <mesh receiveShadow>
          <cylinderGeometry args={[RECEIVER_RADIUS + 0.15, RECEIVER_RADIUS + 0.22, 0.12, 24]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#0b0d12" roughness={0.4} metalness={0.85} />
        </mesh>
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[RECEIVER_RADIUS, 0.05, 8, 28]} />
          <meshStandardMaterial
            color={lockedOut ? '#ff3131' : tint}
            emissive={lockedOut ? '#ff3131' : solved ? '#39ff14' : tint}
            emissiveIntensity={1}
            roughness={0.2}
          />
        </mesh>
        {/* Iris shutter: a disc that shrinks to reveal the aperture while open */}
        <mesh ref={irisRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.01]}>
          <circleGeometry args={[RECEIVER_RADIUS, 16]} />
          <meshStandardMaterial color="#181d26" roughness={0.5} metalness={0.6} side={THREE.DoubleSide} />
        </mesh>
        {/* Housing detail: four brace struts radiating in the ring's own
            (horizontal) plane + a sensor pod at the base (delta round 3 #2) */}
        {[45, 135, 225, 315].map((deg) => {
          const a = (deg * Math.PI) / 180
          const r = RECEIVER_RADIUS + 0.3
          return (
            <mesh key={deg} castShadow position={[Math.cos(a) * r, 0, Math.sin(a) * r]} rotation={[0, -a, 0]}>
              <boxGeometry args={[0.36, 0.09, 0.07]} />
              <meshStandardMaterial color="#12161f" roughness={0.45} metalness={0.85} />
            </mesh>
          )
        })}
        <mesh receiveShadow position={[0, -0.55, 0]}>
          <boxGeometry args={[0.3, 0.34, 0.2]} />
          <meshStandardMaterial color="#1a2230" roughness={0.5} metalness={0.75} />
        </mesh>
      </RigidBody>

      {showPanel && (
        <StationPanel
          testId="laser-panel-receiver"
          x={RECEIVER_POS[0]}
          z={RECEIVER_POS[1]}
          tint={tint}
          title="RECEIVER APERTURE"
        >
          {!online && (
            <div data-testid="laser-offline-receiver" style={{ color: '#8f9cae' }}>
              OFFLINE :: TRI-VECTOR LOCK REQUIRED
            </div>
          )}
          {solved && <div style={{ color: '#39ff14' }}>BEAM LOCKED ON RECEIVER</div>}
          {online && lockedOut && (
            <div data-testid="laser-lockout-receiver" style={{ color: '#ff3131' }}>
              SENSOR OVERLOAD — {Math.ceil(lockoutRemaining(p3, now) / 1000)}s
            </div>
          )}
          {online && !lockedOut && !solved && open && (
            <div data-testid="laser-open-receiver" style={{ color: '#39ff14' }}>
              APERTURE OPEN — {Math.ceil(apertureRemaining(p3, now) / 1000)}s
            </div>
          )}
          {online && !lockedOut && !solved && access === 'role-locked' && (
            <div data-testid="laser-role-lock-receiver" style={{ color: '#ff3131' }}>
              ROLE LOCK — OVERSEER PALM REQUIRED
            </div>
          )}
          {showPrompt && (
            <div
              data-testid="laser-prompt-receiver"
              style={{ color: 'var(--text-primary, #e8eef7)', pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={onOpen}
            >
              Press E / TAP to open aperture
            </div>
          )}
        </StationPanel>
      )}
    </group>
  )
}

// -- beam (rendered from the trace — never simulated separately) ------------

function Beam({ p3 }) {
  const segRefs = useRef([])
  const geo = useMemo(() => new THREE.BoxGeometry(1, BEAM_THICKNESS, BEAM_THICKNESS), [])
  // Bright but below the reactor's own intensity (5.0) so the receiver-lock
  // colour shift, not the beam itself, reads as the "big" bloom moment.
  const bodyMat = useMemo(() => neonMaterial({ tint: '#00f3ff', intensity: 2.6, flicker: 0.1 }), [])
  const hitMat = useMemo(() => neonMaterial({ tint: '#39ff14', intensity: 3.2, flicker: 0.04 }), [])
  const missMat = useMemo(() => neonMaterial({ tint: '#ff5a2a', intensity: 2.2, flicker: 0.14 }), [])

  useLayoutEffect(() => {
    return () => {
      geo.dispose()
      bodyMat.dispose()
      hitMat.dispose()
      missMat.dispose()
    }
  }, [geo, bodyMat, hitMat, missMat])

  useFrame(() => {
    if (p3.status === 'locked') {
      for (const mesh of segRefs.current) if (mesh) mesh.visible = false
      return
    }
    const trace = traceLaser(p3.layout, p3.emitterStep, p3.mirrorSteps)
    const points = trace.points
    const segCount = points.length - 1
    for (let i = 0; i < MAX_BOUNCES + 1; i++) {
      const mesh = segRefs.current[i]
      if (!mesh) continue
      if (i >= segCount) {
        mesh.visible = false
        continue
      }
      const [ax, az] = points[i]
      const [bx, bz] = points[i + 1]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz)
      if (len < 1e-4) {
        mesh.visible = false
        continue
      }
      mesh.visible = true
      mesh.position.set((ax + bx) / 2, BEAM_Y, (az + bz) / 2)
      // Same rotation.y = -atan2(dz, dx) convention as the emitter/mirrors:
      // local +X becomes the segment's own travel direction.
      mesh.rotation.y = -Math.atan2(dz, dx)
      mesh.scale.set(len, 1, 1)
      const isTerminal = i === segCount - 1
      mesh.material = isTerminal ? (trace.terminal === 'receiver' ? hitMat : missMat) : bodyMat
    }
  })

  return (
    <group>
      {Array.from({ length: MAX_BOUNCES + 1 }, (_, i) => (
        <mesh key={i} ref={(el) => (segRefs.current[i] = el)} geometry={geo} material={bodyMat} visible={false} />
      ))}
    </group>
  )
}

// -- top level ----------------------------------------------------------------

export const LaserArray = () => {
  const isSolo = useGameStore((state) => state.isSolo)
  const activePlayerId = useGameStore((state) => state.activePlayerId)
  const myPlayerId = useGameStore((state) => state.myPlayerId)
  const players = useGameStore((state) => state.players)
  const puzzleState = useGameStore((state) => state.puzzleState)
  const gamePhase = useGameStore((state) => state.gamePhase)
  const tickLaserPuzzle = useGameStore((state) => state.tickLaserPuzzle)
  const steerEmitterAction = useGameStore((state) => state.steerEmitter)
  const rotateMirrorAction = useGameStore((state) => state.rotateMirror)
  const openApertureAction = useGameStore((state) => state.openAperture)

  const viewerId = isSolo ? activePlayerId : myPlayerId
  const viewer = players[viewerId]
  const p3 = puzzleState.p3

  const now = Date.now()

  const [emitterAccess, setEmitterAccess] = useState('out-of-range')
  const [receiverAccess, setReceiverAccess] = useState('out-of-range')
  const [mirror0Access, setMirror0Access] = useState('out-of-range')
  const [mirror1Access, setMirror1Access] = useState('out-of-range')
  const [mirror2Access, setMirror2Access] = useState('out-of-range')
  const setMirrorAccess = [setMirror0Access, setMirror1Access, setMirror2Access]
  const mirrorAccess = [mirror0Access, mirror1Access, mirror2Access]

  useFrame(() => {
    const eRange = emitterAccess === 'operate' ? STATION_RANGE + RANGE_HYSTERESIS : STATION_RANGE
    setEmitterAccess(laserStationAccess(viewer, 'emitter', EMITTER_POS, gamePhase, eRange))

    const rRange = receiverAccess === 'operate' ? STATION_RANGE + RANGE_HYSTERESIS : STATION_RANGE
    setReceiverAccess(laserStationAccess(viewer, 'receiver', RECEIVER_POS, gamePhase, rRange))

    for (let i = 0; i < MIRROR_COUNT; i++) {
      const pos = p3.layout.mirrors[i].pos
      const range = mirrorAccess[i] === 'operate' ? STATION_RANGE + RANGE_HYSTERESIS : STATION_RANGE
      setMirrorAccess[i](laserStationAccess(viewer, `mirror${i}`, pos, gamePhase, range))
    }
  })

  // Solo time-advance (misfire lockout, aperture latch expiry, and the
  // solve itself are all clock-driven — the tick alone must be able to win
  // or fail, not only a player action), mirroring the P2 scanner tick.
  const lastTick = useRef(0)
  useFrame(() => {
    const t = performance.now()
    if (t - lastTick.current > 200) {
      lastTick.current = t
      tickLaserPuzzle(Date.now())
    }
  })

  // Resolve which station (if any) the acting character may currently
  // operate — recomputed fresh from the store on every input, exactly like
  // ScannerStations' tryArm, so keyboard/mobile handlers never read stale
  // closure state.
  const resolveTarget = useMemo(
    () => () => {
      const s = useGameStore.getState()
      const v = s.players[s.isSolo ? s.activePlayerId : s.myPlayerId]
      const puzzle = s.puzzleState
      if (!v || puzzle.stage !== 3) return null
      if (laserStationAccess(v, 'emitter', EMITTER_POS, s.gamePhase) === 'operate') {
        return { kind: 'emitter' }
      }
      if (laserStationAccess(v, 'receiver', RECEIVER_POS, s.gamePhase) === 'operate') {
        return { kind: 'receiver' }
      }
      for (let i = 0; i < MIRROR_COUNT; i++) {
        const pos = puzzle.p3.layout.mirrors[i].pos
        if (laserStationAccess(v, `mirror${i}`, pos, s.gamePhase) === 'operate') {
          return { kind: 'mirror', index: i }
        }
      }
      return null
    },
    []
  )

  const lastActionAt = useRef(0)
  // The throttle must only arm when an action ACTUALLY fires. E is bound to
  // both applyDir and applyOpen; if applyDir stamped the clock while standing
  // at the receiver (where it has nothing to steer), it would throttle the
  // applyOpen that follows it in the same keypress and the aperture could
  // never be opened from the keyboard at all.
  const applyDir = useMemo(
    () => (dir) => {
      const nowMs = performance.now()
      if (nowMs - lastActionAt.current < 90) return // client-side throttle, well under the server's 60/s cap
      const target = resolveTarget()
      if (!target) return
      if (target.kind === 'emitter') {
        lastActionAt.current = nowMs
        steerEmitterAction(dir)
      } else if (target.kind === 'mirror') {
        lastActionAt.current = nowMs
        rotateMirrorAction(target.index, dir)
      }
    },
    [resolveTarget, steerEmitterAction, rotateMirrorAction]
  )

  const applyOpen = useMemo(
    () => () => {
      const nowMs = performance.now()
      if (nowMs - lastActionAt.current < 90) return
      const target = resolveTarget()
      if (!target || target.kind !== 'receiver') return
      lastActionAt.current = nowMs
      openApertureAction()
    },
    [resolveTarget, openApertureAction]
  )

  // Keyboard: Q/E steer the emitter or rotate whichever mirror is in range;
  // E (tap) also opens the receiver aperture when standing at it.
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase()
      if (key === 'q') applyDir(-1)
      else if (key === 'e') {
        applyDir(1)
        applyOpen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [applyDir, applyOpen])

  // Mobile: the ◀ / ▶ buttons (UIOverlays, stage-3 only) fire 'mobile-laser-dir';
  // the existing shared USE button ('mobile-interact', same event ScannerStations
  // and WirePuzzle already consume) doubles as the receiver's open action.
  useEffect(() => {
    const onLaserDir = (e) => applyDir(e.detail?.dir)
    const onMobileInteract = (e) => {
      if (e.detail?.active) applyOpen()
    }
    window.addEventListener('mobile-laser-dir', onLaserDir)
    window.addEventListener('mobile-interact', onMobileInteract)
    return () => {
      window.removeEventListener('mobile-laser-dir', onLaserDir)
      window.removeEventListener('mobile-interact', onMobileInteract)
    }
  }, [applyDir, applyOpen])

  return (
    <group>
      <EmitterStation p3={p3} access={emitterAccess} now={now} />
      {p3.layout.mirrors.map((m, i) => (
        <MirrorStation key={i} index={i} pos={m.pos} p3={p3} access={mirrorAccess[i]} now={now} />
      ))}
      <ReceiverStation p3={p3} access={receiverAccess} now={now} onOpen={applyOpen} />
      <Beam p3={p3} />
    </group>
  )
}
export default LaserArray
