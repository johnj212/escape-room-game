#!/usr/bin/env node
// tools/perf-probe.mjs — Phase-0 verification harness, Component 3 (scripted perf floors).
//
// Spec: docs/superpowers/specs/2026-07-04-phase0-verification-harness-design.md, Component 3.
//
// Launches headless Chromium with the verified WebGPU flags (same as client/playwright.config.js
// / client/e2e/puzzle1.spec.js), drives the app into the solo playing state, waits for
// window.__SCENE_READY__, samples window.__PERF__ (written every frame by the <PerfProbe />
// hook in client/src/components/GameCanvas.jsx) for >= 3s, and reports the MEDIAN fps /
// drawCalls / triangles. Then builds the client and measures the gzip size of the JS+CSS in
// client/dist (excluding .wasm, i.e. the Rapier physics binary).
//
// CLI: node tools/perf-probe.mjs [--profile desktop|mobile] [--mode record|assert]
//
// record mode (Phase 0): prints a table and writes/overwrites a
// "## Phase-0 baseline (WebGL)" block in STATUS.md. NEVER exits non-zero.
// assert mode (later phases, WebGPU floors from Project_Requirements.md §2): exits non-zero on
// any miss. Not used in Phase 0 — implemented here for when it is needed.
//
// Self-contained: starts (and tears down) the Vite dev server itself if one isn't already
// running on BASE_URL. Honors the workers:1 discipline from client/playwright.config.js — this
// script runs a single Chromium instance, sequentially, never in parallel with itself.

import { chromium } from '@playwright/test'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import path from 'node:path'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const gzip = promisify(zlib.gzip)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const CLIENT_DIR = path.join(REPO_ROOT, 'client')
const DIST_DIR = path.join(CLIENT_DIR, 'dist')
const STATUS_PATH = path.join(REPO_ROOT, 'STATUS.md')
const BASE_URL = 'http://localhost:5173'

// Identical to client/playwright.config.js's WEBGPU_ARGS.
const WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--use-angle=metal']

const PROFILES = {
  desktop: { width: 1440, height: 810, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
  mobile: { width: 360, height: 780, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true },
}

// §2 floors (Project_Requirements.md), WebGPU targets — only enforced in `assert` mode.
const FLOORS = {
  desktop: { fps: 60, triangles: 2_000_000, gzipBytes: 500 * 1024 },
  mobile: { fps: 30, triangles: 500_000, gzipBytes: null }, // bundle floor is not per-profile
}

const SAMPLE_DURATION_MS = 3_000
const SAMPLE_INTERVAL_MS = 100

function parseArgs(argv) {
  const args = { profile: 'desktop', mode: 'record' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--profile') args.profile = argv[++i]
    else if (a === '--mode') args.mode = argv[++i]
  }
  if (!PROFILES[args.profile]) {
    throw new Error(`--profile must be one of: ${Object.keys(PROFILES).join(', ')}`)
  }
  if (!['record', 'assert'].includes(args.mode)) {
    throw new Error(`--mode must be one of: record, assert`)
  }
  return args
}

async function isServerUp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isServerUp(url)) return
    await sleep(300)
  }
  throw new Error(`Dev server at ${url} did not become ready within ${timeoutMs}ms`)
}

