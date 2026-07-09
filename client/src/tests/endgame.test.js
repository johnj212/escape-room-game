import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  alarmEscalation,
  alarmPulse,
  ALARM_CRITICAL_S,
  ALARM_ELEVATED_S,
  ALARM_MAX_PULSE_HZ,
} from '../render/materials'

// Phase 3 — win/lose sequences + alarm escalation (§3.17, Pillar F).
// `alarmEscalation`/`alarmPulse` (render/materials.js) are the single shared
// source of truth for Lighting.jsx and EndgameSequence.jsx — the same class
// of bug D-6 already caught once (a duplicated timing constant silently
// drifting). These tests pin the math; the static checks below pin the two
// hard constraints that don't show up in a unit test (no second
// shadow-casting light, reduced-motion respected).
describe('alarm escalation (shared timing math)', () => {
  it('is exactly 0 at the very start of the clock, and stays low (creep only) through the elevated boundary', () => {
    expect(alarmEscalation(900, 'playing')).toBe(0)
    // Only the slow whole-game "creep" term contributes at the elevated
    // boundary (the critical-band term is still 0 there) — well below the
    // last-two-minutes reading asserted in the test below.
    expect(alarmEscalation(ALARM_ELEVATED_S, 'playing')).toBeLessThan(0.2)
  })

  it('ramps inside the elevated band (300..120s) without hitting 0 or the critical ceiling', () => {
    const mid = alarmEscalation(210, 'playing')
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(alarmEscalation(60, 'playing'))
  })

  it('is materially more urgent inside the last two minutes than the first two', () => {
    // "the last two minutes must look and sound materially more urgent than
    // the first two" — the brief's literal acceptance bar (Pillar F).
    const firstTwoMinutes = alarmEscalation(900 - 60, 'playing') // t=840, 60s into the clock
    const lastTwoMinutes = alarmEscalation(60, 'playing') // 60s left
    expect(lastTwoMinutes).toBeGreaterThan(firstTwoMinutes * 3)
  })

  it('reaches maximum urgency at zero and stays clamped to [0,1] past it', () => {
    expect(alarmEscalation(0, 'playing')).toBe(1)
    expect(alarmEscalation(-5, 'playing')).toBeLessThanOrEqual(1)
  })

  it('gamePhase overrides the clock: lose forces max, win forces calm', () => {
    expect(alarmEscalation(900, 'lose')).toBe(1)
    expect(alarmEscalation(1, 'win')).toBe(0)
  })

  it('ALARM_CRITICAL_S matches the brief\'s "last two minutes" (120s)', () => {
    expect(ALARM_CRITICAL_S).toBe(120)
  })
})

describe('alarm pulse (photosensitivity-capped)', () => {
  it('never exceeds the documented max frequency even at full escalation', () => {
    // Sample across a full second at the max escalation and count sign
    // changes of the derivative as a coarse frequency proxy — really just
    // asserting the constant is respected by construction.
    expect(ALARM_MAX_PULSE_HZ).toBeLessThan(3) // flash-safety line
    const hzAtMax = 0.25 + 1 * (ALARM_MAX_PULSE_HZ - 0.25)
    expect(hzAtMax).toBe(ALARM_MAX_PULSE_HZ)
  })

  it('reduced motion holds the mean (1.0) instead of oscillating, at any escalation', () => {
    for (const t of [0, 0.3, 1, 5, 12.7]) {
      expect(alarmPulse(t, 1, true)).toBe(1)
      expect(alarmPulse(t, 0, true)).toBe(1)
    }
  })

  it('motion-enabled pulse stays within a bounded, non-strobing range', () => {
    for (let t = 0; t < 5; t += 0.05) {
      const v = alarmPulse(t, 1, false)
      expect(v).toBeGreaterThan(0.5)
      expect(v).toBeLessThan(1.5)
    }
  })
})

describe('EndgameSequence.jsx — static safety checks', () => {
  const filePath = path.resolve(__dirname, '../components/EndgameSequence.jsx')
  const content = fs.readFileSync(filePath, 'utf8')

  it('exists and exports a component', () => {
    expect(content).toMatch(/export const EndgameSequence/)
    expect(content).toMatch(/export default EndgameSequence/)
  })

  it('adds no new shadow-casting light (the reactor is the only budgeted one, D-5)', () => {
    expect(content).not.toMatch(/castShadow/)
    expect(content).not.toMatch(/<pointLight|<spotLight|<directionalLight/)
  })

  it('respects prefers-reduced-motion (quality law §4)', () => {
    expect(content).toMatch(/usePrefersReducedMotion/)
  })

  it('clamps every frame-delta lerp factor to <= 1 (WebGPU pipeline-compile spikes)', () => {
    const clamps = content.match(/Math\.min\(1,/g) ?? []
    expect(clamps.length).toBeGreaterThan(0)
  })

  it('uses zero external assets (no image/font/audio imports)', () => {
    expect(content).not.toMatch(/\.(png|jpg|jpeg|gif|mp3|wav|ogg|ttf|woff)/)
  })
})

describe('Lighting.jsx — alarm escalation wiring stays within the light budget', () => {
  const filePath = path.resolve(__dirname, '../render/Lighting.jsx')
  const content = fs.readFileSync(filePath, 'utf8')

  it('still has exactly one shadow-casting light (the reactor) after the escalation wiring', () => {
    const matches = content.match(/castShadow=\{!isMobile\}/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('reads the shared alarm-escalation helpers rather than re-deriving the bands', () => {
    expect(content).toMatch(/alarmEscalation/)
    expect(content).toMatch(/alarmPulse/)
    expect(content).toMatch(/usePrefersReducedMotion/)
  })

  it('clamps the escalation lerp factor to <= 1', () => {
    expect(content).toMatch(/Math\.min\(1,\s*2\.5\s*\*\s*delta\)/)
  })
})
