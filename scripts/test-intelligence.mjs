#!/usr/bin/env node
/**
 * CLI smoke test for the intelligence routes.
 *   1. POST /api/profile/enrich            (Firecrawl + Sonnet)
 *   2. POST /api/books/[id]/research-chapter   (Perplexity Sonar)
 *
 * Auth model: the routes are cookie-gated (Supabase SSR). This script
 * doesn't try to log in itself — it expects you to paste the auth cookie
 * from a logged-in browser session. That keeps the script tiny and
 * portable, and avoids storing email/password anywhere.
 *
 * ── How to run ──────────────────────────────────────────────────────────
 *   1. Start the dev server:   npm run dev
 *   2. Sign in at the dev URL (default http://localhost:3002)
 *   3. DevTools → Application → Cookies → http://localhost:3002
 *      Copy the FULL "Cookie" header value. Easiest path:
 *        - DevTools → Network tab → click any request to your dev server
 *        - Right-click → Copy → Copy as cURL
 *        - From the curl line, find the `-H "cookie: ..."` chunk and grab
 *          the part after "cookie:".
 *      Or in DevTools → Application → Cookies, copy each row's value
 *      and join them as `name=value; name=value; ...`.
 *
 *   4. Set env (PowerShell):
 *      $env:SUPABASE_COOKIE = '<paste here>'
 *      $env:WEBSITE_URL     = 'https://yourwebsite.com'
 *      $env:BOOK_ID         = '<book uuid>'
 *      $env:CHAPTER_INDEX   = '0'             # default 0
 *
 *   5. Run:    npm run test:intel
 *      (or:   node scripts/test-intelligence.mjs)
 *
 * ── Skipping individual tests ───────────────────────────────────────────
 *   SKIP_ENRICH=1     skip the enrich call
 *   SKIP_RESEARCH=1   skip the research-chapter call
 *   BASE_URL=...      override default http://localhost:3002
 *
 * Both routes return JSON. The script prints status, elapsed ms, the
 * decoded response body, and a one-line success/failure summary at the
 * end. Exit code is 0 if every attempted call succeeded, 1 otherwise.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3002'
const COOKIE   = (process.env.SUPABASE_COOKIE ?? '').trim()

if (!COOKIE) {
  console.error('Missing SUPABASE_COOKIE env var. See script header for setup.')
  process.exit(2)
}

const HEADERS = {
  'Content-Type': 'application/json',
  Cookie: COOKIE,
}

function fmt(elapsed) {
  if (elapsed < 1000) return `${elapsed}ms`
  return `${(elapsed / 1000).toFixed(1)}s`
}

async function postJson(path, body) {
  const url = `${BASE_URL}${path}`
  const start = Date.now()
  process.stdout.write(`→ POST ${path} … `)
  let res, json, elapsed
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
    })
    elapsed = Date.now() - start
  } catch (e) {
    elapsed = Date.now() - start
    console.log(`network error (${fmt(elapsed)})`)
    console.error(`  ${e.message}`)
    return { ok: false, status: 0, json: null, elapsed }
  }
  try {
    json = await res.json()
  } catch {
    json = { _parseError: 'response was not JSON' }
  }
  console.log(`${res.status} ${res.statusText} (${fmt(elapsed)})`)
  return { ok: res.ok, status: res.status, json, elapsed }
}

function printJson(label, value) {
  console.log(`  ${label}:`)
  for (const line of JSON.stringify(value, null, 2).split('\n')) {
    console.log(`    ${line}`)
  }
}

async function testEnrich() {
  const websiteUrl = process.env.WEBSITE_URL
  if (!websiteUrl) {
    console.log('⚠ Skipping enrich — set WEBSITE_URL env var to enable.\n')
    return null
  }
  console.log('=== /api/profile/enrich ===')
  console.log(`  websiteUrl: ${websiteUrl}`)
  const result = await postJson('/api/profile/enrich', { websiteUrl })

  if (result.ok && result.json) {
    const fields = Array.isArray(result.json.fieldsUpdated) ? result.json.fieldsUpdated : []
    console.log(`  ✓ ${fields.length} field${fields.length === 1 ? '' : 's'} updated`)
    if (fields.length > 0) console.log(`    ${fields.join(', ')}`)
    if (result.json.profile) printJson('extracted', result.json.profile)
  } else if (result.json) {
    console.log(`  ✗ ${result.json.error ?? 'unknown failure'}`)
  }
  console.log()
  return result
}

async function testResearch() {
  const bookId = process.env.BOOK_ID
  if (!bookId) {
    console.log('⚠ Skipping research — set BOOK_ID env var to enable.\n')
    return null
  }
  const chapterIndex = Number(process.env.CHAPTER_INDEX ?? '0')
  if (!Number.isFinite(chapterIndex) || chapterIndex < 0) {
    console.log(`⚠ CHAPTER_INDEX must be a non-negative integer, got "${process.env.CHAPTER_INDEX}". Skipping.\n`)
    return null
  }
  console.log('=== /api/books/[bookId]/research-chapter ===')
  console.log(`  bookId: ${bookId}`)
  console.log(`  chapterIndex: ${chapterIndex}`)
  const result = await postJson(`/api/books/${bookId}/research-chapter`, { chapterIndex })

  if (result.ok && result.json) {
    const facts = Array.isArray(result.json.facts) ? result.json.facts : []
    const cits  = Array.isArray(result.json.citations) ? result.json.citations : []
    console.log(`  ✓ ${facts.length} fact${facts.length === 1 ? '' : 's'}, ${cits.length} citation${cits.length === 1 ? '' : 's'}`)
    facts.forEach((f, i) => {
      const truncated = f.length > 140 ? f.slice(0, 140) + '…' : f
      console.log(`    ${i + 1}. ${truncated}`)
    })
    cits.forEach((c) => {
      console.log(`    → ${c.title} — ${c.url}`)
    })
  } else if (result.json) {
    console.log(`  ✗ ${result.json.error ?? 'unknown failure'}`)
  }
  console.log()
  return result
}

async function main() {
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Cookie:   ${COOKIE.slice(0, 40)}…\n`)

  const ranEnrich   = process.env.SKIP_ENRICH   ? null : await testEnrich()
  const ranResearch = process.env.SKIP_RESEARCH ? null : await testResearch()

  // Aggregate exit code: failure if any executed call failed.
  const failures = [ranEnrich, ranResearch].filter((r) => r && !r.ok)
  if (failures.length > 0) {
    console.log(`✗ ${failures.length} failure${failures.length === 1 ? '' : 's'}`)
    process.exit(1)
  }
  if (ranEnrich || ranResearch) {
    console.log('✓ All attempted calls succeeded')
  } else {
    console.log('Nothing to do — set WEBSITE_URL and/or BOOK_ID to run something.')
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
