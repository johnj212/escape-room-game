import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  switchboardAccess,
  cipherLegible,
  scannerAccess,
  SWITCHBOARD_POS,
  HOLOGRAM_POS,
} from '../game/roleGates'
import { SCANNER_ROLES, SCANNER_POSITIONS } from '../../../shared/scannerPuzzle.js'

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
