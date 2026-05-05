#!/usr/bin/env node
/**
 * Direct smoke test of the third-party APIs the intelligence routes depend on.
 * Hits Firecrawl Map, Firecrawl Scrape, and Perplexity Sonar with the same
 * payload shapes the routes use. No Supabase auth involved, no DB writes,
 * no /api/* round-trip — this just verifies the keys are valid and the
 * external services are responding to our exact request shapes.
 *
 * Run with `node --env-file=.env.local scripts/smoke-third-party.mjs`.
 */

const FIRECRAWL = process.env.FIRECRAWL_API_KEY
const PERPLEXITY = process.env.PERPLEXITY_API_KEY

if (!FIRECRAWL || !PERPLEXITY) {
  console.error('Missing FIRECRAWL_API_KEY or PERPLEXITY_API_KEY in env.')
  console.error('Run with: node --env-file=.env.local scripts/smoke-third-party.mjs')
  process.exit(2)
}

const TEST_WEBSITE = process.env.SMOKE_WEBSITE_URL || 'https://www.anthropic.com'
const TEST_QUERY = process.env.SMOKE_RESEARCH_QUERY ||
  'Provide 3 verified facts and 2 source citations about credit score basics. Return as JSON: {"facts":["..."],"citations":[{"title":"...","url":"..."}]}'

function fmt(ms) { return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s` }

async function timed(label, fn) {
  process.stdout.write(`→ ${label} … `)
  const start = Date.now()
  try {
    const out = await fn()
    const elapsed = Date.now() - start
    console.log(`ok (${fmt(elapsed)})`)
    return { ok: true, value: out, elapsed }
  } catch (e) {
    const elapsed = Date.now() - start
    console.log(`FAIL (${fmt(elapsed)})`)
    console.log(`  ${e.message}`)
    return { ok: false, error: e, elapsed }
  }
}

async function firecrawlMap() {
  const res = await fetch('https://api.firecrawl.dev/v1/map', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: TEST_WEBSITE, limit: 100 }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json()
  const links = Array.isArray(json.links) ? json.links : []
  return { count: links.length, sample: links.slice(0, 5) }
}

async function firecrawlScrape() {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: TEST_WEBSITE,
      formats: ['markdown', 'branding'],
      onlyMainContent: true,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json()
  const md = json?.data?.markdown ?? ''
  const branding = json?.data?.branding ?? null
  return {
    markdownChars: md.length,
    markdownPreview: md.slice(0, 200).replace(/\s+/g, ' ').trim(),
    branding,
  }
}

async function perplexitySonar() {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'You are a research assistant. Return verified facts with source URLs.' },
        { role: 'user', content: TEST_QUERY },
      ],
      max_tokens: 800,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content ?? ''
  const citations = Array.isArray(json.citations) ? json.citations : []
  // Try to parse JSON out of the response, same way our route does
  let parsed = null
  let jsonParseable = false
  try {
    parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/```$/, '').trim())
    jsonParseable = true
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (match) {
      try { parsed = JSON.parse(match[0]); jsonParseable = true } catch { /* nope */ }
    }
  }
  return {
    contentChars: content.length,
    contentPreview: content.slice(0, 300).replace(/\s+/g, ' ').trim(),
    sonarCitationCount: citations.length,
    jsonParseable,
    parsedFactsCount: parsed && Array.isArray(parsed.facts) ? parsed.facts.length : 0,
    parsedCitationsCount: parsed && Array.isArray(parsed.citations) ? parsed.citations.length : 0,
  }
}

async function main() {
  console.log(`Test website: ${TEST_WEBSITE}\n`)

  const fcMap    = await timed('Firecrawl Map',    firecrawlMap)
  if (fcMap.ok) {
    console.log(`  links: ${fcMap.value.count}`)
    if (fcMap.value.sample.length > 0) {
      console.log('  sample:')
      fcMap.value.sample.forEach((u) => console.log(`    ${u}`))
    }
  }
  console.log()

  const fcScrape = await timed('Firecrawl Scrape', firecrawlScrape)
  if (fcScrape.ok) {
    console.log(`  markdown chars: ${fcScrape.value.markdownChars}`)
    console.log(`  preview: ${fcScrape.value.markdownPreview.slice(0, 160)}…`)
    console.log(`  branding: ${fcScrape.value.branding ? 'present' : 'absent'}`)
    if (fcScrape.value.branding?.colors) {
      const c = fcScrape.value.branding.colors
      console.log(`    colors: primary=${c.primary ?? '—'} secondary=${c.secondary ?? '—'} background=${c.background ?? '—'}`)
    }
  }
  console.log()

  const pp = await timed('Perplexity Sonar', perplexitySonar)
  if (pp.ok) {
    console.log(`  content chars: ${pp.value.contentChars}`)
    console.log(`  preview: ${pp.value.contentPreview.slice(0, 220)}…`)
    console.log(`  sonar citations array: ${pp.value.sonarCitationCount}`)
    console.log(`  JSON parseable: ${pp.value.jsonParseable ? 'yes' : 'no'}`)
    console.log(`  parsed facts: ${pp.value.parsedFactsCount}, parsed citations: ${pp.value.parsedCitationsCount}`)
  }
  console.log()

  const failures = [fcMap, fcScrape, pp].filter((r) => !r.ok)
  if (failures.length > 0) {
    console.log(`✗ ${failures.length} of 3 tests failed`)
    process.exit(1)
  }
  console.log('✓ All 3 third-party APIs responding to our request shapes')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
