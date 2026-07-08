// Puzzle 2 (Tri-Vector Hand Scanners) state-machine spec — deterministic,
// clock-injected. This is the shared module both the authoritative server and
// the solo client run, so these tests ARE the puzzle rules.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  SCANNER_ROLES,
  ARM_WINDOW_MS,
  LATCH_MS,
  LOCKOUT_MS,
  createScannerState,
  activateScanners,
  armScanner,
  tickScanners,
  isScannerArmed,
  lockoutRemaining,
} from '../../../shared/scannerPuzzle.js'

const T0 = 100_000

function activeState() {
  return activateScanners(createScannerState())
}

function armAll(state, times) {
  let s = state
  const results = []
  for (const [i, role] of SCANNER_ROLES.entries()) {
    const r = armScanner(s, role, times[i])
    s = r.state
    results.push(r.result)
  }
  return { state: s, results }
}

describe('scanner puzzle — lifecycle', () => {
  it('starts locked and rejects arming until P1 unlocks it', () => {
    const s = createScannerState()
    expect(s.status).toBe('locked')
    const { state, result } = armScanner(s, 'engineer', T0)
    expect(result).toBe('rejected-locked')
    expect(state.armedAt.engineer).toBeNull()
  })

  it('activateScanners flips locked → active and is idempotent', () => {
    const s = activeState()
    expect(s.status).toBe('active')
    expect(activateScanners(s).status).toBe('active')
  })

  it('solves when all three arm within the rolling window', () => {
    const { state, results } = armAll(activeState(), [T0, T0 + 600, T0 + ARM_WINDOW_MS])
    expect(results).toEqual(['armed', 'armed', 'solved'])
    expect(state.status).toBe('solved')
    expect(state.solved).toBe(true)
  })

  it('order of roles does not matter, spread does', () => {
    let s = activeState()
    s = armScanner(s, 'overseer', T0).state
    s = armScanner(s, 'technician', T0 + 200).state
    const r = armScanner(s, 'engineer', T0 + 900)
    expect(r.result).toBe('solved')
  })
})

describe('scanner puzzle — failure → lockout cooldown', () => {
  it('third arm outside the window fails and locks out', () => {
    const t3 = T0 + ARM_WINDOW_MS + 1
    const { state, results } = armAll(activeState(), [T0, T0 + 100, t3])
    expect(results[2]).toBe('failed-window')
    expect(state.status).toBe('lockout')
    expect(state.armedAt).toEqual({ engineer: null, technician: null, overseer: null })
    expect(state.failCount).toBe(1)
    expect(lockoutRemaining(state, t3)).toBe(LOCKOUT_MS)
  })

  it('a latch expiring with an incomplete set fails and locks out', () => {
    let s = armScanner(activeState(), 'engineer', T0).state
    s = tickScanners(s, T0 + LATCH_MS - 1)
    expect(s.status).toBe('active') // still latched
    s = tickScanners(s, T0 + LATCH_MS)
    expect(s.status).toBe('lockout')
    expect(s.failCount).toBe(1)
  })

  it('arming during lockout is rejected', () => {
    const { state } = armAll(activeState(), [T0, T0, T0 + ARM_WINDOW_MS + 500])
    const r = armScanner(state, 'engineer', T0 + ARM_WINDOW_MS + 600)
    expect(r.result).toBe('rejected-lockout')
  })

  it('lockout expires back to active and the puzzle is solvable again', () => {
    const { state } = armAll(activeState(), [T0, T0, T0 + ARM_WINDOW_MS + 500])
    const after = state.lockoutUntil
    const s2 = tickScanners(state, after)
    expect(s2.status).toBe('active')
    const { state: s3, results } = armAll(s2, [after + 10, after + 20, after + 30])
    expect(results[2]).toBe('solved')
    expect(s3.failCount).toBe(1) // history kept
  })

  it('armScanner lets a due lockout expire before judging (no dead state)', () => {
    const { state } = armAll(activeState(), [T0, T0, T0 + ARM_WINDOW_MS + 500])
    const r = armScanner(state, 'overseer', state.lockoutUntil + 1)
    expect(r.result).toBe('armed')
  })
})

describe('scanner puzzle — latch (solo-swap carrier)', () => {
  it('an armed scanner stays latched across the swap gap', () => {
    let s = armScanner(activeState(), 'engineer', T0).state
    // Solo player swaps characters; time passes but < LATCH_MS.
    s = tickScanners(s, T0 + 1000)
    expect(isScannerArmed(s, 'engineer', T0 + 1000)).toBe(true)
    s = armScanner(s, 'technician', T0 + 700).state
    const r = armScanner(s, 'overseer', T0 + 1400)
    expect(r.result).toBe('solved')
  })

  it('re-arming an already-latched scanner is rejected (no window reset abuse)', () => {
    let s = armScanner(activeState(), 'engineer', T0).state
    const r = armScanner(s, 'engineer', T0 + 500)
    expect(r.result).toBe('rejected-already-armed')
  })
})

describe('Pillar A — three roles are structurally required', () => {
  it('every 2-role subset can never reach solved, whatever the timing', () => {
    for (const missing of SCANNER_ROLES) {
      const pair = SCANNER_ROLES.filter((r) => r !== missing)
      let s = activeState()
      // Exhaust what two roles can do: arm both instantly, repeatedly, forever.
      for (let attempt = 0; attempt < 5; attempt++) {
        const t = T0 + attempt * (LATCH_MS + LOCKOUT_MS + 100)
        for (const role of pair) {
          const r = armScanner(s, role, t)
          s = r.state
          expect(r.result).not.toBe('solved')
        }
        // Ride time forward through latch expiry + lockout.
        s = tickScanners(s, t + LATCH_MS)
        s = tickScanners(s, t + LATCH_MS + LOCKOUT_MS)
      }
      expect(s.status).not.toBe('solved')
      expect(s.solved).toBe(false)
    }
  })

  it('an unknown/duplicate role slot cannot arm anything', () => {
    const r = armScanner(activeState(), 'intruder', T0)
    expect(r.result).toBe('rejected-role')
  })

  it('source audit: the machine has no solo parameter or bypass', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../shared/scannerPuzzle.js'),
      'utf8',
    )
    expect(src).not.toMatch(/isSolo/)
    // 'solo' may appear in comments, never as an identifier being read/assigned.
    expect(src).not.toMatch(/\bsolo\w*\s*[=),.]/i)
  })
})
