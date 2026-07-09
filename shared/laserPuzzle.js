// shared/laserPuzzle.js — Puzzle 3 (Laser Deflection Array) pure state machine
// + the server-side raycast that validates the hit.
//
// SINGLE source of truth for the P3 rules: the authoritative server requires
// this module (Node 22 require(esm)) and the solo-mode client imports it —
// solo and 3-client resolve the IDENTICAL puzzle (brief §3.15 / §4).
//
// Mechanic (brief §3.15, amendment 2026-07-04 — all 3 roles):
// - The ENGINEER steers the emitter heading in EMITTER_STEP_DEG steps across
//   a fixed arc. The TECHNICIAN rotates each mirror in MIRROR_STEP_DEG steps.
//   The OVERSEER opens the receiver aperture, which LATCHES open for
//   RECEIVER_HOLD_MS — the latch is what makes solo-swap solve the identical
//   puzzle: the aperture stays open while the solo player swaps characters.
//   No relaxed solo variant exists; no solo parameter exists in this module.
// - The beam is continuously traced (traceLaser): ray→mirror-segment
//   reflections; the walls and the reactor column absorb; the security
//   partition is containment GLASS, so the beam transmits through it
//   (rendered, not simulated — glass refraction is ignored by design).
// - SOLVED: the traced beam terminates on the receiver disc while the
//   aperture is open.
// - FAILURE → lockout: the beam resting on the SHUT receiver for longer than
//   MISFIRE_GRACE_MS ("sensor overload") trips a LASER_LOCKOUT_MS cooldown —
//   emitter offline, aperture sealed. Transient sweeps within the grace are
//   forgiven. Mirror/emitter steps survive the lockout (the penalty is
//   meltdown-clock time, not lost work).
//
// Pillar-A guarantees are built into the layout generator (createLaserLayout):
// - Solvable: the constructed solution is verified with the real trace.
// - No-Engineer (heading fixed at initial): STRUCTURAL — the initial
//   heading's beam passes farther than a mirror's maximum reach
//   (MIRROR_WIDTH/2 + margin) from every mirror center, so no mirror
//   rotation can ever touch it, and it does not hit the receiver.
// - No-Technician (mirrors fixed at initial steps): EXHAUSTIVE — all
//   EMITTER_STEPS headings are traced; none reaches the receiver. (This also
//   proves no direct emitter→receiver shot exists.)
// - No-Overseer: STRUCTURAL — a hit only solves while the aperture is open,
//   and only openAperture opens it.
//
// Pure + clock-injected (`now` in ms) so every timing path is unit-testable
// deterministically. Every timing/step constant below is pinned by a
// literal-value test in laserPuzzle.test.js (the D-6 lesson: symbolic-only
// usage lets spec constants drift invisibly).

export const LASER_ROLES = {
  emitter: 'engineer',
  mirror: 'technician',
  receiver: 'overseer',
}

// Deck positions ([x, z]). Emitter on the left wall of the engineer sector;
// receiver recessed into the back wall right of the reactor — the direct
// emitter→receiver line is blocked by the reactor column by construction.
export const EMITTER_POS = [-8.5, -6]
export const RECEIVER_POS = [4, -9.2]
export const RECEIVER_RADIUS = 0.75
export const REACTOR_CIRCLE = { pos: [0, -9], radius: 1.9 }
// Inner face of the room walls (walls are 0.5 thick centered at ±10).
export const FIELD_BOUND = 9.75

export const MIRROR_COUNT = 3
export const MIRROR_WIDTH = 1.5 // reflective face length; max reach = width/2
export const MIRROR_STEP_DEG = 2.5
export const MIRROR_STEPS = 72 // a mirror line is symmetric mod 180°

export const EMITTER_STEP_DEG = 2
export const EMITTER_STEPS = 49 // ±48° arc around the base heading
// The emitter sits at the room's back-left; the mirror field lies up-field of
// it, so the reachable solution headings are all well off +x. Centering the
// arc on +34° puts the constructed solutions near the middle of the dial
// (measured over 200 seeds) instead of jammed against its upper stop.
export const EMITTER_BASE_DEG = 34
// A solution never lands within this many steps of an arc end, so the Engineer
// always has travel in BOTH directions while hunting for it.
export const EMITTER_END_MARGIN = 2

