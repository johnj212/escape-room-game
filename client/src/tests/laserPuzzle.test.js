// Puzzle 3 (Laser Deflection Array) state-machine + raycast spec —
// deterministic, clock-injected. This is the shared module both the
// authoritative server and the solo client run, so these tests ARE the puzzle
// rules (brief §3.15, Pillar A 3-role, Pillar D server-authoritative raycast).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  LASER_ROLES,
  EMITTER_STEPS,
  EMITTER_STEP_DEG,
  EMITTER_BASE_DEG,
  EMITTER_END_MARGIN,
  MIRROR_COUNT,
  MIRROR_STEPS,
  MIRROR_STEP_DEG,
  MIRROR_WIDTH,
  RECEIVER_HOLD_MS,
  LASER_LOCKOUT_MS,
  MISFIRE_GRACE_MS,
  STATION_RANGE,
  createLaserLayout,
  createLaserState,
  activateLaser,
  traceLaser,
  tickLaser,
  steerEmitter,
  rotateMirror,
  openAperture,
  isApertureOpen,
  apertureRemaining,
  lockoutRemaining,
} from '../../../shared/laserPuzzle.js'

const T0 = 100_000
const SEED = 9

describe('timing / step constants — spec pins', () => {
  // Every other test uses the constants symbolically, so the suite would pass
  // for ANY value. These literal pins are what make a silent spec change fail
  // loudly — the D-6 lesson (P2's arm window drifted 1500→3000 unnoticed).
  it('RECEIVER_HOLD_MS is 10000 ms (solo-swap walk budget)', () => {
    expect(RECEIVER_HOLD_MS).toBe(10000)
  })
  it('LASER_LOCKOUT_MS is 5000 ms (matches P2 lockout)', () => {
    expect(LASER_LOCKOUT_MS).toBe(5000)
  })
  it('MISFIRE_GRACE_MS is 600 ms (transient sweeps forgiven)', () => {
    expect(MISFIRE_GRACE_MS).toBe(600)
  })
  it('emitter arc is 49 steps of 2° and mirrors 72 steps of 2.5°', () => {
    expect(EMITTER_STEPS).toBe(49)
    expect(EMITTER_STEP_DEG).toBe(2)
    expect(MIRROR_STEPS).toBe(72)
    expect(MIRROR_STEP_DEG).toBe(2.5)
    expect(MIRROR_STEPS * MIRROR_STEP_DEG).toBe(180) // a mirror line is mod 180°
  })
  it('the emitter arc is centred on +34°, off +x, where the mirror field lies', () => {
    expect(EMITTER_BASE_DEG).toBe(34)
    expect(EMITTER_END_MARGIN).toBe(2)
  })
  it('three mirrors, 3 m station range (same forgiving radius as P1/P2)', () => {
    expect(MIRROR_COUNT).toBe(3)
    expect(STATION_RANGE).toBe(3)
  })
  it('binds exactly one role to each station (Pillar A, 3-role)', () => {
    expect(LASER_ROLES).toEqual({
      emitter: 'engineer',
      mirror: 'technician',
      receiver: 'overseer',
    })
  })
})

function solvedConfig(seed = SEED) {
  const { layout, solution } = createLaserLayout(seed)
  return { layout, solution }
}

function activeState(seed = SEED) {
  return activateLaser(createLaserState(seed))
}

// Drive a state to the solution configuration using ONLY the public role
// actions — exactly as the three players would, never by mutating state.
// Stops early if the beam solves en route: sweeping a mirror can carry the
// beam across an OPEN receiver before the target angle is reached, which is a
// legitimate win, and a solved array rejects further actions.
function driveToSolution(state, solution, now) {
  let s = state
  while (s.emitterStep !== solution.emitterStep && s.status !== 'solved') {
    const dir = solution.emitterStep > s.emitterStep ? 1 : -1
    s = steerEmitter(s, dir, now).state
  }
  for (let i = 0; i < MIRROR_COUNT; i++) {
    let guard = 0
    while (s.mirrorSteps[i] !== solution.mirrorSteps[i] && s.status !== 'solved') {
      s = rotateMirror(s, i, 1, now).state
      if (++guard > MIRROR_STEPS) throw new Error(`mirror ${i} never reached target`)
    }
  }
  return s
}

