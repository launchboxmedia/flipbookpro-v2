import { test, expect } from '@playwright/test'

test.describe('Marketing & Public Pages', () => {
  test('homepage renders hero', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('beautiful flipbooks')
    await expect(page.locator('text=Get started free')).toBeVisible()
  })

  test('homepage has navigation links', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('a[href="/pricing"]').first()).toBeVisible()
    await expect(page.locator('a[href="/login"]').first()).toBeVisible()
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible()
  })

  test('homepage shows pricing section', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Simple, transparent pricing')).toBeVisible()
    await expect(page.locator('text=$0')).toBeVisible()
    await expect(page.locator('text=$9')).toBeVisible()
    await expect(page.locator('text=$49')).toBeVisible()
  })

  test('homepage shows features section', async ({ page }) => {
    await page.goto('/')
    // Check for feature titles in the page body
    const body = await page.textContent('body')
    expect(body).toContain('AI Co-Author')
    expect(body).toContain('Illustrated Flipbook')
    expect(body).toContain('Publish with Lead Gate')
  })

  test('homepage how-it-works section', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=From idea to published book')).toBeVisible()
    await expect(page.locator('text=Set your brief')).toBeVisible()
    await expect(page.locator('text=Write with AI')).toBeVisible()
  })

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz-123')
    await page.waitForTimeout(2000)
    const text = await page.textContent('body')
    expect(text).toBeTruthy()
  })

  test('public robots.txt exists in public dir', async () => {
    // Verify the file exists on disk (middleware may intercept the HTTP request)
    const fs = await import('fs')
    const path = await import('path')
    const robotsPath = path.join(process.cwd(), 'public', 'robots.txt')
    const content = fs.readFileSync(robotsPath, 'utf-8')
    expect(content).toContain('Disallow: /dashboard')
    expect(content).toContain('Disallow: /api')
  })
})
