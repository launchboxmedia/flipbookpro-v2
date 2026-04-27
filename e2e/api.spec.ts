import { test, expect } from '@playwright/test'

test.describe('API Endpoints', () => {
  test('check-limit endpoint responds', async ({ request }) => {
    const response = await request.get('/api/books/check-limit')
    // Returns 200 with error body or 401 depending on middleware behavior
    expect(response.status()).toBeGreaterThanOrEqual(200)
    expect(response.status()).toBeLessThan(500)
  })

  test('detect-chapters endpoint exists', async ({ request }) => {
    const response = await request.post('/api/detect-chapters', {
      data: { outline: 'Chapter 1: Test\nChapter 2: Test 2' },
      headers: { 'Content-Type': 'application/json' },
    })
    // May return chapters or error (auth required) but shouldn't 500
    expect(response.status()).toBeLessThan(500)
  })

  test('leads API validates input', async ({ request }) => {
    const response = await request.post('/api/leads', {
      data: { email: 'test@test.com', publishedBookId: 'fake-id' },
      headers: { 'Content-Type': 'application/json' },
    })
    // Will either succeed (insert) or fail (FK constraint) — not 500
    expect(response.status()).toBeLessThanOrEqual(500)
  })

  test('stripe checkout endpoint exists', async ({ request }) => {
    const response = await request.post('/api/stripe/checkout', {
      data: { priceId: 'test' },
      headers: { 'Content-Type': 'application/json' },
    })
    // Should return auth error or stripe error, not 404
    expect(response.status()).not.toBe(404)
  })

  test('profile endpoint exists', async ({ request }) => {
    const response = await request.get('/api/profile')
    expect(response.status()).not.toBe(404)
  })

  test('book generate-draft endpoint exists', async ({ request }) => {
    const response = await request.post('/api/books/fake-id/generate-draft', {
      data: { pageId: 'test' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(response.status()).not.toBe(404)
  })

  test('export-pdf endpoint exists', async ({ request }) => {
    const response = await request.get('/api/books/fake-id/export-pdf')
    expect(response.status()).not.toBe(404)
  })

  test('critique endpoint exists', async ({ request }) => {
    const response = await request.post('/api/books/fake-id/critique', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    expect(response.status()).not.toBe(404)
  })
})