/**
 * Steer the emitter until the beam leaves the receiver disc (a real sweep).
 * One 2° step does not clear a 0.75 m disc, and a solution may sit anywhere on
 * the arc, so this walks a few steps and reverses at a stop.
 */
function sweepOffReceiver(state, now) {
  let s = state
  let dir = 1
  for (let i = 0; i < 20; i++) {
    if (traceLaser(s.layout, s.emitterStep, s.mirrorSteps).terminal !== 'receiver') return s
    const res = steerEmitter(s, dir, now)
    if (res.result === 'rejected-limit') dir = -dir
    else s = res.state
  }
  throw new Error('beam never left the receiver')
}

describe('determinism (§1: ?seed=N reproduces the laser layout)', () => {
  it('same seed → identical layout and solution', () => {
    const a = createLaserLayout(42)
    const b = createLaserLayout(42)
    expect(b).toEqual(a)
  })
  it('different seeds → different mirror layouts', () => {
    const a = createLaserLayout(1)
    const b = createLaserLayout(2)
    expect(b.layout.mirrors).not.toEqual(a.layout.mirrors)
  })
  it('generates a valid layout for 200 consecutive seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(() => createLaserLayout(seed)).not.toThrow()
    }
  })

  it('never places two mirrors within STATION_RANGE of each other', () => {
    // Regression: proximity alone picks which mirror the Technician operates
    // (LaserArray.resolveTarget takes the first in range). Seed 132 once put
    // two mounts 2.86 m apart, so standing at one rotated the other and the
    // player could never turn it — the e2e caught it as a mirror that would
    // not move.
    for (let seed = 0; seed < 200; seed++) {
      const { layout } = createLaserLayout(seed)
      for (let i = 0; i < MIRROR_COUNT; i++) {
        for (let j = i + 1; j < MIRROR_COUNT; j++) {
          const a = layout.mirrors[i].pos
          const b = layout.mirrors[j].pos
          expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(STATION_RANGE)
        }
      }
    }
  })

  it('never drops a mirror on a player spawn — a collider there wedges that character', () => {
    // Regression: seed 9 placed a mirror 0.95 m from the technician's spawn.
    // The character began the round inside its collider and could not move at
    // all; the Phase-3 e2e caught it as a walk that never converged.
    const spawns = [
      [-3, -2], // engineer
      [3, -2], // technician
      [-2, 4], // overseer
    ]
    for (let seed = 0; seed < 200; seed++) {
      const { layout } = createLaserLayout(seed)
      for (const m of layout.mirrors) {
        for (const [sx, sz] of spawns) {
          expect(Math.hypot(m.pos[0] - sx, m.pos[1] - sz)).toBeGreaterThanOrEqual(2.2)
        }
      }
    }
  })

  it('never puts the solution on an arc stop — the Engineer can always steer both ways', () => {
    // Regression: with the arc centred on +x, solutions piled against the
    // upper stop (11/200 sat exactly on it) and the dial would not turn.
    for (let seed = 0; seed < 200; seed++) {
      const { solution } = createLaserLayout(seed)
      expect(solution.emitterStep).toBeGreaterThanOrEqual(EMITTER_END_MARGIN)
      expect(solution.emitterStep).toBeLessThan(EMITTER_STEPS - EMITTER_END_MARGIN)
    }
  })
})

describe('raycast (the server-authoritative hit test)', () => {
  it('the constructed solution terminates on the receiver, for every seed 0..99', () => {
    for (let seed = 0; seed < 100; seed++) {
      const { layout, solution } = createLaserLayout(seed)
      const trace = traceLaser(layout, solution.emitterStep, solution.mirrorSteps)
      expect(trace.terminal).toBe('receiver')
    }
  })

  it('the solution path is a real multi-bounce polyline, not a direct shot', () => {
    const { layout, solution } = solvedConfig()
    const trace = traceLaser(layout, solution.emitterStep, solution.mirrorSteps)
    expect(trace.mirrorsHit.length).toBeGreaterThanOrEqual(1)
    // points = emitter + one per bounce + terminal
    expect(trace.points.length).toBe(trace.mirrorsHit.length + 2)
    expect(trace.points.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z))).toBe(true)
  })

  it('the reactor column absorbs the beam (a terminal that is not the receiver)', () => {
    const { layout } = solvedConfig()
    // Some heading in the arc must be absorbed by the reactor or a wall; the
    // trace must never report a hit it did not geometrically reach.
    const terminals = new Set()
    for (let h = 0; h < EMITTER_STEPS; h++) {
      terminals.add(traceLaser(layout, h, layout.initialMirrorSteps).terminal)
    }
    expect([...terminals].every((t) => ['wall', 'reactor', 'receiver'].includes(t))).toBe(true)
    expect(terminals.has('receiver')).toBe(false) // no-Technician, see below
  })

  it('the trace is pure — tracing twice yields identical geometry', () => {
    const { layout, solution } = solvedConfig()
    const a = traceLaser(layout, solution.emitterStep, solution.mirrorSteps)
    const b = traceLaser(layout, solution.emitterStep, solution.mirrorSteps)
    expect(b).toEqual(a)
  })
})

