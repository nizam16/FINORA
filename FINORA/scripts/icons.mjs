import { chromium } from '@playwright/test'
import { readFile, copyFile } from 'node:fs/promises'
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  for (const [file, size, mask] of [
    ['pwa-192.png', 192, false],
    ['pwa-512.png', 512, false],
    ['apple.png', 180, false],
    ['maskable.png', 512, true],
  ]) {
    const svg = await readFile(
      'public/icons/' + (mask ? 'mark.svg' : 'logo.svg'),
      'utf8',
    )
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<style>body{margin:0;display:grid;place-items:center;height:100vh;background:#171510}svg{width:${mask ? 65 : 100}%;height:${mask ? 65 : 100}%}</style>${svg}`,
    )
    await page.screenshot({ path: 'public/icons/' + file })
  }
  await copyFile('public/icons/pwa-512.png', 'public/icons/splash.png')
} finally {
  await browser.close()
}