async function startDevServerIfNeeded() {
  if (await isServerUp(BASE_URL)) {
    console.log(`[dev-server] reusing existing server at ${BASE_URL}`)
    return null
  }
  console.log('[dev-server] starting `npm run dev --prefix client`...')
  const child = spawn('npm', ['run', 'dev', '--prefix', 'client'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  await waitForServer(BASE_URL)
  console.log('[dev-server] ready')
  return child
}

function stopDevServer(child) {
  if (!child) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    // already gone
  }
}

async function driveToPlayingState(page) {
  await page.goto(BASE_URL + '/')
  const launchButton = page.getByRole('button', { name: /Launch Offline Reactor/i })
  await launchButton.waitFor({ state: 'visible', timeout: 15_000 })
  await launchButton.click()
  await page.waitForFunction(() => window.__SCENE_READY__ === true, null, { timeout: 20_000 })
}

async function sampleForDuration(page, durationMs, intervalMs) {
  const samples = []
  const start = Date.now()
  while (Date.now() - start < durationMs) {
    const perf = await page.evaluate(() => window.__PERF__ ?? null)
    if (perf) samples.push(perf)
    await sleep(intervalMs)
  }
  return samples
}

function median(nums) {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

async function measurePerf(profileName) {
  const profile = PROFILES[profileName]
  const devServer = await startDevServerIfNeeded()
  let browser
  try {
    browser = await chromium.launch({ headless: true, args: WEBGPU_ARGS })
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      deviceScaleFactor: profile.deviceScaleFactor,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
    })
    const page = await context.newPage()
    await driveToPlayingState(page)

    console.log(`[perf-probe] sampling __PERF__ for ${SAMPLE_DURATION_MS}ms (${profileName})...`)
    const samples = await sampleForDuration(page, SAMPLE_DURATION_MS, SAMPLE_INTERVAL_MS)
    if (samples.length === 0) {
      throw new Error('no __PERF__ samples collected — is the PerfProbe hook mounted?')
    }

    return {
      fps: median(samples.map((s) => s.fps)),
      drawCalls: median(samples.map((s) => s.drawCalls)),
      triangles: median(samples.map((s) => s.triangles)),
      sampleCount: samples.length,
    }
  } finally {
    if (browser) await browser.close()
    stopDevServer(devServer)
  }
}

async function walkFiles(dir) {
  const out = []
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(full)))
    } else {
      out.push(full)
    }
  }
  return out
}