export const RECEIVER_HOLD_MS = 10000 // aperture latch — sized for solo-swap walk time
export const LASER_LOCKOUT_MS = 5000 // cooldown after a sensor-overload misfire
export const MISFIRE_GRACE_MS = 600 // shut-receiver dwell forgiven below this

export const STATION_RANGE = 3 // same forgiving radius as the P1/P2 consoles
export const MAX_BOUNCES = 6

const DEG = Math.PI / 180

/** Emitter heading (radians, XZ plane, 0 = +x) for a step index. */
export function emitterHeading(step) {
  return (EMITTER_BASE_DEG + (step - (EMITTER_STEPS - 1) / 2) * EMITTER_STEP_DEG) * DEG
}

/** Mirror face angle (radians in [0, π)) for a step index. */
export function mirrorAngle(step) {
  return ((step % MIRROR_STEPS) + MIRROR_STEPS) % MIRROR_STEPS * MIRROR_STEP_DEG * DEG
}

// ---------------------------------------------------------------------------
// Geometry — pure 2D (XZ plane) ray tracing
// ---------------------------------------------------------------------------

const EPS = 1e-6

function raySegment(ox, oz, dx, dz, cx, cz, ux, uz, half) {
  // Solve O + t·D = C + s·U for t > EPS, |s| <= half.
  const det = ux * dz - uz * dx
  if (Math.abs(det) < 1e-9) return null
  const rx = cx - ox
  const rz = cz - oz
  const t = (ux * rz - uz * rx) / det
  const s = (dx * rz - dz * rx) / det
  if (t <= EPS || Math.abs(s) > half) return null
  return t
}

function rayCircle(ox, oz, dx, dz, cx, cz, r) {
  const fx = cx - ox
  const fz = cz - oz
  const b = fx * dx + fz * dz
  const c = fx * fx + fz * fz - r * r
  const disc = b * b - c
  if (disc < 0) return null
  const sq = Math.sqrt(disc)
  const t0 = b - sq
  if (t0 > EPS) return t0
  const t1 = b + sq
  return t1 > EPS ? t1 : null
}

function rayBounds(ox, oz, dx, dz) {
  // Exit distance from inside the FIELD_BOUND square.
  let t = Infinity
  if (dx > EPS) t = Math.min(t, (FIELD_BOUND - ox) / dx)
  else if (dx < -EPS) t = Math.min(t, (-FIELD_BOUND - ox) / dx)
  if (dz > EPS) t = Math.min(t, (FIELD_BOUND - oz) / dz)
  else if (dz < -EPS) t = Math.min(t, (-FIELD_BOUND - oz) / dz)
  return t
}

/**
 * Trace the beam for a configuration. `mirrors` is layout.mirrors
 * ([{ pos: [x, z] }] — MIRROR_COUNT entries), steps are integer indices.
 * Returns { points, terminal, mirrorsHit } where points is the polyline
 * ([[x, z], ...] from the emitter to the terminal point) and terminal is
 * 'receiver' | 'reactor' | 'wall'. Clients render the beam from `points`;
 * the server's solve validation reads `terminal`. One trace is a few
 * microseconds — safe at the 30 Hz tick.
 */
