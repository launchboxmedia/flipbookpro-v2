import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/textGeneration'
import { consumeRateLimit } from '@/lib/rateLimit'
import type { ResearchCitation } from '@/types/database'

// ── Chapter research grounding ──────────────────────────────────────────────
// Two-phase pipeline:
//   Phase 1: Perplexity Sonar — prose research, no JSON contract. Sonar
//            handles search well; it handles strict JSON poorly.
//   Phase 2: Sonnet via generateText (humanize: false) — converts the
//            Sonar prose into the strict { facts, citations } shape the
//            client expects. Sonnet emits structured output reliably.
//
// Result lands on book_pages.research_facts (newline-delimited strings)
// + book_pages.research_citations (jsonb [{ title, url }]). The
// generate-draft route picks these up automatically and injects them
// into the prompt as a <verified_research> block.
//
// Rate-limited at 20/hour (was 30/hour) since each request now makes
// two upstream API calls instead of one.

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
  chapter_brief: string | null
}

function stripFences(s: string): string {
  let t = s.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*\n?/, '')
    if (t.endsWith('```')) t = t.slice(0, -3)
  }
  return t.trim()
}

/** Pull JSON out of a string that may have prose wrapper. Sonnet
 *  generally follows the schema instruction but occasionally adds an
 *  intro line. */
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
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue
    } catch { continue }
    out.push({ title: title.slice(0, 200), url: url.slice(0, 500) })
  }
  return out
}

/** When Sonar returns plain citation URLs (top-level `citations` array)
 *  but the JSON body didn't include an explicit citation list, we
 *  synthesise the missing titles from the URL host. Better than
 *  discarding sources. */
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

/** Last-resort fallback: pull bullet/numbered lines out of free-form
 *  Sonar prose when Sonnet's structured extraction failed twice. We
 *  strip leading list markers ("1. ", "- ", "* ", "• ") then take
 *  the first 7 non-empty lines. Far from perfect, but it preserves
 *  the work we already paid Sonar for instead of throwing away usable
 *  research. */
function bulletsFromProse(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line
      .trim()
      // Strip leading list markers — number, hyphen, asterisk, bullet.
      .replace(/^(?:\d+[.)]\s+|[-*•]\s+)/, '')
      .trim(),
    )
    // Drop section headers and empty lines. Header detection is rough
    // (line ends in ":" with no period inside), but it stops obvious
    // "Facts:" / "Citations:" labels from polluting the output.
    .filter((line) => line.length > 0)
    .filter((line) => !(line.endsWith(':') && !line.includes('. ')))
  // Cap at 7 to match the Sonar request shape; further lines are
  // typically citations or trailing commentary.
  return lines.slice(0, 7).map((s) => s.slice(0, 500))
}

const SONAR_SYSTEM_PROMPT =
  'You are a research assistant. Find verified facts, current data, and credible sources. Be specific — include statistics, percentages, named studies, and expert findings. No vague generalities.'

const SONNET_EXTRACT_SYSTEM_PROMPT = `Extract structured data from research text.
Return ONLY valid JSON, no preamble, no fences:
{
  "facts": [
    "specific fact with data point",
    "...7 items"
  ],
  "citations": [
    {"title": "source name", "url": "https://..."},
    "...up to 3 items"
  ]
}
If a URL is not available, omit that citation.
Never fabricate URLs.`

const SONNET_EXTRACT_RETRY_PROMPT = `Extract structured data from research text.
You MUST return ONLY a JSON object — no markdown, no prose, no code fences, no comments.
The very first character of your response must be "{".
The very last character must be "}".

Schema:
{
  "facts": ["specific fact 1", "specific fact 2", ...],
  "citations": [{"title": "source name", "url": "https://..."}]
}

Rules:
- 5-7 facts. Each is a single string with concrete data.
- 0-3 citations. Each must have a real http(s) URL — never fabricate.
- If you cannot find a real URL for a citation, omit that citation entirely.
- Output the JSON and nothing else.`

/** Phase 2 wrapper: one Sonnet attempt at structured extraction.
 *  Returns parsed { facts, citations } or null on parse failure. */
