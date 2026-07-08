import { useRef, useState, useEffect, useMemo } from 'react'
import { RigidBody } from '@react-three/rapier'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../store/gameStore'
import { scannerAccess, RANGE_HYSTERESIS } from '../game/roleGates'
import {
  SCANNER_ROLES,
  SCANNER_POSITIONS,
  SCANNER_RANGE,
  isScannerArmed,
  lockoutRemaining,
} from '../../../shared/scannerPuzzle.js'

// Puzzle 2 — Tri-Vector Hand Scanners (Pillar A, all 3 roles).
//
// Three role-keyed scanner pedestals. Each one arms ONLY for its own role
// standing at it (game/roleGates.js scannerAccess — no solo parameter
// exists); the solve/latch/lockout rules live in shared/scannerPuzzle.js,
// the same machine the authoritative server runs. This component is
// presentation + input routing: store.armScanner resolves solo-vs-server.
//
// Quality law (§4): every pedestal has a proximity affordance (emissive
// pulse brightens on approach), a role/state readout, and clear feedback on
// activation (armed flare, lockout flash).

// Harness instrumentation (same pattern as __PERF__ / __CAPABILITY__): the
// e2e walks each character to their pedestal using the live shared contract,
// so the spec can't drift from the game.
if (typeof window !== 'undefined') window.__SCANNER_POSITIONS__ = SCANNER_POSITIONS

const ROLE_TINTS = {
  engineer: '#00f3ff',
  technician: '#ff007f',
  overseer: '#ffdf00',
}
const ROLE_LABELS = {
  engineer: 'ENGINEER',
  technician: 'TECHNICIAN',
  overseer: 'OVERSEER',
}

