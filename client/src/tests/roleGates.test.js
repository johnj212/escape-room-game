import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  switchboardAccess,
  cipherLegible,
  scannerAccess,
  laserStationAccess,
  SWITCHBOARD_POS,
  HOLOGRAM_POS,
} from '../game/roleGates'
import { SCANNER_ROLES, SCANNER_POSITIONS } from '../../../shared/scannerPuzzle.js'
import { LASER_ROLES, EMITTER_POS, RECEIVER_POS } from '../../../shared/laserPuzzle.js'

// Pillar A, Puzzle 1 (2 roles): automated proof that the puzzle cannot be
// driven by fewer than the required roles' sightline + inputs, and that
// solo-swap gets NO exemption (Project_Requirements.md Pillar A; brief
// amendment 2026-07-04). The gates are pure functions, so every
// role × proximity combination is enumerated here.

const at = ([x, z]) => [x, 1.2, z]
const nearSwitchboard = at(SWITCHBOARD_POS)
const nearHologram = at(HOLOGRAM_POS)
const farAway = [0, 1.2, 9]

const viewer = (role, position) => ({ role, position })

describe('Pillar A — Puzzle 1 role gates (no solo exemption)', () => {
  it('only the Technician can open the switchboard; every other role in range is role-locked', () => {
    expect(switchboardAccess(viewer('technician', nearSwitchboard))).toBe('open')
    expect(switchboardAccess(viewer('engineer', nearSwitchboard))).toBe('role-locked')
    expect(switchboardAccess(viewer('overseer', nearSwitchboard))).toBe('role-locked')
  })

  it('nobody operates the switchboard out of range, whatever the role', () => {
    for (const role of ['engineer', 'technician', 'overseer']) {
      expect(switchboardAccess(viewer(role, farAway))).toBe('out-of-range')
    }
  })

  it('the cipher is legible ONLY to an Engineer within projector range', () => {
    expect(cipherLegible(viewer('engineer', nearHologram))).toBe(true)
    expect(cipherLegible(viewer('technician', nearHologram))).toBe(false)
    expect(cipherLegible(viewer('overseer', nearHologram))).toBe(false)
    expect(cipherLegible(viewer('engineer', farAway))).toBe(false)
  })

  it('no single role holds both the information and the action (the 2-role proof)', () => {
    for (const role of ['engineer', 'technician', 'overseer']) {
      const canRead = cipherLegible(viewer(role, nearHologram))
      const canAct = switchboardAccess(viewer(role, nearSwitchboard)) === 'open'
      expect(canRead && canAct).toBe(false)
    }
    // ...and the two halves do exist, held by different roles.
    expect(cipherLegible(viewer('engineer', nearHologram))).toBe(true)
    expect(switchboardAccess(viewer('technician', nearSwitchboard))).toBe('open')
  })

  it('gates close outside the playing phase', () => {
    expect(switchboardAccess(viewer('technician', nearSwitchboard), 'lobby')).toBe('out-of-range')
    expect(cipherLegible(viewer('engineer', nearHologram), 'win')).toBe(false)
  })

  it('the solo-swap role bypass must never return (source audit)', () => {
    // The gates take no solo flag at all — solo changes WHICH character you
    // are, never what a role may do.
    const gateSource = fs.readFileSync(
      path.resolve(__dirname, '../game/roleGates.js'),
      'utf8'
    )
    expect(gateSource).not.toMatch(/isSolo/)

    // And WirePuzzle must not re-introduce the old `|| isSolo` collapse
    // (the exact bypass the 2026-07-04 brief amendment killed).
    const puzzleSource = fs.readFileSync(
      path.resolve(__dirname, '../components/WirePuzzle.jsx'),
      'utf8'
    )
    expect(puzzleSource).not.toMatch(/role\s*===\s*'technician'\s*\|\|\s*isSolo/)
    expect(puzzleSource).not.toMatch(/isSolo\s*\|\|.*role\s*===/)
  })
})

// Pillar A, Puzzle 2 (3 roles): each scanner pedestal arms only for its own
// role standing at it. Every role × pedestal combination is enumerated —
// combined with the shared machine's 2-role-subset proof
// (tests/scannerPuzzle.test.js), no pair of roles can complete P2.
describe('Pillar A — Puzzle 2 scanner gates (3 roles, no solo exemption)', () => {
  it('every role × pedestal combination: arm iff the role matches and is in range', () => {
    for (const scannerRole of SCANNER_ROLES) {
      for (const viewerRole of SCANNER_ROLES) {
        const atPedestal = viewer(viewerRole, at(SCANNER_POSITIONS[scannerRole]))
        const expected = viewerRole === scannerRole ? 'arm' : 'role-locked'
        expect(scannerAccess(atPedestal, scannerRole)).toBe(expected)
        expect(scannerAccess(viewer(viewerRole, [15, 1.2, 15]), scannerRole)).toBe('out-of-range')
      }
    }
  })

  it('exactly one role can arm each pedestal — three distinct actors are structurally required', () => {
    for (const scannerRole of SCANNER_ROLES) {
      const armers = SCANNER_ROLES.filter(
        (r) => scannerAccess(viewer(r, at(SCANNER_POSITIONS[scannerRole])), scannerRole) === 'arm'
      )
      expect(armers).toEqual([scannerRole])
    }
  })

  it('scanner gates close outside the playing phase and on bad input', () => {
    const eng = viewer('engineer', at(SCANNER_POSITIONS.engineer))
    expect(scannerAccess(eng, 'engineer', 'lobby')).toBe('out-of-range')
    expect(scannerAccess(null, 'engineer')).toBe('out-of-range')
    expect(scannerAccess(eng, 'not-a-role')).toBe('out-of-range')
  })
})