async function extractStructured(prose: string, retry: boolean): Promise<{ facts: string[]; citations: ResearchCitation[] } | null> {
  try {
    const text = await generateText({
      systemPrompt: retry ? SONNET_EXTRACT_RETRY_PROMPT : SONNET_EXTRACT_SYSTEM_PROMPT,
      userPrompt: `Extract 7 facts and up to 3 citations from this research:\n\n${prose}\n\nReturn only the JSON object.`,
      maxTokens: 1500,
      humanize: false,
    })
    const parsed = extractJsonObject(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const obj = parsed as Record<string, unknown>
    const facts = asStringArray(obj.facts).map((f) => f.slice(0, 500))
    const citations = asCitations(obj.citations)
    if (facts.length === 0) return null
    return { facts, citations }
  } catch (e) {
    console.error('[research-chapter] Sonnet extract failed:', e instanceof Error ? e.message : 'unknown')
    return null
  }
}

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 20/hour: each request now makes two upstream calls (Sonar + Sonnet).
  // Halving the prior 30/hour limit keeps cost roughly in the same
  // envelope while leaving headroom for retries.
  const rl = await consumeRateLimit(supabase, { key: `research-chapter:${user.id}`, max: 20, windowSeconds: 3600 })
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

  const { data: book } = await supabase
    .from('books')
    .select('id, user_id, title, target_audience')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single<BookForResearch>()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: page } = await supabase
    .from('book_pages')
    .select('id, chapter_index, chapter_title, chapter_brief')
    .eq('book_id', params.bookId)
    .eq('chapter_index', chapterIndex)
    .single<PageForResearch>()

  if (!page) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })

  const { count: totalChapters } = await supabase
    .from('book_pages')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', params.bookId)
    .gte('chapter_index', 0)

  // ── Phase 1: Perplexity Sonar — free-form research ─────────────────────
  // No JSON contract; Sonar is a search/research model and emits prose
  // far more reliably than structured output. We capture both the prose
  // body and Sonar's top-level `citations` URL list (used as a fallback
  // when Sonnet's structured extraction misses citations).
  // The chapter brief is the strongest topic signal — it spells out the
  // specific claims and arguments the chapter makes. Anchoring the
  // research on it (rather than the title alone) prevents Sonar from
  // drifting into generic facts about the book's broader subject. For
  // a chapter on "Why TikTok works for high-ticket funding brokerage",
  // titling-only research returns TikTok Shop GMV stats; brief-anchored
  // research returns the algorithm + organic-reach evidence the
  // chapter actually argues from.
  const chapterFocus = (page.chapter_brief ?? '').trim()
  const sonarUserPrompt = `Research this specific chapter topic:
Book: ${book.title}
Chapter title: ${page.chapter_title}
Chapter focus: ${chapterFocus || '(no brief set — use the title only)'}
Target reader: ${book.target_audience ?? 'general'}
Chapter ${chapterIndex + 1} of ${totalChapters ?? '?'}

Find 7 verified facts and statistics that DIRECTLY support the specific claims and arguments in this chapter's focus description.

Do NOT return general facts about the book's broader topic — only facts that would be cited as evidence for the specific points this chapter makes.

Facts must be relevant to: ${chapterFocus || page.chapter_title}

Also include 3 credible source citations with URLs.

Write in plain prose — no JSON needed.`

  let perplexityJson: PerplexityResponse
  try {
    const res = await fetch(PERPLEXITY_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: SONAR_SYSTEM_PROMPT },
          { role: 'user',   content: sonarUserPrompt },
        ],
        max_tokens: 1500,
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

  const prose     = perplexityJson.choices?.[0]?.message?.content?.trim() ?? ''
  const sonarUrls = Array.isArray(perplexityJson.citations) ? perplexityJson.citations : []

  // If Sonar genuinely returned nothing, there's no data to extract.
  // This is the only path that returns the original "no facts" error;
  // every other failure mode now produces a usable best-effort result.
  if (!prose) {
    return NextResponse.json({ error: 'Research returned no facts' }, { status: 502 })
  }

  // ── Phase 2: Sonnet structured extraction ──────────────────────────────
  // Sonnet emits strict JSON reliably. We try once with the standard
  // prompt, retry once with a stricter one, then fall back to bullet
  // extraction from the prose itself. The user always gets something
  // grounded in the Sonar research — never an empty panel.
  let extracted = await extractStructured(prose, false)
  if (!extracted) {
    extracted = await extractStructured(prose, true)
  }

  let facts:     string[]
  let citations: ResearchCitation[]
  if (extracted) {
    facts     = extracted.facts.slice(0, 7)
    citations = extracted.citations.slice(0, 3)
    // Backfill citations from Sonar's URL list when Sonnet found facts
    // but no citations.
    if (citations.length === 0 && sonarUrls.length > 0) {
      citations = citationsFromUrls(sonarUrls).slice(0, 3)
    }
  } else {
    // Fallback: split the Sonar prose into bullets ourselves. Better
    // than empty — preserves the verifiable research the user already
    // paid for.
    facts = bulletsFromProse(prose)
    citations = citationsFromUrls(sonarUrls).slice(0, 3)
    if (facts.length === 0) {
      // Last-resort: prose was non-empty but had no extractable bullets
      // (e.g. one long paragraph). Save the prose as a single fact so
      // the user has it for review — they can re-research if it's not
      // useful.
      facts = [prose.slice(0, 500)]
    }
    console.warn('[research-chapter] structured extraction failed; fell back to prose bullets, count:', facts.length)
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
