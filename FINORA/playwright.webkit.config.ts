import { defineConfig, devices } from '@playwright/test'
import config from './playwright.config'
export default defineConfig({
  ...config,
  use: { ...config.use, ...devices['iPhone 13'], browserName: 'webkit' },
  testMatch: 'finora.spec.ts',
  workers: 1,
})
