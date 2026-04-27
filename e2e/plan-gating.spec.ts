import { test, expect } from '@playwright/test'

test.describe('Plan Gating', () => {
  test('PDF export handles unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/books/test-book-id/export-pdf', { maxRedirects: 0 })
    // Either 401 (API rejects) or 302 (middleware redirects)
    expect([401, 302, 307]).toContain(res.status())
  })

  test('protected routes redirect to login', async ({ page }) => {
    await page.goto('/resources')
    await page.waitForURL('**/login*')
    expect(page.url()).toContain('/login')
  })

  test('pricing page is public', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForTimeout(1000)
    expect(page.url()).toContain('/pricing')
  })

  test('read page is public', async ({ page }) => {
    await page.goto('/read/nonexistent-slug')
    await page.waitForTimeout(1000)
    // Should stay on /read/ (public) — may show error but won't redirect to login
    expect(page.url()).toContain('/read/')
  })
})
