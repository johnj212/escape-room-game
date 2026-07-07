#!/usr/bin/env node
// tools/capture-hero.mjs — Phase-0 verification harness, Component 2 (reference-delta capture).
//
// Spec: docs/superpowers/specs/2026-07-04-phase0-verification-harness-design.md, Component 2.
//
// Launches headless Chromium with the verified WebGPU flags (see
// client/playwright.config.js / client/e2e/puzzle1.spec.js — headless Chromium on this
// machine only returns a real hardware WebGPU adapter with these flags; irrelevant to the
// *current* WebGL app render itself, but kept identical to the proven e2e launch so this tool
// exercises the same browser configuration the rest of the harness relies on), at a fixed
// desktop profile (1440x810, dpr 2), drives the app into the solo playing state exactly as
// client/e2e/puzzle1.spec.js does, waits for window.__SCENE_READY__, lets the scene settle for
// a fixed number of rendered frames (deterministic — not a wall-clock race), then screenshots
// the <canvas> element to docs/shots/phase<N>-hero.png.
//
// CLI: node tools/capture-hero.mjs [--phase <N>] [--out <path>] [--gameplay]
// Default framing is the fixed hero vantage (`?hero=1`, GameCanvas.jsx HeroCamera) that
// matches reference/sector9_deck_hero.png's composition; --gameplay keeps the old
// follow-camera framing for gameplay-context shots.
// Self-contained: starts (and tears down) the Vite dev server itself if one isn't already
// running on BASE_URL, so `node tools/capture-hero.mjs` works with nothing else running.

import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const BASE_URL = 'http://localhost:5173'

// Identical to client/playwright.config.js's WEBGPU_ARGS — see that file's comment for why
// both flags are kept (stability across Chrome versions on this macOS/Apple-Silicon machine).
const WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--use-angle=metal']

const DESKTOP_PROFILE = { width: 1440, height: 810, deviceScaleFactor: 2 }

// Number of rendered frames to let the scene run after __SCENE_READY__ before the shot is
// taken, so the camera-follow lerp (client/src/components/GameCanvas.jsx CameraFollow) has
// stabilised. Fixed frame count, not a fixed wall-clock wait: deterministic regardless of
// machine speed variance.
const SETTLE_FRAMES = 90

function parseArgs(argv) {
  const args = { phase: 0, out: null, gameplay: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--phase') args.phase = Number(argv[++i])
    else if (a === '--out') args.out = argv[++i]
    else if (a === '--gameplay') args.gameplay = true
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

async function driveToPlayingState(page, { hero = true } = {}) {
  // ?seed pins the procedural layout; ?hero=1 selects the fixed hero vantage.
  await page.goto(BASE_URL + '/?seed=9' + (hero ? '&hero=1' : ''))
  const launchButton = page.getByRole('button', { name: /Launch Offline Reactor/i })
  await launchButton.waitFor({ state: 'visible', timeout: 15_000 })
  await launchButton.click()
  await page.waitForFunction(() => window.__SCENE_READY__ === true, null, { timeout: 20_000 })
}

async function freezeCheapNondeterminism(page) {
  // The 15-minute meltdown timer (gameStore.timer) ticks once/sec and is rendered as an HTML
  // overlay (client/src/components/UIOverlays.jsx), not inside the <canvas> we screenshot, so
  // it can't leak into the shot — but pin it anyway per the spec ("freeze obvious
  // non-determinism where cheap"), in case a future scene reads it for in-canvas effects.
  await page.evaluate(() => {
    const store = window.useGameStore
    if (store && typeof store.getState().setTimer === 'function') {
      store.getState().setTimer(900)
    }
  })
}

async function settleFrames(page, frames) {
  await page.evaluate((n) => {
    return new Promise((resolve) => {
      let count = 0
      function tick() {
        count += 1
        if (count >= n) resolve()
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }, frames)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const outPath = args.out
    ? path.resolve(REPO_ROOT, args.out)
    : path.join(REPO_ROOT, 'docs', 'shots', `phase${args.phase}-hero.png`)

  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  const devServer = await startDevServerIfNeeded()
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      args: WEBGPU_ARGS,
    })
    const context = await browser.newContext({
      viewport: { width: DESKTOP_PROFILE.width, height: DESKTOP_PROFILE.height },
      deviceScaleFactor: DESKTOP_PROFILE.deviceScaleFactor,
    })
    const page = await context.newPage()

    await driveToPlayingState(page, { hero: !args.gameplay })
    await freezeCheapNondeterminism(page)
    await settleFrames(page, SETTLE_FRAMES)

    const canvas = page.locator('canvas')
    await canvas.waitFor({ state: 'visible', timeout: 10_000 })
    await canvas.screenshot({ path: outPath })

    console.log(outPath)
  } finally {
    if (browser) await browser.close()
    stopDevServer(devServer)
  }
}

main().catch((err) => {
  console.error('[capture-hero] failed:', err)
  process.exitCode = 1
})
