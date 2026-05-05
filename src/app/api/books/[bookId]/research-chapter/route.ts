import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit } from '@/lib/rateLimit'
import type { ResearchCitation } from '@/types/database'

// ── Chapter research grounding ──────────────────────────────────────────────
// Calls Perplexity Sonar to fetch verified facts + citations for a single
// chapter. Result lands on book_pages.research_facts (newline-delimited
// strings) + book_pages.research_citations (jsonb [{ title, url }]). The
// generate-draft route picks these up automatically and injects them into
// the prompt as a <verified_research> block.

export const maxDuration = 60

interface PerplexityChoice { message: { content: string } }
interface PerplexityResponse { choices: PerplexityChoice[]; citations?: string[] }

const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions'

interface BookForResearch {
  id: string
  user_id: string
  title: string
  target_audience: string | null
}

interface PageForResearch {
  id: string
  chapter_index: number
  chapter_title: string
}

function stripFences(s: string): string {
  let t = s.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*\n?/, '')
    if (t.endsWith('```')) t = t.slice(0, -3)
  }
  return t.trim()
}

/** Pull JSON out of a string that may have prose wrapper. Sonar typically
 *  follows the schema instruction but occasionally adds an intro line. */
function extractJsonObject(s: string): unknown {
  const cleaned = stripFences(s)
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean)
}

function asCitations(v: unknown): ResearchCitation[] {
  if (!Array.isArray(v)) return []
  const out: ResearchCitation[] = []
  for (const c of v) {
    if (!c || typeof c !== 'object') continue
    const obj = c as Record<string, unknown>
    const title = typeof obj.title === 'string' ? obj.title.trim() : ''
    const url   = typeof obj.url   === 'string' ? obj.url.trim()   : ''
    if (!title || !url) continue
    // Sanity-check the URL — drop anything that doesn't parse as http(s).
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue
    } catch { continue }
    out.push({ title: title.slice(0, 200), url: url.slice(0, 500) })
  }
  return out
}

/** When Sonar returns plain citation URLs (top-level `citations` array) but
 *  the JSON body didn't include an explicit citation list, we synthesise
 *  the missing titles from the URL host. Better than discarding sources. */
function citationsFromUrls(urls: string[]): ResearchCitation[] {
  const out: ResearchCitation[] = []
  for (const url of urls) {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue
      out.push({ title: parsed.hostname.replace(/^www\./, ''), url: url.slice(0, 500) })
    } catch { /* skip */ }
  }
  return out
}

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await consumeRateLimit(supabase, { key: `research-chapter:${user.id}`, max: 30, windowSeconds: 3600 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in an hour.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const perplexityKey = process.env.PERPLEXITY_API_KEY
  if (!perplexityKey) {
    return NextResponse.json({ error: 'Research is not configured.' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const chapterIndexRaw = Number(body.chapterIndex)
  if (!Number.isFinite(chapterIndexRaw) || chapterIndexRaw < 0) {
    return NextResponse.json({ error: 'chapterIndex required' }, { status: 400 })
  }
  const chapterIndex = Math.floor(chapterIndexRaw)

  // Book (ownership + audience for the prompt) and the specific page.
  const { data: book } = await supabase
    .from('books')
    .select('id, user_id, title, target_audience')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single<BookForResearch>()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: page } = await supabase
    .from('book_pages')
    .select('id, chapter_index, chapter_title')
    .eq('book_id', params.bookId)
    .eq('chapter_index', chapterIndex)
    .single<PageForResearch>()

  if (!page) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })

  // Total chapter count for prompt context. Cheap separate query — happens
  // once per research run, not per draft.
  const { count: totalChapters } = await supabase
    .from('book_pages')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', params.bookId)
    .gte('chapter_index', 0)

  const systemPrompt = 'You are a research assistant. Return verified facts with source URLs. Focus on specific data, statistics, case studies, and expert findings. Be concrete — no vague generalities.'
  const userPrompt = `Provide 7 verified facts, current 2025-2026 data points, and 3 source citations for this topic:
Book: ${book.title}
Chapter: ${page.chapter_title}
Chapter ${chapterIndex + 1} of ${totalChapters ?? '?'}
Target audience: ${book.target_audience ?? 'general'}

Return as JSON:
{
  "facts": ["fact1", "fact2", ...],
  "citations": [{"title": "...", "url": "..."}]
}`

  let perplexityJson: PerplexityResponse
  try {
    const res = await fetch(PERPLEXITY_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        max_tokens: 800,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[research-chapter] Perplexity error', res.status, text.slice(0, 200))
      return NextResponse.json({ error: 'Research failed' }, { status: 502 })
    }
    perplexityJson = (await res.json()) as PerplexityResponse
  } catch (e) {
    console.error('[research-chapter] Perplexity fetch failed', e instanceof Error ? e.message : 'unknown')
    return NextResponse.json({ error: 'Research failed' }, { status: 502 })
  }

  const content = perplexityJson.choices?.[0]?.message?.content ?? ''
  const sonarUrls = Array.isArray(perplexityJson.citations) ? perplexityJson.citations : []

  const parsed = extractJsonObject(content)
  const factsRaw    = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).facts     : null
  const citationsRaw = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).citations : null

  const facts = asStringArray(factsRaw).map((f) => f.slice(0, 500))
  let citations = asCitations(citationsRaw)

  // Fall back to Sonar's top-level citations if the JSON body omitted them.
  if (citations.length === 0 && sonarUrls.length > 0) {
    citations = citationsFromUrls(sonarUrls)
  }

  if (facts.length === 0) {
    return NextResponse.json({ error: 'Research returned no facts' }, { status: 502 })
  }

  const factsString = facts.join('\n')

  const { error: updateError } = await supabase
    .from('book_pages')
    .update({
      research_facts:     factsString,
      research_citations: citations,
      updated_at:         new Date().toISOString(),
    })
    .eq('id', page.id)
    .eq('book_id', params.bookId)

  if (updateError) {
    console.error('[research-chapter] update failed:', updateError.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  return NextResponse.json({ facts, citations, chapterIndex })
}
