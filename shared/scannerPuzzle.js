// shared/scannerPuzzle.js — Puzzle 2 (Tri-Vector Hand Scanners) pure state machine.
//
// SINGLE source of truth for the P2 rules: the authoritative server requires
// this module (Node 22 require(esm)) and the solo-mode client imports it —
// solo and 3-client resolve the IDENTICAL puzzle (brief §3.14 / §4).
//
// Mechanic (brief §3.14, amendment 2026-07-04):
// - All three scanners (one per role) must be armed within a 1.5 s rolling
//   window: at the moment the third scanner arms, the spread between the
//   earliest and latest armedAt must be <= ARM_WINDOW_MS.
// - Each scanner LATCHES armed for LATCH_MS after activation. The latch is
//   what makes solo-swap solve the identical puzzle: an armed scanner stays
//   armed while the solo player swaps to the next character — role state
//   never collapses into one actor, and no relaxed solo variant exists.
// - Failure → lockout cooldown: a third arm landing outside the window, or
//   any latch expiring while the set is incomplete, clears all arms and
//   locks arming for LOCKOUT_MS.
//
// Pure + clock-injected (`now` in ms) so every timing path is unit-testable
// deterministically. No solo parameter exists anywhere in this module.

export const SCANNER_ROLES = ['engineer', 'technician', 'overseer']

export const ARM_WINDOW_MS = 3000 // rolling window: max spread of the 3 armedAt stamps
export const LATCH_MS = 4000 // armed persistence after activation
export const LOCKOUT_MS = 5000 // cooldown after a failed attempt

// Deck positions ([x, z]) of the three scanner pedestals — one in each
// role's working zone (engineer left sector, technician right sector,
// overseer center-front past the partition's end at z=8). Client uses these
// for props + range gates; the server validates arm range authoritatively.
export const SCANNER_POSITIONS = {
  engineer: [-6.5, 3.5],
  technician: [6.5, 3.5],
  overseer: [0, 8.5],
}
export const SCANNER_RANGE = 3 // same forgiving radius as the P1 consoles

export function createScannerState() {
  return {
    status: 'locked', // 'locked' (P1 unsolved) | 'active' | 'lockout' | 'solved'
    armedAt: { engineer: null, technician: null, overseer: null },
    lockoutUntil: 0,
    failCount: 0,
    solved: false,
  }
}

// P1 solved → the scanner array powers up.
export function activateScanners(state) {
  if (state.status !== 'locked') return state
  return { ...state, status: 'active' }
}

function clearedArms() {
  return { engineer: null, technician: null, overseer: null }
}

function failAttempt(state, now) {
  return {
    ...state,
    status: 'lockout',
    armedAt: clearedArms(),
    lockoutUntil: now + LOCKOUT_MS,
    failCount: state.failCount + 1,
  }
}

/**
 * Attempt to arm one scanner. `role` must be the role standing at that
 * scanner — the caller (server / solo store) resolves WHO is acting; this
 * machine enforces WHAT can happen. Returns { state, result } where result is
 * 'solved' | 'armed' | 'failed-window' | 'rejected-locked' |
 * 'rejected-lockout' | 'rejected-role' | 'rejected-already-armed'.
 */
export function armScanner(state, role, now) {
  if (!SCANNER_ROLES.includes(role)) return { state, result: 'rejected-role' }
  // Let a due lockout expire before judging the attempt.
  const s = tickScanners(state, now)
  if (s.status === 'solved') return { state: s, result: 'rejected-locked' }
  if (s.status === 'locked') return { state: s, result: 'rejected-locked' }
  if (s.status === 'lockout') return { state: s, result: 'rejected-lockout' }
  if (s.armedAt[role] !== null) return { state: s, result: 'rejected-already-armed' }

  const armedAt = { ...s.armedAt, [role]: now }
  const stamps = SCANNER_ROLES.map((r) => armedAt[r]).filter((t) => t !== null)

  if (stamps.length === SCANNER_ROLES.length) {
    const spread = Math.max(...stamps) - Math.min(...stamps)
    if (spread <= ARM_WINDOW_MS) {
      return {
        state: { ...s, status: 'solved', solved: true, armedAt },
        result: 'solved',
      }
    }
    return { state: failAttempt(s, now), result: 'failed-window' }
  }

  return { state: { ...s, armedAt }, result: 'armed' }
}

/**
 * Time-advance pass (server tick / solo frame): expires lockouts back to
 * 'active', and fails an incomplete attempt whose earliest latch has expired.
 * Idempotent for a given `now`.
 */
export function tickScanners(state, now) {
  if (state.status === 'lockout') {
    if (now >= state.lockoutUntil) {
      return { ...state, status: 'active', lockoutUntil: 0 }
    }
    return state
  }
  if (state.status !== 'active') return state

  const armedStamps = SCANNER_ROLES.map((r) => state.armedAt[r]).filter((t) => t !== null)
  if (armedStamps.length === 0) return state

  // Any latch expiring while the set is incomplete = failed attempt.
  const oldest = Math.min(...armedStamps)
  if (now - oldest >= LATCH_MS) {
    return failAttempt(state, now)
  }
  return state
}

/** True while `role`'s scanner is latched armed (for glow/UI state). */
export function isScannerArmed(state, role, now) {
  if (state.status === 'solved') return true
  const t = state.armedAt[role]
  return t !== null && now - t < LATCH_MS
}

/** Remaining lockout ms (0 when not locked out) — for cooldown UI. */
export function lockoutRemaining(state, now) {
  if (state.status !== 'lockout') return 0
  return Math.max(0, state.lockoutUntil - now)
}
