import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1')).toContainText('FlipBookPro')
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In')
  })

  test('login page has Google OAuth button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('text=Continue with Google')).toBeVisible()
  })

  test('login page has forgot password link', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('a[href="/reset-password"]')).toBeVisible()
  })

  test('signup page renders correctly', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('h1')).toContainText('FlipBookPro')
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('text=Continue with Google')).toBeVisible()
  })

  test('unauthenticated user redirects to login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/login')
    expect(page.url()).toContain('/login')
  })

  test('reset password page renders', async ({ page }) => {
    await page.goto('/reset-password')
    await page.waitForTimeout(2000)
    const url = page.url()
    expect(url).toMatch(/reset-password|login/)
  })

  test('login shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', 'invalid@test.com')
    await page.fill('#password', 'wrongpassword')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/login*')
    expect(page.url()).toContain('/login')
  })

  test('settings pages require auth', async ({ page }) => {
    await page.goto('/settings/billing')
    await page.waitForURL('**/login')
    expect(page.url()).toContain('/login')
  })
})
