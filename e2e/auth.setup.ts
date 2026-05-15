import { test as setup, expect } from '@playwright/test'
import path from 'path'

// Authenticated storage state consumed by the chromium project
// (see playwright.config.ts `use.storageState`). Gitignored via
// .gitignore -> e2e/.auth/.
const authFile = path.join(__dirname, '.auth', 'user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  if (!email || !password) {
    throw new Error(
      'TEST_EMAIL and TEST_PASSWORD must be set (add them to .env.local; ' +
        'playwright.config.ts loads .env.local before tests run).',
    )
  }

  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')

  // The `login` server action redirects to /dashboard on success. If the
  // credentials are wrong the app stays on /login and this times out —
  // which is the correct, loud failure for a misconfigured test account.
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  await expect(page).toHaveURL(/\/dashboard/)

  await page.context().storageState({ path: authFile })
})