// ---------------------------------------------------------------------------
// Pillar A — a test must prove fewer than 3 roles cannot complete the puzzle.
// Each 2-role subset is denied a distinct, necessary capability.
// ---------------------------------------------------------------------------
describe('Pillar A — no 2-role subset can complete Puzzle 3', () => {
  it('WITHOUT the Technician: mirrors stay initial → NO emitter heading reaches the receiver (exhaustive over the whole arc, seeds 0..49)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { layout } = createLaserLayout(seed)
      for (let h = 0; h < EMITTER_STEPS; h++) {
        const trace = traceLaser(layout, h, layout.initialMirrorSteps)
        expect(trace.terminal).not.toBe('receiver')
      }
    }
  })

  it('WITHOUT the Engineer: heading stays initial → NO combination of the 3 mirrors reaches the receiver (exhaustive 72³ = 373,248 combinations, seed 9)', () => {
    const { layout } = createLaserLayout(SEED)
    let hits = 0
    for (let a = 0; a < MIRROR_STEPS; a++) {
      for (let b = 0; b < MIRROR_STEPS; b++) {
        for (let c = 0; c < MIRROR_STEPS; c++) {
          if (traceLaser(layout, layout.initialEmitterStep, [a, b, c]).terminal === 'receiver') hits++
        }
      }
    }
    expect(hits).toBe(0)
  })

  it('mutation control (pinned): the identical 373,248-combination sweep at the SOLUTION heading finds many hits — the no-Engineer proof is not vacuous', () => {
    // Pinned literal (the D-6 lesson): the Phase-3 gate-verifier caught this
    // figure quoted as 5,719 in STATUS.md while the sweep actually yields
    // 10,733 — an unpinned evidence number had silently gone stale (it
    // predated the emitter-arc recentring). Pinned, it can't drift again.
    const { layout, solution } = createLaserLayout(SEED)
    let hits = 0
    for (let a = 0; a < MIRROR_STEPS; a++) {
      for (let b = 0; b < MIRROR_STEPS; b++) {
        for (let c = 0; c < MIRROR_STEPS; c++) {
          if (traceLaser(layout, solution.emitterStep, [a, b, c]).terminal === 'receiver') hits++
        }
      }
    }
    expect(hits).toBe(10733)
  })

  it('WITHOUT the Engineer (structural): the initial beam passes beyond every mirror’s reach, so no rotation can intercept it — seeds 0..49', () => {
    // The exhaustive proof above is the ground truth for one seed; this is the
    // structural invariant the generator enforces for all of them, checked
    // cheaply: closest approach of the initial ray to each mirror centre
    // exceeds the mirror's half-width (its maximum possible reach).
    for (let seed = 0; seed < 50; seed++) {
      const { layout } = createLaserLayout(seed)
      const trace = traceLaser(layout, layout.initialEmitterStep, layout.initialMirrorSteps)
      expect(trace.mirrorsHit).toEqual([]) // the initial beam touches no mirror...
      expect(trace.terminal).not.toBe('receiver') // ...and does not reach the receiver

      // ...and it misses every mirror centre by more than half a mirror width,
      // which no rotation about that centre can close.
      const [ox, oz] = trace.points[0]
      const [ex, ez] = trace.points[trace.points.length - 1]
      const len = Math.hypot(ex - ox, ez - oz)
      const dx = (ex - ox) / len
      const dz = (ez - oz) / len
      for (const m of layout.mirrors) {
        const t = Math.max(0, Math.min(len, (m.pos[0] - ox) * dx + (m.pos[1] - oz) * dz))
        const miss = Math.hypot(ox + dx * t - m.pos[0], oz + dz * t - m.pos[1])
        expect(miss).toBeGreaterThan(MIRROR_WIDTH / 2)
      }
    }
  })

  it('WITHOUT the Overseer: the beam on the receiver never solves — it misfires into lockout instead', () => {
    const { layout, solution } = solvedConfig()
    let s = activeState()
    expect(s.layout).toEqual(layout)
    // Engineer + Technician align the beam perfectly, aperture never opened.
    s = driveToSolution(s, solution, T0)
    expect(traceLaser(s.layout, s.emitterStep, s.mirrorSteps).terminal).toBe('receiver')
    expect(s.status).toBe('active')
    expect(s.solved).toBe(false)

    // Holding the aligned beam on a shut aperture trips the misfire lockout.
    s = tickLaser(s, T0 + MISFIRE_GRACE_MS)
    expect(s.status).toBe('lockout')
    expect(s.solved).toBe(false)
  })

  it('all three role actions are required: the solve happens on the third role acting, never earlier', () => {
    const { solution } = solvedConfig()
    let s = activeState()
    // Overseer first (aperture latched), then Engineer, then Technician.
    s = openAperture(s, T0).state
    expect(s.solved).toBe(false)
    while (s.emitterStep !== solution.emitterStep) {
      const dir = solution.emitterStep > s.emitterStep ? 1 : -1
      s = steerEmitter(s, dir, T0).state
    }
    expect(s.solved).toBe(false) // Engineer alone: mirrors still wrong
    s = driveToSolution(s, solution, T0)
    expect(s.status).toBe('solved') // only now, with the Technician's mirrors
    expect(s.solved).toBe(true)
  })
})