async function buildClientAndMeasureBundle() {
  console.log('[perf-probe] building client (`npm run build --prefix client`)...')
  await execFileAsync('npm', ['run', 'build', '--prefix', 'client'], {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024 * 32,
  })

  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`expected build output at ${DIST_DIR}, but it does not exist`)
  }

  const files = await walkFiles(DIST_DIR)
  const jsCssFiles = files.filter((f) => /\.(js|css)$/i.test(f) && !/\.wasm$/i.test(f))
  const wasmFiles = files.filter((f) => /\.wasm$/i.test(f))

  let gzipBytes = 0
  for (const f of jsCssFiles) {
    const buf = await fs.promises.readFile(f)
    const gz = await gzip(buf, { level: 9 })
    gzipBytes += gz.length
  }

  return {
    gzipBytes,
    fileCount: jsCssFiles.length,
    excludedWasmCount: wasmFiles.length,
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

function printTable(profileName, perf, bundle) {
  const rows = [
    ['profile', profileName],
    ['fps (median)', perf.fps],
    ['drawCalls (median)', perf.drawCalls],
    ['triangles (median)', perf.triangles],
    ['samples', perf.sampleCount],
    ['JS+CSS gzip (excl. .wasm)', formatBytes(bundle.gzipBytes)],
    ['JS+CSS files measured', bundle.fileCount],
    ['.wasm files excluded', bundle.excludedWasmCount],
  ]
  const width = Math.max(...rows.map(([k]) => k.length))
  console.log('')
  console.log('Phase-0 perf-probe results (WebGL, current pre-Phase-1 build)')
  console.log('-'.repeat(width + 20))
  for (const [k, v] of rows) {
    console.log(`${k.padEnd(width)} : ${v}`)
  }
  console.log('-'.repeat(width + 20))
}

function buildStatusBlock(profileName, perf, bundle) {
  const date = new Date().toISOString().slice(0, 10)
  return [
    '## Phase-0 baseline (WebGL)',
    '',
    `Recorded ${date} via \`node tools/perf-probe.mjs --mode record --profile ${profileName}\` ` +
      `(pre-Phase-1 R3F v8 WebGLRenderer build, ${PROFILES[profileName].width}x${PROFILES[profileName].height} ` +
      `dpr${PROFILES[profileName].deviceScaleFactor}).`,
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| fps (median) | ${perf.fps} |`,
    `| drawCalls (median) | ${perf.drawCalls} |`,
    `| triangles (median) | ${perf.triangles} |`,
    `| samples | ${perf.sampleCount} |`,
    `| JS+CSS gzip, client/dist, excl. .wasm | ${formatBytes(bundle.gzipBytes)} (${bundle.gzipBytes} bytes) |`,
    '',
    '_Phase 0 records the current WebGL numbers only — not compared against the WebGPU floors ' +
      'in `Project_Requirements.md` §2 (desktop >=60fps/>=2M tris/<=500KB gzip, mobile ' +
      '>=30fps/>=0.5M tris). `perf-probe.mjs --mode assert` enforces those floors from Phase 1 onward._',
    '',
  ].join('\n')
}

function writeStatusBlock(block) {
  const original = fs.readFileSync(STATUS_PATH, 'utf8')
  const headingRe = /^## Phase-0 baseline \(WebGL\)\s*$/m

  if (headingRe.test(original)) {
    // Replace the existing block: from this heading up to (not including) the next top-level
    // "## " heading, or end of file.
    const startMatch = original.match(headingRe)
    const startIdx = startMatch.index
    const rest = original.slice(startIdx + startMatch[0].length)
    const nextHeadingRel = rest.search(/\n## /)
    const endIdx = nextHeadingRel === -1 ? original.length : startIdx + startMatch[0].length + nextHeadingRel + 1
    const updated = original.slice(0, startIdx) + block + original.slice(endIdx)
    fs.writeFileSync(STATUS_PATH, updated)
    return 'overwrote existing block'
  }

  // Insert near the top's "Current focus" section: right before "## Next actions" if present,
  // otherwise append at end of file.
  const nextActionsIdx = original.indexOf('\n## Next actions')
  if (nextActionsIdx !== -1) {
    const updated =
      original.slice(0, nextActionsIdx + 1) + block + '\n' + original.slice(nextActionsIdx + 1)
    fs.writeFileSync(STATUS_PATH, updated)
    return 'inserted before ## Next actions'
  }

  const updated = original.replace(/\s*$/, '\n\n') + block
  fs.writeFileSync(STATUS_PATH, updated)
  return 'appended at end of file'
}

function assertFloors(profileName, perf, bundle) {
  const floor = FLOORS[profileName]
  const failures = []
  if (perf.fps < floor.fps) failures.push(`fps ${perf.fps} < floor ${floor.fps}`)
  if (perf.triangles < floor.triangles) failures.push(`triangles ${perf.triangles} < floor ${floor.triangles}`)
  if (floor.gzipBytes != null && bundle.gzipBytes > floor.gzipBytes) {
    failures.push(`gzip ${bundle.gzipBytes}B > floor ${floor.gzipBytes}B`)
  }
  return failures
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const perf = await measurePerf(args.profile)
  const bundle = await buildClientAndMeasureBundle()

  printTable(args.profile, perf, bundle)

  if (args.mode === 'record') {
    const block = buildStatusBlock(args.profile, perf, bundle)
    const action = writeStatusBlock(block)
    console.log(`[perf-probe] STATUS.md updated (${action}): ${STATUS_PATH}`)
    // record mode never fails.
    return
  }

  // assert mode
  const failures = assertFloors(args.profile, perf, bundle)
  if (failures.length > 0) {
    console.error(`[perf-probe] ASSERT FAILED (${args.profile}):`)
    for (const f of failures) console.error(`  - ${f}`)
    process.exitCode = 1
  } else {
    console.log(`[perf-probe] ASSERT PASSED (${args.profile}): all floors met.`)
  }
}

main().catch((err) => {
  console.error('[perf-probe] failed:', err)
  process.exitCode = 1
})
