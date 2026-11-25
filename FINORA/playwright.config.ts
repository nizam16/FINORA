import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 2,
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run demo',
    env: { FINORA_DEMO_PORT: '4173' },
    url: 'http://localhost:4173',
    reuseExistingServer: false,
  },
})