describe('solo-swap solves the IDENTICAL puzzle (§4: no relaxed solo variant)', () => {
  it('the aperture latch carries the Overseer’s action across character swaps', () => {
    const { solution } = solvedConfig()
    let s = activeState()

    // The solo player acts as Overseer, then walks/swaps to the other two
    // roles — consuming real time — and the latch is still open at the solve.
    s = openAperture(s, T0).state
    expect(isApertureOpen(s, T0)).toBe(true)

    const walk = RECEIVER_HOLD_MS - 1000 // still inside the latch
    s = tickLaser(s, T0 + walk)
    expect(isApertureOpen(s, T0 + walk)).toBe(true)
    expect(apertureRemaining(s, T0 + walk)).toBe(1000)

    s = driveToSolution(s, solution, T0 + walk)
    expect(s.status).toBe('solved')
  })

  it('a latch that expires before the beam lands does NOT solve (identical rules, not relaxed)', () => {
    const { solution } = solvedConfig()
    let s = activeState()
    s = openAperture(s, T0).state
    s = tickLaser(s, T0 + RECEIVER_HOLD_MS) // latch expires
    expect(isApertureOpen(s, T0 + RECEIVER_HOLD_MS)).toBe(false)

    s = driveToSolution(s, solution, T0 + RECEIVER_HOLD_MS)
    expect(s.solved).toBe(false)
    expect(s.status).toBe('active') // aligned, but shut — inside the grace window
  })

  it('there is no solo parameter anywhere in the shared module', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../shared/laserPuzzle.js'),
      'utf8'
    )
    expect(src).not.toMatch(/\bisSolo\b/)
    expect(src).not.toMatch(/\bsolo\s*[),=]/)
  })
})