// Pillar A, Puzzle 3 (3 roles): each laser station belongs to exactly one
// role — the emitter to the Engineer, every mirror to the Technician, the
// receiver to the Overseer — regardless of where a given seed's layout
// places the mirrors (positions are passed in live, never hardcoded here).
// Every role × station × in/out-of-range combination is enumerated, proving
// no single role can operate all three station KINDS (emitter, mirror,
// receiver), matching the shared machine's structural no-single-role proofs.
describe('Pillar A — Puzzle 3 laser station gates (3 roles, no solo exemption)', () => {
  const ALL_ROLES = ['engineer', 'technician', 'overseer']
  // Seed-dependent-style mirror positions for the test — arbitrary points
  // distinct from EMITTER_POS/RECEIVER_POS, standing in for a live layout.
  const MIRROR_POS = { mirror0: [-2, 2], mirror1: [3, -3.5], mirror2: [0.5, 6] }
  const STATION_POS = {
    emitter: EMITTER_POS,
    mirror0: MIRROR_POS.mirror0,
    mirror1: MIRROR_POS.mirror1,
    mirror2: MIRROR_POS.mirror2,
    receiver: RECEIVER_POS,
  }
  const STATION_ROLE = {
    emitter: LASER_ROLES.emitter,
    mirror0: LASER_ROLES.mirror,
    mirror1: LASER_ROLES.mirror,
    mirror2: LASER_ROLES.mirror,
    receiver: LASER_ROLES.receiver,
  }
  const STATIONS = Object.keys(STATION_POS)
  const farAwayXZ = [40, 40]

  it('every role x station combination: operate iff the role matches and is in range', () => {
    for (const station of STATIONS) {
      const pos = STATION_POS[station]
      for (const role of ALL_ROLES) {
        const atStation = viewer(role, at(pos))
        const expected = role === STATION_ROLE[station] ? 'operate' : 'role-locked'
        expect(laserStationAccess(atStation, station, pos)).toBe(expected)
        expect(laserStationAccess(viewer(role, at(farAwayXZ)), station, pos)).toBe('out-of-range')
      }
    }
  })

  it('exactly one role can operate each station — three distinct actors are structurally required', () => {
    for (const station of STATIONS) {
      const pos = STATION_POS[station]
      const operators = ALL_ROLES.filter(
        (r) => laserStationAccess(viewer(r, at(pos)), station, pos) === 'operate'
      )
      expect(operators).toEqual([STATION_ROLE[station]])
    }
  })

  it('no single role can operate all three station KINDS (emitter, mirror, receiver)', () => {
    for (const role of ALL_ROLES) {
      const canEmitter = laserStationAccess(viewer(role, at(EMITTER_POS)), 'emitter', EMITTER_POS) === 'operate'
      const canMirror = ['mirror0', 'mirror1', 'mirror2'].some(
        (m) => laserStationAccess(viewer(role, at(MIRROR_POS[m])), m, MIRROR_POS[m]) === 'operate'
      )
      const canReceiver = laserStationAccess(viewer(role, at(RECEIVER_POS)), 'receiver', RECEIVER_POS) === 'operate'
      const kindsOperable = [canEmitter, canMirror, canReceiver].filter(Boolean).length
      expect(kindsOperable).toBe(1)
    }
    // ...and each kind IS operable by its own role.
    expect(laserStationAccess(viewer('engineer', at(EMITTER_POS)), 'emitter', EMITTER_POS)).toBe('operate')
    expect(laserStationAccess(viewer('technician', at(MIRROR_POS.mirror0)), 'mirror0', MIRROR_POS.mirror0)).toBe('operate')
    expect(laserStationAccess(viewer('overseer', at(RECEIVER_POS)), 'receiver', RECEIVER_POS)).toBe('operate')
  })

  it('laser station gates close outside the playing phase and on bad/missing input', () => {
    const eng = viewer('engineer', at(EMITTER_POS))
    expect(laserStationAccess(eng, 'emitter', EMITTER_POS, 'lobby')).toBe('out-of-range')
    expect(laserStationAccess(null, 'emitter', EMITTER_POS)).toBe('out-of-range')
    expect(laserStationAccess(eng, 'not-a-station', EMITTER_POS)).toBe('out-of-range')
    expect(laserStationAccess(eng, 'emitter', null)).toBe('out-of-range')
  })

  it('the solo-swap role bypass must never return for the laser gate either (source audit)', () => {
    const gateSource = fs.readFileSync(
      path.resolve(__dirname, '../game/roleGates.js'),
      'utf8'
    )
    expect(gateSource).not.toMatch(/isSolo/)
  })
})
