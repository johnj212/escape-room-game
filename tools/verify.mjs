#!/usr/bin/env node
// tools/verify.mjs — verification battery runner (Component 4).
//
// Spec: docs/superpowers/specs/2026-07-04-phase0-verification-harness-design.md, Component 4.
//
// Runs a phase's check manifest as REAL subprocesses (no stubs, no fabricated results),
// prints a numbered PASS/FAIL table, writes a machine-readable JSON summary to
// tools/.last-verify.json, and exits non-zero iff any HARD check failed.
//
// Phase 0: steps 4-5 (perf baseline / bundle size) are record-only and never affect the
// exit code — they exist to capture numbers, not to gate the phase.
// Phase 1: steps 4-5 become HARD perf-floor assertions (Project_Requirements.md §2) via
// `perf-probe.mjs --mode assert` on the desktop and mobile profiles. perf-probe builds the
// client as part of its run, so those steps get a generous 10-minute timeout each.
//
// CLI: node tools/verify.mjs [--phase <N>]   (default --phase 0)

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const SUMMARY_PATH = path.join(__dirname, '.last-verify.json')

function parseArgs(argv) {
  const args = { phase: 0 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--phase') args.phase = Number(argv[++i])
  }
  return args
}

const MAX_TAIL_LINES = 80

function tail(text, n = MAX_TAIL_LINES) {
  const lines = text.split('\n')
  return lines.slice(Math.max(0, lines.length - n)).join('\n')
}

