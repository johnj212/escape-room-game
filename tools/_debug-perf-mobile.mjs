import { chromium } from '@playwright/test'

const WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--use-angle=metal']
const BASE_URL = 'http://localhost:5173'

const browser = await chromium.launch({ headless: true, args: WEBGPU_ARGS })
const context = await browser.newContext({
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 1.5,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
})
const page = await context.newPage()

await page.goto(BASE_URL + '/')
const launchButton = page.getByRole('button', { name: /Launch Offline Reactor/i })
await launchButton.waitFor({ state: 'visible', timeout: 15000 })
await launchButton.click()
await page.waitForFunction(() => window.__SCENE_READY__ === true, null, { timeout: 20000 })

console.log('scene ready (mobile UA), now sampling every 300ms for 3s')
for (let i = 0; i < 10; i++) {
  const perf = await page.evaluate(() => window.__PERF__)
  console.log(i, JSON.stringify(perf))
  await new Promise((r) => setTimeout(r, 300))
}

await browser.close()