export function traceLaser(layout, emitterStep, mirrorSteps) {
  const half = MIRROR_WIDTH / 2
  let ox = EMITTER_POS[0]
  let oz = EMITTER_POS[1]
  const h = emitterHeading(emitterStep)
  let dx = Math.cos(h)
  let dz = Math.sin(h)
  const points = [[ox, oz]]
  const mirrorsHit = []
  let lastMirror = -1

  for (let bounce = 0; bounce <= MAX_BOUNCES; bounce++) {
    let bestT = rayBounds(ox, oz, dx, dz)
    let bestKind = 'wall'
    let bestMirror = -1

    const tReactor = rayCircle(
      ox, oz, dx, dz,
      REACTOR_CIRCLE.pos[0], REACTOR_CIRCLE.pos[1], REACTOR_CIRCLE.radius
    )
    if (tReactor !== null && tReactor < bestT) {
      bestT = tReactor
      bestKind = 'reactor'
    }

    const tReceiver = rayCircle(
      ox, oz, dx, dz,
      RECEIVER_POS[0], RECEIVER_POS[1], RECEIVER_RADIUS
    )
    if (tReceiver !== null && tReceiver < bestT) {
      bestT = tReceiver
      bestKind = 'receiver'
    }

    for (let i = 0; i < layout.mirrors.length; i++) {
      if (i === lastMirror) continue
      const a = mirrorAngle(mirrorSteps[i])
      const ux = Math.cos(a)
      const uz = Math.sin(a)
      const [cx, cz] = layout.mirrors[i].pos
      const t = raySegment(ox, oz, dx, dz, cx, cz, ux, uz, half)
      if (t !== null && t < bestT) {
        bestT = t
        bestKind = 'mirror'
        bestMirror = i
      }
    }

    ox += dx * bestT
    oz += dz * bestT
    points.push([ox, oz])

    if (bestKind !== 'mirror') {
      return { points, terminal: bestKind, mirrorsHit }
    }

    mirrorsHit.push(bestMirror)
    lastMirror = bestMirror
    const a = mirrorAngle(mirrorSteps[bestMirror])
    // Normal to the mirror line (either side — reflection formula is symmetric).
    const nx = -Math.sin(a)
    const nz = Math.cos(a)
    const dot2 = 2 * (dx * nx + dz * nz)
    dx -= dot2 * nx
    dz -= dot2 * nz
  }

  // Bounce budget exhausted mid-flight: treat as absorbed.
  return { points, terminal: 'wall', mirrorsHit }
}

// ---------------------------------------------------------------------------
// Seeded layout generation (§1 determinism: same seed → same array)
// ---------------------------------------------------------------------------

// mulberry32, duplicated from client/src/render/prng.js — this module must
// stay dependency-free (no window) so the server can require() it.
function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function attemptRng(seed, attempt) {
  let h = (seed >>> 0) ^ 0x53433909
  h = Math.imul(h ^ attempt, 0x9e3779b1)
  h ^= h >>> 16
  return mulberry32(h >>> 0)
}

// Existing deck features a mirror must keep clear of. The player SPAWNS are in
// this list because a mirror's collider dropped on top of one wedges that
// character in place at round start — they cannot walk at all. (Found by the
// Phase-3 e2e: seed 9 put a mirror 0.95 m from the technician's spawn.)
const PROP_CLEARANCE_POINTS = [
  [-5, 0], [5, 0], // P1 hologram / switchboard
  [-6.5, 3.5], [6.5, 3.5], [0, 8.5], // P2 scanner pedestals
  [-3, -2], [3, -2], [-2, 4], // engineer / technician / overseer spawns
]
const MIRROR_ZONE = { x: [-7, 7], z: [-6.5, 6.5] }
const MIRROR_PROP_CLEAR = 2.2
// Two mirrors must never be within STATION_RANGE of each other. Proximity
// alone selects which mirror a Technician operates (LaserArray.resolveTarget
// takes the first in range), so overlapping radii would rotate the wrong
// mount and leave the player no way to reach the other one.
const MIRROR_MIRROR_CLEAR = STATION_RANGE + 0.4
const MIRROR_PARTITION_CLEAR = 1.2 // |x| — keep props off the glass line
const CONSTRUCT_TOL = 0.5 // max closest-approach miss during construction
const NO_ENGINEER_MARGIN = 0.4 // structural clearance beyond a mirror's max reach

function dist(ax, az, bx, bz) {
  return Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2)
}

function placeMirrors(rng) {
  const mirrors = []
  for (let i = 0; i < MIRROR_COUNT; i++) {
    let placed = false
    for (let tries = 0; tries < 300 && !placed; tries++) {
      const x = MIRROR_ZONE.x[0] + (MIRROR_ZONE.x[1] - MIRROR_ZONE.x[0]) * rng()
      const z = MIRROR_ZONE.z[0] + (MIRROR_ZONE.z[1] - MIRROR_ZONE.z[0]) * rng()
      if (Math.abs(x) < MIRROR_PARTITION_CLEAR) continue
      if (PROP_CLEARANCE_POINTS.some(([px, pz]) => dist(x, z, px, pz) < MIRROR_PROP_CLEAR)) continue
      if (dist(x, z, EMITTER_POS[0], EMITTER_POS[1]) < MIRROR_MIRROR_CLEAR) continue
      if (dist(x, z, RECEIVER_POS[0], RECEIVER_POS[1]) < MIRROR_MIRROR_CLEAR) continue
      if (dist(x, z, REACTOR_CIRCLE.pos[0], REACTOR_CIRCLE.pos[1]) < REACTOR_CIRCLE.radius + 1) continue
      if (mirrors.some((m) => dist(x, z, m.pos[0], m.pos[1]) < MIRROR_MIRROR_CLEAR)) continue
      mirrors.push({ pos: [x, z] })
      placed = true
    }
    if (!placed) return null
  }
  return mirrors
}