function fmtDuration(ms) {
  if (ms == null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

// Runs `cmd args…` as a real child process, tee-ing its stdout/stderr live to this process's
// own streams (so a human watching `verify` sees full lint/test/e2e output as it happens)
// while also buffering everything for the JSON summary. Resolves on both success and failure —
// a non-zero exit code is a normal FAIL outcome for the caller to interpret, not a runner bug.
function runCommand(cmd, args, { cwd = REPO_ROOT, timeoutMs = 6 * 60_000 } = {}) {
  return new Promise((resolve) => {
    const start = Date.now()
    console.log(`\n$ ${cmd} ${args.join(' ')}  (cwd: ${path.relative(REPO_ROOT, cwd) || '.'})\n`)
    let child
    try {
      child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      resolve({
        code: null,
        signal: null,
        stdout: '',
        stderr: `[verify] failed to spawn '${cmd}': ${err.message}`,
        durationMs: Date.now() - start,
        timedOut: false,
      })
      return
    }

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const killTimer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk
      process.stdout.write(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      process.stderr.write(chunk)
    })

    child.on('error', (err) => {
      clearTimeout(killTimer)
      resolve({
        code: null,
        signal: null,
        stdout,
        stderr: stderr + `\n[verify] failed to spawn '${cmd}': ${err.message}`,
        durationMs: Date.now() - start,
        timedOut: false,
      })
    })

    child.on('close', (code, signal) => {
      clearTimeout(killTimer)
      resolve({
        code,
        signal,
        stdout,
        stderr,
        durationMs: Date.now() - start,
        timedOut,
      })
    })
  })
}

// ---------------------------------------------------------------------------
// Phase manifests
// ---------------------------------------------------------------------------

// Steps 1-3 are identical in every phase's battery (Project_Requirements.md §5): the static
// gate, the unit suite, and the e2e suite, all HARD. Defined once, id assigned per manifest.
function staticGateCheck(id) {
  return {
    id,
    name: 'Static gate (eslint, 0 warnings)',
    hard: true,
    async run() {
      const res = await runCommand('npm', ['run', 'lint', '--prefix', 'client'])
      return {
        pass: res.code === 0,
        status: res.code === 0 ? 'PASS' : 'FAIL',
        durationMs: res.durationMs,
        note: res.code === 0 ? '0 warnings/errors' : tail(res.stdout + res.stderr),
      }
    },
  }
}

function unitTestsCheck(id) {
  return {
    id,
    name: 'Unit tests (vitest)',
    hard: true,
    async run() {
      const res = await runCommand('npm', ['test', '--prefix', 'client'])
      return {
        pass: res.code === 0,
        status: res.code === 0 ? 'PASS' : 'FAIL',
        durationMs: res.durationMs,
        note: res.code === 0 ? 'all specs passed' : tail(res.stdout + res.stderr),
      }
    },
  }
}

function e2eCheck(id) {
  return {
    id,
    name: 'E2E (playwright)',
    hard: true,
    async run() {
      const res = await runCommand('npm', ['run', 'e2e', '--prefix', 'client'], {
        timeoutMs: 10 * 60_000,
      })
      return {
        pass: res.code === 0,
        status: res.code === 0 ? 'PASS' : 'FAIL',
        durationMs: res.durationMs,
        note: res.code === 0 ? 'e2e suite green' : tail(res.stdout + res.stderr),
      }
    },
  }
}

// Phase 1+: HARD perf-floor assertion for one profile via perf-probe assert mode
// (§2 floors: desktop fps>=60 / tris>=2M / JS+CSS gzip<=500KB excl. rapier-wasm chunk;
// mobile fps>=30 / tris>=0.5M — the floors live in perf-probe's FLOORS table).
// perf-probe builds the client as part of its run, hence the 10-minute timeout.
// Settle window before each perf measurement: the preceding battery steps
// (playwright, client builds) leave the machine busy — macOS Spotlight
// re-indexes fresh dist/ output, filesystem caches flush — and fps sampled
// in that residue reads several fps below steady state (measured 54 vs 60,
// 2026-07-08). Measurement hygiene, not a floor change.
const PERF_SETTLE_MS = 25_000

// A perf run whose GPU canary flags environment contention is INVALID, not
// failed — other processes were eating the GPU, so the number says nothing
// about the build (see perf-probe's canary comment). Retry up to
// PERF_MAX_ATTEMPTS with a settle between attempts; if every attempt is
// contended, report FAIL honestly with the contention note (never a fake
// pass) — re-run the battery on an idle machine.
const PERF_MAX_ATTEMPTS = 3

function perfFloorsCheck(id, profile) {
  return {
    id,
    name: `Perf floors ${profile} (perf-probe assert)`,
    hard: true,
    async run() {
      let last
      const start = Date.now()
      for (let attempt = 1; attempt <= PERF_MAX_ATTEMPTS; attempt++) {
        console.log(`[verify] settling ${PERF_SETTLE_MS / 1000}s before the ${profile} perf measurement (attempt ${attempt}/${PERF_MAX_ATTEMPTS})...`)
        await new Promise((r) => setTimeout(r, PERF_SETTLE_MS))
        last = await runCommand(
          'node',
          ['tools/perf-probe.mjs', '--mode', 'assert', '--profile', profile],
          { timeoutMs: 10 * 60_000 },
        )
        if (last.code === 0) {
          return {
            pass: true,
            status: 'PASS',
            durationMs: Date.now() - start,
            note: `§2 ${profile} floors met` + (attempt > 1 ? ` (attempt ${attempt}: earlier attempts were environment-contended)` : ''),
          }
        }
        const contended = /CONTENDED environment/.test(last.stdout + last.stderr)
        if (!contended) break // a clean-environment miss is a real miss
        console.log(`[verify] ${profile} perf attempt ${attempt} was environment-contended (GPU canary below threshold) — ${attempt < PERF_MAX_ATTEMPTS ? 'retrying' : 'out of attempts'}`)
      }
      return {
        pass: false,
        status: 'FAIL',
        durationMs: Date.now() - start,
        note: tail(last.stdout + last.stderr),
      }
    },
  }
}

function phase0Manifest() {
  return [
    staticGateCheck(1),
    unitTestsCheck(2),
    e2eCheck(3),
    {
      id: 4,
      name: 'Perf baseline (record-only)',
      hard: false,
      async run() {
        // Real subprocess call every time, per spec — not a stub. If tools/perf-probe.mjs
        // doesn't exist yet (it's being authored concurrently by another agent), Node itself
        // will fail to resolve the module; that specific failure is treated as "not landed
        // yet" and reported without failing the battery, since this step is record-only in
        // Phase 0 regardless of *why* it didn't produce numbers.
        const res = await runCommand('node', ['tools/perf-probe.mjs', '--mode', 'record'])
        const combined = res.stdout + res.stderr
        const moduleMissing =
          res.code !== 0 &&
          /cannot find module/i.test(combined) &&
          /perf-probe\.mjs/i.test(combined)

        if (moduleMissing) {
          return {
            pass: null,
            status: 'SKIP',
            durationMs: res.durationMs,
            note: 'record step: perf-probe.mjs not present yet',
          }
        }
        if (res.code === 0) {
          return {
            pass: true,
            status: 'RECORD',
            durationMs: res.durationMs,
            note: tail(res.stdout, 20) || 'recorded (see STATUS.md)',
          }
        }
        return {
          pass: null,
          status: 'RECORD-ERROR',
          durationMs: res.durationMs,
          note: `perf-probe.mjs ran but exited ${res.code} (record-only, non-blocking):\n${tail(combined)}`,
        }
      },
    },
    {
      id: 5,
      name: 'Bundle size (record-only, surfaced via step 4)',
      hard: false,
      // No independent subprocess — perf-probe.mjs builds the client and measures gzip
      // size as part of its own run (spec Component 3); this row just reflects that result
      // so the table has an explicit line for check #5 in Project_Requirements.md §5.
      async run(context) {
        const step4 = context.results.find((r) => r.id === 4)
        if (!step4) {
          return { pass: null, status: 'SKIP', durationMs: null, note: 'step 4 did not run' }
        }
        if (step4.status === 'SKIP') {
          return {
            pass: null,
            status: 'SKIP',
            durationMs: null,
            note: 'surfaced by step 4 (perf-probe.mjs not present yet)',
          }
        }
        return {
          pass: step4.pass,
          status: step4.status,
          durationMs: null,
          note: 'surfaced by step 4 — see that row / STATUS.md for the bundle-size numbers',
        }
      },
    },
  ]
}

// Phase 1 battery: same hard 1-3 as Phase 0, then the §2 perf floors become HARD gates —
// desktop and mobile profiles asserted separately, each against its own floor row.
function phase1Manifest() {
  return [
    staticGateCheck(1),
    unitTestsCheck(2),
    e2eCheck(3),
    perfFloorsCheck(4, 'desktop'),
    perfFloorsCheck(5, 'mobile'),
  ]
}

// Phase 2 battery: same hard 1-3, then a new HARD Pillar-D check (server-authority probe,
// tools/authority-probe.mjs — real server + 3 real socket.io-client connections proving
// fabricated events, teleports, wrong-role/out-of-range actions, and stage-order violations
// are all rejected, and that the legitimate P1->P2 chain and 3-role P2 solve still work) sits
// between the e2e suite and the §2 perf floors, which remain HARD as in Phase 1.
function phase2Manifest() {
  return [
    staticGateCheck(1),
    unitTestsCheck(2),
    e2eCheck(3),
    {
      id: 4,
      name: 'Server-authority probe (Pillar D)',
      hard: true,
      async run() {
        const res = await runCommand('node', ['tools/authority-probe.mjs'], {
          timeoutMs: 3 * 60_000,
        })
        return {
          pass: res.code === 0,
          status: res.code === 0 ? 'PASS' : 'FAIL',
          durationMs: res.durationMs,
          note: res.code === 0 ? 'all authority assertions passed' : tail(res.stdout + res.stderr),
        }
      },
    },
    perfFloorsCheck(5, 'desktop'),
    perfFloorsCheck(6, 'mobile'),
  ]
}

const MANIFESTS = {
  0: phase0Manifest,
  1: phase1Manifest,
  2: phase2Manifest,
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  const { phase } = parseArgs(process.argv.slice(2))
  const buildManifest = MANIFESTS[phase]

  if (!buildManifest) {
    console.error(
      `[verify] no check manifest defined for --phase ${phase}. Defined phases: ${Object.keys(MANIFESTS).join(', ')}`,
    )
    process.exitCode = 1
    return
  }

  const manifest = buildManifest()
  const results = []
  const context = { results }

  for (const check of manifest) {
    const outcome = await check.run(context)
    results.push({ id: check.id, name: check.name, hard: check.hard, ...outcome })
  }

  const hardFailures = results.filter((r) => r.hard && !r.pass)
  const overallPass = hardFailures.length === 0

  // ---- numbered PASS/FAIL table ----
  console.log(`\nPhase ${phase} verification battery\n${'='.repeat(70)}`)
  const idW = 3
  const nameW = Math.max(...results.map((r) => r.name.length), 'Check'.length) + 2
  const typeW = 12
  const header = `${'#'.padEnd(idW)}${'Check'.padEnd(nameW)}${'Type'.padEnd(typeW)}${'Result'.padEnd(9)}Time`
  console.log(header)
  console.log('-'.repeat(header.length + 6))
  for (const r of results) {
    const typeLabel = r.hard ? 'HARD' : 'record-only'
    console.log(
      `${String(r.id).padEnd(idW)}${r.name.padEnd(nameW)}${typeLabel.padEnd(typeW)}${r.status.padEnd(9)}${fmtDuration(r.durationMs)}`,
    )
  }
  console.log('='.repeat(70))

  for (const r of results) {
    if (r.status === 'FAIL' || r.status === 'RECORD-ERROR') {
      console.log(`\n--- [${r.id}] ${r.name} — ${r.status} ---`)
      console.log(r.note)
    }
  }

  const hardTotal = results.filter((r) => r.hard).length
  const hardPassed = hardTotal - hardFailures.length
  console.log(
    `\nHARD checks: ${hardPassed}/${hardTotal} passed → BATTERY: ${overallPass ? 'PASS' : 'FAIL'}`,
  )
  if (!overallPass) {
    console.log(`Failed: ${hardFailures.map((r) => `#${r.id} ${r.name}`).join(', ')}`)
  }

  const summary = {
    phase,
    timestamp: new Date().toISOString(),
    overallPass,
    hardTotal,
    hardPassed,
    checks: results,
  }
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2))
  console.log(`\n[verify] summary written to ${path.relative(REPO_ROOT, SUMMARY_PATH)}`)

  process.exitCode = overallPass ? 0 : 1
}

main().catch((err) => {
  console.error('[verify] runner crashed:', err)
  process.exitCode = 1
})