describe('lockout semantics (§4: a defined failure/lockout)', () => {
  it('a transient sweep across the shut receiver is forgiven (under the grace)', () => {
    const { solution } = solvedConfig()
    let s = driveToSolution(activeState(), solution, T0)
    expect(s.shutHitSince).toBe(T0) // beam is resting on the shut aperture

    // Sweep off it before the grace expires. One 2° step does not clear the
    // receiver disc — a real sweep takes a few, all inside the grace window.
    s = tickLaser(s, T0 + MISFIRE_GRACE_MS - 1)
    expect(s.status).toBe('active')
    s = sweepOffReceiver(s, T0 + MISFIRE_GRACE_MS - 1)
    expect(s.status).toBe('active')
    expect(traceLaser(s.layout, s.emitterStep, s.mirrorSteps).terminal).not.toBe('receiver')
    expect(s.shutHitSince).toBe(null)

    // A full grace period later, still active: the dwell timer reset.
    s = tickLaser(s, T0 + 10 * MISFIRE_GRACE_MS)
    expect(s.status).toBe('active')
  })

  it('dwelling on the shut receiver past the grace → lockout, then recovery', () => {
    const { solution } = solvedConfig()
    let s = driveToSolution(activeState(), solution, T0)
    s = tickLaser(s, T0 + MISFIRE_GRACE_MS)
    expect(s.status).toBe('lockout')
    expect(s.failCount).toBe(1)
    expect(lockoutRemaining(s, T0 + MISFIRE_GRACE_MS)).toBe(LASER_LOCKOUT_MS)

    // Every role action is rejected while locked out.
    const t = T0 + MISFIRE_GRACE_MS + 100
    expect(steerEmitter(s, 1, t).result).toBe('rejected-lockout')
    expect(rotateMirror(s, 0, 1, t).result).toBe('rejected-lockout')
    expect(openAperture(s, t).result).toBe('rejected-lockout')

    // Cooldown expiry restores 'active' — and the alignment work survives it.
    const after = T0 + MISFIRE_GRACE_MS + LASER_LOCKOUT_MS
    s = tickLaser(s, after)
    expect(s.status).toBe('active')
    expect(s.emitterStep).toBe(solution.emitterStep)
    expect(s.mirrorSteps).toEqual(solution.mirrorSteps)
    expect(s.apertureOpenedAt).toBe(null) // but the aperture was sealed
  })

  it('opening the aperture on an already-aligned beam solves rather than misfires', () => {
    const { solution } = solvedConfig()
    let s = driveToSolution(activeState(), solution, T0)
    const res = openAperture(s, T0 + MISFIRE_GRACE_MS - 1)
    expect(res.result).toBe('solved')
    expect(res.state.status).toBe('solved')
  })
})

describe('gates and guards', () => {
  it('a locked array (P2 unsolved) rejects every action — the 2→3 chain', () => {
    const s = createLaserState(SEED)
    expect(s.status).toBe('locked')
    expect(steerEmitter(s, 1, T0).result).toBe('rejected-locked')
    expect(rotateMirror(s, 0, 1, T0).result).toBe('rejected-locked')
    expect(openAperture(s, T0).result).toBe('rejected-locked')
    expect(activateLaser(s).status).toBe('active')
  })

  it('a solved array is inert (no post-win state changes)', () => {
    const { solution } = solvedConfig()
    const s = openAperture(driveToSolution(activeState(), solution, T0), T0).state
    expect(s.status).toBe('solved')
    expect(steerEmitter(s, 1, T0 + 1).result).toBe('rejected-locked')
    expect(tickLaser(s, T0 + 100_000)).toEqual(s)
  })

  it('the emitter arc clamps at its ends and the mirror mounts wrap', () => {
    let s = activeState()
    s = { ...s, emitterStep: 0 }
    expect(steerEmitter(s, -1, T0).result).toBe('rejected-limit')
    s = { ...s, emitterStep: EMITTER_STEPS - 1 }
    expect(steerEmitter(s, 1, T0).result).toBe('rejected-limit')

    let m = activeState()
    m = { ...m, mirrorSteps: [0, 0, 0] }
    m = rotateMirror(m, 0, -1, T0).state
    expect(m.mirrorSteps[0]).toBe(MIRROR_STEPS - 1) // wrapped, not clamped
  })

  it('rejects an out-of-range mirror index (never trusts a caller’s payload)', () => {
    const s = activeState()
    expect(rotateMirror(s, 3, 1, T0).result).toBe('rejected-index')
    expect(rotateMirror(s, -1, 1, T0).result).toBe('rejected-index')
    expect(rotateMirror(s, 1.5, 1, T0).result).toBe('rejected-index')
  })

  it('tickLaser is idempotent for a given clock value', () => {
    const s = activeState()
    const once = tickLaser(s, T0)
    expect(tickLaser(once, T0)).toEqual(once)
  })

  it('createLaserState never carries the solution (it must not reach a client)', () => {
    const s = createLaserState(SEED)
    expect(s.solution).toBeUndefined()
    expect(s.layout.solution).toBeUndefined()
    expect(JSON.stringify(s)).not.toContain('solution')
  })
})