function ScannerPedestal({ role, viewer, gamePhase, puzzleState, onArm, now }) {
  const [x, z] = SCANNER_POSITIONS[role]
  const tint = ROLE_TINTS[role]
  const ringRef = useRef(null)
  const padRef = useRef(null)
  const [access, setAccess] = useState('out-of-range')

  const { stage, p2 } = puzzleState
  const online = stage === 2 && p2.status !== 'solved'
  const armed = stage === 2 && isScannerArmed(p2, role, now)
  const lockedOut = p2.status === 'lockout'
  const solved = p2.status === 'solved'

  // Proximity + role gate for the viewing character, with the same
  // hysteresis trick as the P1 consoles so the prompt can't flap.
  useFrame(() => {
    const range =
      access === 'arm' ? SCANNER_RANGE + RANGE_HYSTERESIS : SCANNER_RANGE
    setAccess(scannerAccess(viewer, role, gamePhase, range))
  })

  // Emissive state machine + approach affordance, driven directly on the
  // materials (no React churn per frame).
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    const ring = ringRef.current?.material
    const pad = padRef.current?.material
    if (!ring || !pad) return

    let ringIntensity
    if (solved) {
      ringIntensity = 2.2 // steady: array satisfied
    } else if (!online) {
      ringIntensity = 0.15 // offline until the P1 grid syncs
    } else if (lockedOut) {
      ringIntensity = 1.6 + Math.sin(t * 14) * 1.4 // alarm flash
    } else if (armed) {
      ringIntensity = 3.2 + Math.sin(t * 10) * 0.5 // latched flare
    } else {
      const near = access !== 'out-of-range'
      ringIntensity = (near ? 1.9 : 0.9) + Math.sin(t * 2.4) * 0.35 // idle pulse, brightens on approach
    }
    ring.emissiveIntensity = ringIntensity
    pad.emissiveIntensity = armed || solved ? 2.6 : online ? 0.9 : 0.2
  })

  const showPrompt = access === 'arm' && online && !lockedOut && !armed
  const promptText = 'Press E / TAP to arm scanner'

  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid" position={[x, 0.55, z]}>
        {/* Base plate (no castShadow: every extra caster renders into 4 CSM
            cascades + the reactor's 6 cube-shadow faces — the column is the
            only silhouette that matters; GTAO grounds the rest) */}
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.62, 0.7, 0.1, 6]} />
          <meshStandardMaterial color="#0b0d12" roughness={0.4} metalness={0.9} />
        </mesh>
        {/* Hex column */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.34, 0.42, 0.9, 6]} />
          <meshStandardMaterial color="#1a2230" roughness={0.45} metalness={0.75} />
        </mesh>
        {/* Status ring collar */}
        <mesh ref={ringRef} position={[0, 0.47, 0]}>
          <torusGeometry args={[0.3, 0.035, 8, 24]} />
          <meshStandardMaterial
            color={lockedOut ? '#ff3131' : tint}
            emissive={lockedOut ? '#ff3131' : solved ? '#39ff14' : tint}
            emissiveIntensity={1}
            roughness={0.2}
          />
        </mesh>
        {/* Angled scan head */}
        <mesh receiveShadow position={[0, 0.56, 0.05]} rotation={[-Math.PI / 7, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.34, 0.1, 6]} />
          <meshStandardMaterial color="#10141d" roughness={0.35} metalness={0.85} />
        </mesh>
        {/* Palm pad — the diegetic "hand scanner" surface */}
        <mesh ref={padRef} position={[0, 0.62, 0.07]} rotation={[-Math.PI / 7, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.015, 24]} />
          <meshStandardMaterial
            color={tint}
            emissive={solved ? '#39ff14' : tint}
            emissiveIntensity={0.9}
            roughness={0.15}
          />
        </mesh>
      </RigidBody>

      {/* Role plate + state readout (always legible near the pedestal) */}
      {access !== 'out-of-range' && (
        <Html position={[x, 1.75, z]} center>
          <div
            data-testid={`scanner-panel-${role}`}
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
              pointerEvents: showPrompt ? 'auto' : 'none',
              cursor: showPrompt ? 'pointer' : 'default',
            }}
            onClick={showPrompt ? onArm : undefined}
          >
            <div style={{ marginBottom: '3px' }}>{ROLE_LABELS[role]} VECTOR SCANNER</div>
            {!online && !solved && (
              <div data-testid={`scanner-offline-${role}`} style={{ color: '#8f9cae' }}>
                OFFLINE :: POWER GRID SYNC REQUIRED
              </div>
            )}
            {solved && (
              <div style={{ color: '#39ff14' }}>TRI-VECTOR LOCK CONFIRMED</div>
            )}
            {online && lockedOut && (
              <div data-testid={`scanner-lockout-${role}`} style={{ color: '#ff3131' }}>
                ARRAY LOCKOUT — {Math.ceil(lockoutRemaining(p2, now) / 1000)}s
              </div>
            )}
            {online && !lockedOut && armed && (
              <div data-testid={`scanner-armed-${role}`} style={{ color: '#39ff14' }}>
                ARMED — HOLD VECTOR
              </div>
            )}
            {online && !lockedOut && !armed && access === 'role-locked' && (
              <div data-testid={`scanner-role-lock-${role}`} style={{ color: '#ff3131' }}>
                ROLE LOCK — {ROLE_LABELS[role]} PALM REQUIRED
              </div>
            )}
            {showPrompt && (
              <div data-testid={`scanner-prompt-${role}`} style={{ color: 'var(--text-primary, #e8eef7)' }}>
                {promptText}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

export const ScannerStations = () => {
  const isSolo = useGameStore((state) => state.isSolo)
  const activePlayerId = useGameStore((state) => state.activePlayerId)
  const myPlayerId = useGameStore((state) => state.myPlayerId)
  const players = useGameStore((state) => state.players)
  const puzzleState = useGameStore((state) => state.puzzleState)
  const gamePhase = useGameStore((state) => state.gamePhase)
  const tickScannerPuzzle = useGameStore((state) => state.tickScannerPuzzle)

  // Same viewer resolution as P1: the acting character is the solo-swap
  // active character offline, or this client's own player online. Sightline
  // and control never collapse — each pedestal still role-gates the viewer.
  const viewerId = isSolo ? activePlayerId : myPlayerId
  const viewer = players[viewerId]

  // Coarse clock for latch/lockout readouts — advanced by the solo tick (or
  // server broadcasts) rather than per-frame React state.
  const now = Date.now()

  // Solo time-advance (latch expiry → failure, lockout cooldown), mirroring
  // the server's tick at a light cadence.
  const lastTick = useRef(0)
  useFrame(() => {
    const t = performance.now()
    if (t - lastTick.current > 200) {
      lastTick.current = t
      tickScannerPuzzle(Date.now())
    }
  })

  const tryArm = useMemo(
    () => () => {
      const state = useGameStore.getState()
      const v = state.players[state.isSolo ? state.activePlayerId : state.myPlayerId]
      if (!v) return
      if (scannerAccess(v, v.role, state.gamePhase) === 'arm') {
        state.armScanner(v.role)
      }
    },
    []
  )

  // Keyboard arm (E) — mobile taps the prompt itself (Pillar E: every action
  // reachable on touch and keyboard).
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key.toLowerCase() === 'e') tryArm()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tryArm])

  // Mobile USE button (dispatched by UIOverlays as 'mobile-interact') mirrors
  // the keyboard arm — it previously only updated usePlayerControls' inputRef,
  // which nothing here read.
  useEffect(() => {
    const onMobileInteract = (e) => {
      if (e.detail?.active) tryArm()
    }
    window.addEventListener('mobile-interact', onMobileInteract)
    return () => window.removeEventListener('mobile-interact', onMobileInteract)
  }, [tryArm])

  return (
    <group>
      {SCANNER_ROLES.map((role) => (
        <ScannerPedestal
          key={role}
          role={role}
          viewer={viewer}
          gamePhase={gamePhase}
          puzzleState={puzzleState}
          onArm={tryArm}
          now={now}
        />
      ))}
    </group>
  )
}
export default ScannerStations
