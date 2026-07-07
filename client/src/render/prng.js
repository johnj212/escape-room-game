// Seeded PRNG for all procedural layout decisions (§1 Determinism:
// `?seed=N` must reproduce the deck — greeble placement, panel variation,
// cable sag — for repeatable testing and stable reference-delta shots).

export function getWorldSeed() {
  const param = new URLSearchParams(window.location.search).get('seed')
  const n = Number.parseInt(param ?? '', 10)
  return Number.isFinite(n) ? n : 9 // Sector-9 default
}

// mulberry32 — tiny, fast, good-enough distribution for layout jitter.
export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Derive an independent stream so subsystems don't perturb each other's
 *  sequences when their draw counts change. */
export function streamFor(seed, label) {
  let h = seed >>> 0
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x9e3779b1)
  }
  return mulberry32(h)
}