function snapEmitterStep(headingRad) {
  const deg = headingRad / DEG
  const step = Math.round((deg - EMITTER_BASE_DEG) / EMITTER_STEP_DEG + (EMITTER_STEPS - 1) / 2)
  // Keep the solution off both stops (EMITTER_END_MARGIN) so the Engineer can
  // always steer either way from it.
  if (step < EMITTER_END_MARGIN || step >= EMITTER_STEPS - EMITTER_END_MARGIN) return null
  return step
}

function snapMirrorStep(tangentRad) {
  let deg = (tangentRad / DEG) % 180
  if (deg < 0) deg += 180
  return Math.round(deg / MIRROR_STEP_DEG) % MIRROR_STEPS
}

function closestApproach(ox, oz, dx, dz, tx, tz) {
  const t = (tx - ox) * dx + (tz - oz) * dz
  if (t <= EPS) return null
  const px = ox + dx * t
  const pz = oz + dz * t
  return { t, px, pz, miss: dist(px, pz, tx, tz) }
}

function constructSolution(mirrors, order) {
  // Forward construction: aim each leg at the next mirror's center, snap the
  // required angle to its step grid, and continue from the closest-approach
  // point. Snap error is absorbed by MIRROR_WIDTH / RECEIVER_RADIUS; the
  // caller verifies the finished configuration with the real trace.
  const m0 = mirrors[order[0]].pos
  const exactHeading = Math.atan2(m0[1] - EMITTER_POS[1], m0[0] - EMITTER_POS[0])
  const emitterStep = snapEmitterStep(exactHeading)
  if (emitterStep === null) return null

  const h = emitterHeading(emitterStep)
  let dx = Math.cos(h)
  let dz = Math.sin(h)
  let px = EMITTER_POS[0]
  let pz = EMITTER_POS[1]
  const mirrorSteps = new Array(MIRROR_COUNT).fill(null)

  for (let k = 0; k < order.length; k++) {
    const idx = order[k]
    const m = mirrors[idx].pos
    const hit = closestApproach(px, pz, dx, dz, m[0], m[1])
    if (!hit || hit.miss > CONSTRUCT_TOL) return null

    const target = k < order.length - 1 ? mirrors[order[k + 1]].pos : RECEIVER_POS
    const outLen = dist(hit.px, hit.pz, target[0], target[1])
    if (outLen < 1) return null
    const outx = (target[0] - hit.px) / outLen
    const outz = (target[1] - hit.pz) / outLen

    // Required mirror normal is the bisector of (-in, out); tangent is its perp.
    let nx = outx - dx
    let nz = outz - dz
    const nLen = Math.sqrt(nx * nx + nz * nz)
    if (nLen < 1e-6) return null // straight-through: no mirror needed — reject
    nx /= nLen
    nz /= nLen
    mirrorSteps[idx] = snapMirrorStep(Math.atan2(nx, -nz)) // tangent = normal rotated 90°

    // Continue with the REAL reflection off the snapped angle.
    const a = mirrorAngle(mirrorSteps[idx])
    const snx = -Math.sin(a)
    const snz = Math.cos(a)
    const dot2 = 2 * (dx * snx + dz * snz)
    dx -= dot2 * snx
    dz -= dot2 * snz
    px = hit.px
    pz = hit.pz
  }

  return { emitterStep, mirrorSteps }
}

