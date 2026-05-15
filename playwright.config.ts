import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// The Playwright runner (unlike `next dev`) does not auto-load env
// files, so the auth.setup project would not see TEST_EMAIL /
// TEST_PASSWORD. Load .env.local explicitly. (dotenv is available
// transitively via Next; the standard Playwright auth-doc pattern.)
dotenv.config({ path: '.env.local' })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
  },
  projects: [
    // Runs first (chromium depends on it). Logs in once and writes the
    // authenticated storage state that the main project reuses, so the
    // real specs never pay the login cost and arrive already signed in.
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
