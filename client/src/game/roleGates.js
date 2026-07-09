// Pillar A role gates for Puzzle 1 (Decoupled Power Grid, 2 roles).
//
// Pure functions so the rules are exhaustively unit-testable: the puzzle
// splits INFORMATION (Engineer's sightline on the cipher) from ACTION
// (Technician's switchboard). Deliberately, neither function takes a solo
// flag — solo-swap is NOT an exemption from role separation (brief
// amendment 2026-07-04): the solo player swaps characters to change role.

import { SCANNER_POSITIONS, SCANNER_RANGE } from '../../../shared/scannerPuzzle.js'
import { LASER_ROLES, STATION_RANGE as LASER_STATION_RANGE } from '../../../shared/laserPuzzle.js'

export const SWITCHBOARD_POS = [5, 0]
export const HOLOGRAM_POS = [-5, 0]
// 3 m interaction radius around a 1.3 m console: forgiving enough that a
// hover-droid's post-input momentum drift (~0.8 m observed) doesn't drop the
// player out of range mid-interaction. Role separation is enforced by the
// role gate + the physical partition, not by a tight radius.
export const SWITCHBOARD_RANGE = 3
export const HOLOGRAM_RANGE = 3
// Hysteresis: once the terminal is open, it closes at RANGE + this margin —
// never flaps at the boundary.
export const RANGE_HYSTERESIS = 0.6

export function distanceXZ(position, [tx, tz]) {
  if (!position || position.length !== 3) return Infinity
  const [px, , pz] = position
  return Math.sqrt((px - tx) ** 2 + (pz - tz) ** 2)
}

/**
 * ACTION gate. @returns {'open'|'role-locked'|'out-of-range'}
 * Only a Technician in range operates the switchboard — any other role in
 * range is refused with a role lock.
 */
export function switchboardAccess(viewer, gamePhase = 'playing', range = SWITCHBOARD_RANGE) {
  if (!viewer || gamePhase !== 'playing') return 'out-of-range'
  const inRange = distanceXZ(viewer.position, SWITCHBOARD_POS) < range
  if (!inRange) return 'out-of-range'
  return viewer.role === 'technician' ? 'open' : 'role-locked'
}

/**
 * Puzzle 2 ACTION gate (Pillar A, 3 roles). Each scanner pedestal belongs to
 * exactly one role: only that role, standing at that pedestal, can arm it —
 * any other role in range is refused with a role lock. Combined with the
 * shared machine (which needs all three role slots armed inside the rolling
 * window), no subset of roles can complete P2. No solo parameter exists:
 * the solo player swaps characters to act as each role.
 * @returns {'arm'|'role-locked'|'out-of-range'}
 */
export function scannerAccess(viewer, scannerRole, gamePhase = 'playing', range = SCANNER_RANGE) {
  if (!viewer || gamePhase !== 'playing') return 'out-of-range'
  const pos = SCANNER_POSITIONS[scannerRole]
  if (!pos) return 'out-of-range'
  if (distanceXZ(viewer.position, pos) >= range) return 'out-of-range'
  return viewer.role === scannerRole ? 'arm' : 'role-locked'
}

// Which role may operate each P3 laser station. Mirror stations share the
// technician role (LASER_ROLES.mirror) regardless of index — the layout
// generator (shared/laserPuzzle.js createLaserLayout) decides WHERE the
// three mirrors sit per seed, not WHO may turn them.
const LASER_STATION_ROLE = {
  emitter: LASER_ROLES.emitter,
  mirror0: LASER_ROLES.mirror,
  mirror1: LASER_ROLES.mirror,
  mirror2: LASER_ROLES.mirror,
  receiver: LASER_ROLES.receiver,
}

/**
 * Puzzle 3 ACTION gate (Pillar A, 3 roles). Exactly one role may operate
 * each station kind: the Engineer steers the emitter, the Technician
 * rotates any mirror, the Overseer opens the receiver aperture. Any other
 * role in range is refused with a role lock. Mirror positions are
 * seed-dependent (shared/laserPuzzle.js createLaserLayout draws them per
 * room) so — unlike the fixed SCANNER_POSITIONS table — the caller passes
 * `position` explicitly for every station (emitter/receiver included, for
 * symmetry with the mirrors and so nothing here duplicates the shared
 * module's geometry constants). No solo parameter exists: the solo player
 * swaps characters to act as each role.
 * @param {{role:string, position:number[]}} viewer
 * @param {'emitter'|'mirror0'|'mirror1'|'mirror2'|'receiver'} station
 * @param {[number, number]} position station's live [x, z] deck position
 * @returns {'operate'|'role-locked'|'out-of-range'}
 */
export function laserStationAccess(
  viewer,
  station,
  position,
  gamePhase = 'playing',
  range = LASER_STATION_RANGE
) {
  const role = LASER_STATION_ROLE[station]
  if (!viewer || !role || !position || gamePhase !== 'playing') return 'out-of-range'
  if (distanceXZ(viewer.position, position) >= range) return 'out-of-range'
  return viewer.role === role ? 'operate' : 'role-locked'
}

/**
 * INFORMATION gate. The cipher is legible only through an Engineer's eyes,
 * within reading range of the projector.
 */
export function cipherLegible(viewer, gamePhase = 'playing') {
  if (!viewer || gamePhase !== 'playing') return false
  return (
    viewer.role === 'engineer' &&
    distanceXZ(viewer.position, HOLOGRAM_POS) < HOLOGRAM_RANGE
  )
}
