import { chromium } from '@playwright/test'

const WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--use-angle=metal']
const BASE_URL = 'http://localhost:5173'

const browser = await chromium.launch({ headless: true, args: WEBGPU_ARGS })
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  deviceScaleFactor: 2,
})
const page = await context.newPage()
page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()))
page.on('pageerror', (err) => console.log('[pageerror]', String(err)))

await page.goto(BASE_URL + '/')
const launchButton = page.getByRole('button', { name: /Launch Offline Reactor/i })
await launchButton.waitFor({ state: 'visible', timeout: 15000 })
await launchButton.click()
await page.waitForFunction(() => window.__SCENE_READY__ === true, null, { timeout: 20000 })

console.log('scene ready, now sampling every 200ms for 6s')
for (let i = 0; i < 30; i++) {
  const perf = await page.evaluate(() => window.__PERF__)
  console.log(i, JSON.stringify(perf))
  await new Promise((r) => setTimeout(r, 200))
}

await browser.close()