function rayClearsAllMirrors(emitterStep, mirrors) {
  // Structural no-Engineer check: the beam at this heading (ignoring mirrors)
  // must pass farther than a mirror's max reach from every mirror center, so
  // no rotation of any mirror can ever intercept it.
  const h = emitterHeading(emitterStep)
  const dx = Math.cos(h)
  const dz = Math.sin(h)
  const ox = EMITTER_POS[0]
  const oz = EMITTER_POS[1]
  let tEnd = rayBounds(ox, oz, dx, dz)
  const tReactor = rayCircle(
    ox, oz, dx, dz,
    REACTOR_CIRCLE.pos[0], REACTOR_CIRCLE.pos[1], REACTOR_CIRCLE.radius
  )
  if (tReactor !== null && tReactor < tEnd) tEnd = tReactor
  const clear = MIRROR_WIDTH / 2 + NO_ENGINEER_MARGIN
  return mirrors.every((m) => {
    let t = (m.pos[0] - ox) * dx + (m.pos[1] - oz) * dz
    t = Math.max(0, Math.min(tEnd, t))
    return dist(ox + dx * t, oz + dz * t, m.pos[0], m.pos[1]) >= clear
  })
}

function permutation3(rng) {
  const order = [0, 1, 2]
  for (let i = 2; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/**
 * Deterministic layout for a seed, with the Pillar-A properties enforced at
 * generation time (see module header). Returns { layout, solution }; the
 * solution is for tests/tools ONLY — createLaserState drops it so it is
 * never broadcast in room state.
 */
export function createLaserLayout(seed) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const rng = attemptRng(seed, attempt)

    const mirrors = placeMirrors(rng)
    if (!mirrors) continue

    const solution = constructSolution(mirrors, permutation3(rng))
    if (!solution) continue
    const solved = traceLaser({ mirrors }, solution.emitterStep, solution.mirrorSteps)
    if (solved.terminal !== 'receiver') continue

    // No-Technician: with the initial mirror steps, no heading may reach the
    // receiver (also proves no direct shot exists).
    let initialMirrorSteps = null
    for (let tries = 0; tries < 20 && !initialMirrorSteps; tries++) {
      const candidate = Array.from({ length: MIRROR_COUNT }, () =>
        Math.floor(rng() * MIRROR_STEPS)
      )
      let safe = true
      for (let h = 0; h < EMITTER_STEPS && safe; h++) {
        if (traceLaser({ mirrors }, h, candidate).terminal === 'receiver') safe = false
      }
      if (safe) initialMirrorSteps = candidate
    }
    if (!initialMirrorSteps) continue

    // No-Engineer: pick an initial heading whose beam no mirror can reach.
    const headingCandidates = []
    for (let h = 0; h < EMITTER_STEPS; h++) {
      if (h === solution.emitterStep) continue
      if (!rayClearsAllMirrors(h, mirrors)) continue
      if (traceLaser({ mirrors }, h, initialMirrorSteps).terminal === 'receiver') continue
      headingCandidates.push(h)
    }
    if (headingCandidates.length === 0) continue
    const initialEmitterStep =
      headingCandidates[Math.floor(rng() * headingCandidates.length)]

    return {
      layout: { mirrors, initialEmitterStep, initialMirrorSteps },
      solution,
    }
  }
  throw new Error(`laserPuzzle: no valid layout for seed ${seed} in 100 attempts`)
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export function createLaserState(seed) {
  const { layout } = createLaserLayout(seed)
  return {
    status: 'locked', // 'locked' (P2 unsolved) | 'active' | 'lockout' | 'solved'
    layout,
    emitterStep: layout.initialEmitterStep,
    mirrorSteps: [...layout.initialMirrorSteps],
    apertureOpenedAt: null,
    shutHitSince: null,
    lockoutUntil: 0,
    failCount: 0,
    solved: false,
    seed,
  }
}

/** P2 solved → the deflection array powers up. */
export function activateLaser(state) {
  if (state.status !== 'locked') return state
  return { ...state, status: 'active' }
}

/** True while the receiver aperture is latched open. */
export function isApertureOpen(state, now) {
  if (state.status === 'solved') return true
  return state.apertureOpenedAt !== null && now - state.apertureOpenedAt < RECEIVER_HOLD_MS
}

/** Remaining open-latch ms (0 when shut) — for the receiver console UI. */
export function apertureRemaining(state, now) {
  if (!isApertureOpen(state, now) || state.status === 'solved') return 0
  return Math.max(0, state.apertureOpenedAt + RECEIVER_HOLD_MS - now)
}

/** Remaining lockout ms (0 when not locked out) — for cooldown UI. */
export function lockoutRemaining(state, now) {
  if (state.status !== 'lockout') return 0
  return Math.max(0, state.lockoutUntil - now)
}

function failAttempt(state, now) {
  return {
    ...state,
    status: 'lockout',
    apertureOpenedAt: null,
    shutHitSince: null,
    lockoutUntil: now + LASER_LOCKOUT_MS,
    failCount: state.failCount + 1,
  }
}

// Solve/misfire evaluation for an 'active' state at `now`.
function evaluate(state, now) {
  const trace = traceLaser(state.layout, state.emitterStep, state.mirrorSteps)
  if (trace.terminal === 'receiver') {
    if (isApertureOpen(state, now)) {
      return { ...state, status: 'solved', solved: true, shutHitSince: null }
    }
    const since = state.shutHitSince ?? now
    if (now - since >= MISFIRE_GRACE_MS) return failAttempt(state, now)
    return state.shutHitSince === since ? state : { ...state, shutHitSince: since }
  }
  return state.shutHitSince === null ? state : { ...state, shutHitSince: null }
}

/**
 * Time-advance pass (server 30 Hz tick / solo frame): expires lockouts back
 * to 'active', auto-shuts an expired aperture latch, and evaluates
 * solve/misfire against the current trace. Idempotent for a given `now`.
 */
export function tickLaser(state, now) {
  if (state.status === 'lockout') {
    if (now >= state.lockoutUntil) {
      return { ...state, status: 'active', lockoutUntil: 0 }
    }
    return state
  }
  if (state.status !== 'active') return state

  let s = state
  if (s.apertureOpenedAt !== null && now - s.apertureOpenedAt >= RECEIVER_HOLD_MS) {
    s = { ...s, apertureOpenedAt: null }
  }
  return evaluate(s, now)
}

function gate(state, now) {
  const s = tickLaser(state, now)
  if (s.status === 'solved' || s.status === 'locked') return { state: s, reject: 'rejected-locked' }
  if (s.status === 'lockout') return { state: s, reject: 'rejected-lockout' }
  return { state: s, reject: null }
}

function finish(state, now, okResult) {
  const s = evaluate(state, now)
  return { state: s, result: s.status === 'solved' ? 'solved' : okResult }
}

/**
 * ENGINEER action: nudge the emitter heading one step (`dir` = +1 | -1).
 * The arc is physical — steps clamp at the ends rather than wrapping.
 * Returns { state, result }: 'steered' | 'solved' | 'rejected-locked' |
 * 'rejected-lockout' | 'rejected-limit'.
 */
export function steerEmitter(state, dir, now) {
  const { state: s, reject } = gate(state, now)
  if (reject) return { state: s, result: reject }
  const step = Math.max(0, Math.min(EMITTER_STEPS - 1, s.emitterStep + Math.sign(dir)))
  if (step === s.emitterStep) return { state: s, result: 'rejected-limit' }
  return finish({ ...s, emitterStep: step }, now, 'steered')
}

/**
 * TECHNICIAN action: rotate mirror `index` one step (`dir` = +1 | -1); the
 * mount rotates freely (wraps mod MIRROR_STEPS). Returns { state, result }:
 * 'rotated' | 'solved' | 'rejected-locked' | 'rejected-lockout' | 'rejected-index'.
 */
export function rotateMirror(state, index, dir, now) {
  const { state: s, reject } = gate(state, now)
  if (reject) return { state: s, result: reject }
  if (!Number.isInteger(index) || index < 0 || index >= MIRROR_COUNT) {
    return { state: s, result: 'rejected-index' }
  }
  const mirrorSteps = [...s.mirrorSteps]
  mirrorSteps[index] =
    (((mirrorSteps[index] + Math.sign(dir)) % MIRROR_STEPS) + MIRROR_STEPS) % MIRROR_STEPS
  return finish({ ...s, mirrorSteps }, now, 'rotated')
}

/**
 * OVERSEER action: open (or re-latch) the receiver aperture for
 * RECEIVER_HOLD_MS. Returns { state, result }: 'opened' | 'solved' |
 * 'rejected-locked' | 'rejected-lockout'.
 */
export function openAperture(state, now) {
  const { state: s, reject } = gate(state, now)
  if (reject) return { state: s, result: reject }
  return finish({ ...s, apertureOpenedAt: now, shutHitSince: null }, now, 'opened')
}
