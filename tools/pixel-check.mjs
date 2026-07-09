// pixel-check.mjs — reproducible luminance-band measurement for Pillar C
// ("no shadowed pixel crushed to flat black") and DELTA.md claims.
//
// Decodes the image in headless Chromium (canvas getImageData) so the repo
// needs no native image dependency — same toolchain as capture-hero.mjs.
//
// Usage:
//   node tools/pixel-check.mjs <image.png> [<image2.png> ...] \
//     [--band 0.85,1.0]      horizontal band as width fractions (default full)
//     [--rows 0.0,1.0]       vertical band as height fractions (default full)
//     [--threshold 0.05]     "near-black" luminance cutoff (default 0.05)
//
// Prints, per image: % of band pixels below threshold, mean luminance, and a
// 10-bucket luminance histogram. Luminance is Rec.709 on sRGB-decoded values
// (gamma-linearized), matching how "5% luminance" reads perceptually.

import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const images = []
let band = [0, 1]
let rows = [0, 1]
let threshold = 0.05

for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--band') band = args[++i].split(',').map(Number)
  else if (a === '--rows') rows = args[++i].split(',').map(Number)
  else if (a === '--threshold') threshold = Number(args[++i])
  else images.push(a)
}

if (images.length === 0) {
  console.error('usage: node tools/pixel-check.mjs <image.png> [...] [--band x0,x1] [--rows y0,y1] [--threshold t]')
  process.exit(2)
}

const browser = await chromium.launch()
const page = await browser.newPage()

for (const img of images) {
  const abs = path.resolve(img)
  if (!fs.existsSync(abs)) {
    console.error(`[pixel-check] missing: ${abs}`)
    process.exitCode = 2
    continue
  }
  const b64 = fs.readFileSync(abs).toString('base64')
  const ext = path.extname(abs).slice(1) || 'png'

  const stats = await page.evaluate(
    async ({ b64, ext, band, rows, threshold }) => {
      const image = new Image()
      image.src = `data:image/${ext};base64,${b64}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(image, 0, 0)

      const x0 = Math.floor(band[0] * canvas.width)
      const x1 = Math.ceil(band[1] * canvas.width)
      const y0 = Math.floor(rows[0] * canvas.height)
      const y1 = Math.ceil(rows[1] * canvas.height)
      const { data } = ctx.getImageData(x0, y0, x1 - x0, y1 - y0)

      const srgbToLinear = (c) =>
        c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

      let below = 0
      let sum = 0
      const hist = new Array(10).fill(0)
      const n = data.length / 4
      for (let i = 0; i < data.length; i += 4) {
        const r = srgbToLinear(data[i] / 255)
        const g = srgbToLinear(data[i + 1] / 255)
        const b = srgbToLinear(data[i + 2] / 255)
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        sum += lum
        if (lum < threshold) below++
        hist[Math.min(9, Math.floor(lum * 10))]++
      }
      return {
        width: canvas.width,
        height: canvas.height,
        region: { x0, x1, y0, y1 },
        pixels: n,
        pctBelow: (100 * below) / n,
        meanLum: sum / n,
        hist: hist.map((c) => (100 * c) / n),
      }
    },
    { b64, ext, band, rows, threshold }
  )

  console.log(`\n${img}  (${stats.width}x${stats.height})`)
  console.log(
    `  region x[${stats.region.x0},${stats.region.x1}) y[${stats.region.y0},${stats.region.y1})  ${stats.pixels} px`
  )
  console.log(
    `  < ${threshold} linear luminance : ${stats.pctBelow.toFixed(1)}%   mean: ${stats.meanLum.toFixed(4)}`
  )
  console.log(
    `  histogram (10 x 0.1 buckets, %): ${stats.hist.map((p) => p.toFixed(1)).join(' | ')}`
  )
}

await browser.close()
