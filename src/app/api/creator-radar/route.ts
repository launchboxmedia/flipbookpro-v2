import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit } from '@/lib/rateLimit'
import type {
  CreatorRadarResult,
  CreatorRadarHotSignal,
  CreatorRadarEvergreen,
  CreatorRadarHiddenGold,
} from '@/types/database'

const SERVICE_UNAVAILABLE_BODY = {
  error:     true,
  errorType: 'service_unavailable' as const,
  message:   'Market research service is unavailable right now.',
}

/** Threshold below which we consider the topic to have limited commercial
 *  viability. Tuned so that scores in the 50s-60s on average flag the
 *  pivot prompt. The UI shows the same results either way — but with
 *  different framing — so a soft signal is enough. */
const LOW_OPPORTUNITY_AVG_THRESHOLD     = 55
const LOW_OPPORTUNITY_PER_ITEM_THRESHOLD = 60

// ── Pre-book topic discovery ────────────────────────────────────────────────
// Powers the wizard Step 1 (scratch mode) "Creator Radar" panel. The user
// types a niche, we ask Perplexity Sonar for three buckets of book ideas.
// Distinct from /api/books/[bookId]/creator-radar which does full book-
// specific market intelligence.
//
// Failure modes (all return a clean 503 with errorType: 'service_unavailable'
// so the wizard can render an honest retry path — no synthetic results):
//   • PERPLEXITY_API_KEY missing
//   • Perplexity HTTP error
//   • Sonar returns unparseable JSON
//   • Sonar returns three empty buckets

export const maxDuration = 60

const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions'

// Reader-perspective system prompt. The previous prompt accepted
// "book ideas" too literally and Sonar would return industry/institutional
// framings — e.g. "Niche Banking Strategies for Specialized Segments" for
// the "business credit" niche, which is a topic written FOR bankers, not
// the business owner who actually wants to learn how to build business
// credit. Every idea now has to pass the reader test below: would a real
// person with this problem search for, buy, and read this book?
const SYSTEM_PROMPT = `You are a book market analyst identifying nonfiction book opportunities for AUTHORS to write and READERS to buy.

Every idea must be from the READER'S perspective — the person who has a problem and wants to solve it. NOT from an industry, lender, or institutional perspective.

Return ONLY practical nonfiction book ideas that a real person would search for, buy, and read to solve a specific problem in their life or business.

Allowed formats: guide, handbook, blueprint, field guide, manual, primer, playbook.

Do NOT suggest:
- Industry or institutional perspectives
- Academic or research topics
- Topics written FOR professionals IN an industry
- Courses, templates, software, apps, memberships, downloads, checklists, or any non-book product

Every topic must pass this test: "Would a person with this problem search for and buy this book?" If not, exclude it.

If the topic has limited commercial viability as a nonfiction book, still return your best adjacent opportunities — but score them honestly. Do not inflate scores to make a weak topic look viable. A score below 50 is appropriate for topics with no clear reader demand.`

function buildUserPrompt(topic: string, refreshNonce?: number): string {
  const refreshLine = refreshNonce
    ? `\n\nGenerate DIFFERENT ideas from previous scan. Refresh #${refreshNonce}.`
    : ''
  return `Find monetizable nonfiction book opportunities in this niche: ${topic}

Think from the READER'S perspective — someone with a real problem who wants a practical solution.

Hot Signals: What problems are people in this niche actively searching for solutions to RIGHT NOW in 2025-2026? What's urgent and trending?

Evergreen Winners: What fundamental problems in this niche never go away and always have buyers?

Hidden Gold: What underserved sub-problems exist that most books miss but readers desperately need?${refreshLine}

Return strict JSON:
{
  "hot_signals": [
    {
      "topic": "specific reader-facing book title or topic",
      "engagement": 0-100,
      "trend_direction": "rising|stable|declining"
    }
  ],
  "evergreen_winners": [
    {
      "topic": "specific reader-facing book title or topic",
      "longevity_score": 0-100
    }
  ],
  "hidden_gold": [
    {
      "niche": "specific underserved reader problem",
      "opportunity_score": 0-100,
      "competition_level": "low|medium|high"
    }
  ]
}

3 items per category.
Topics must be specific and reader-facing.
Bad example: "Niche Banking Strategies for Specialized Segments"
Good example: "How to Build Business Credit from Zero When You Have No History"`
}

interface PerplexityChoice { message: { content: string } }
interface PerplexityResponse { choices: PerplexityChoice[]; citations?: string[] }

function stripFences(s: string): string {
  let t = s.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*\n?/, '')
    if (t.endsWith('```')) t = t.slice(0, -3)
  }
  return t.trim()
}

/** Pull JSON object out of a possibly-prose response. Same pattern as
 *  research-chapter — Sonar occasionally wraps the JSON in commentary. */
function extractJson(s: string): unknown {
  const cleaned = stripFences(s)
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function normaliseCompetition(v: unknown): 'low' | 'medium' | 'high' {
  const s = asString(v).toLowerCase()
  if (s === 'low' || s === 'medium' || s === 'high') return s
  return 'medium'
}

function asHotSignal(v: unknown): CreatorRadarHotSignal | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const topic = asString(o.topic)
  if (!topic) return null
  return {
    topic,
    engagement: clamp(Number(o.engagement), 0, 100),
    trend_direction: asString(o.trend_direction) || undefined,
  }
}

function asEvergreen(v: unknown): CreatorRadarEvergreen | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const topic = asString(o.topic)
  if (!topic) return null
  return {
    topic,
    longevity_score: clamp(Number(o.longevity_score), 0, 100),
  }
}

function asHiddenGold(v: unknown): CreatorRadarHiddenGold | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const niche = asString(o.niche)
  if (!niche) return null
  return {
    niche,
    opportunity_score: clamp(Number(o.opportunity_score), 0, 100),
    competition_level: normaliseCompetition(o.competition_level),
  }
}

function takeThree<T>(arr: unknown, mapper: (v: unknown) => T | null): T[] {
  if (!Array.isArray(arr)) return []
  const out: T[] = []
  for (const item of arr) {
    const mapped = mapper(item)
    if (mapped) {
      out.push(mapped)
      if (out.length >= 3) break
    }
  }
  return out
}

/** Inspect the parsed result and decide whether the topic looks like a
 *  weak commercial fit. Two signals trip the flag:
 *    1. The mean of every score across all three buckets is below the
 *       average threshold, OR
 *    2. Every individual score is below the per-item threshold (no
 *       bright spots).
 *  Either condition is enough — the wizard surfaces a pivot prompt and
 *  reframes the results as "adjacent opportunities". */
function isLowOpportunity(r: CreatorRadarResult): boolean {
  const scores: number[] = [
    ...r.hot_signals.map((s) => s.engagement),
    ...r.evergreen_winners.map((s) => s.longevity_score),
    ...r.hidden_gold.map((s) => s.opportunity_score),
  ]
  if (scores.length === 0) return false
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  if (avg < LOW_OPPORTUNITY_AVG_THRESHOLD) return true
  if (scores.every((n) => n < LOW_OPPORTUNITY_PER_ITEM_THRESHOLD)) return true
  return false
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await consumeRateLimit(supabase, {
    key: `creator-radar-shared:${user.id}`, max: 10, windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in an hour.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const body = await req.json().catch(() => ({}))
  const topic = asString(body?.topic).slice(0, 200)
  if (topic.length < 2) {
    return NextResponse.json({ error: 'Provide a niche to scan.' }, { status: 400 })
  }
  const refreshNonceRaw = Number(body?.refreshNonce)
  const refreshNonce = Number.isFinite(refreshNonceRaw) && refreshNonceRaw > 0
    ? Math.floor(refreshNonceRaw)
    : undefined

  const perplexityKey = process.env.PERPLEXITY_API_KEY
  if (!perplexityKey) {
    return NextResponse.json(SERVICE_UNAVAILABLE_BODY, { status: 503 })
  }

  // Bump temperature on refresh so the user actually sees fresh output —
  // 0.2 keeps the first scan stable, 0.6 introduces enough variance that
  // a second click ≠ first click.
  const temperature = refreshNonce ? 0.6 : 0.2

  let parsed: unknown = null
  try {
    const res = await fetch(PERPLEXITY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: buildUserPrompt(topic, refreshNonce) },
        ],
        max_tokens: 1000,
        temperature,
      }),
    })
    if (!res.ok) {
      console.error('[creator-radar shared] Perplexity', res.status)
      return NextResponse.json(SERVICE_UNAVAILABLE_BODY, { status: 503 })
    }
    const json = (await res.json()) as PerplexityResponse
    const content = json.choices?.[0]?.message?.content ?? ''
    parsed = extractJson(content)
  } catch (e) {
    console.error('[creator-radar shared] fetch failed:', e instanceof Error ? e.message : 'unknown')
    return NextResponse.json(SERVICE_UNAVAILABLE_BODY, { status: 503 })
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return NextResponse.json(SERVICE_UNAVAILABLE_BODY, { status: 503 })
  }
  const obj = parsed as Record<string, unknown>
  const result: CreatorRadarResult = {
    hot_signals:       takeThree(obj.hot_signals,       asHotSignal),
    evergreen_winners: takeThree(obj.evergreen_winners, asEvergreen),
    hidden_gold:       takeThree(obj.hidden_gold,       asHiddenGold),
  }

  // Three empty buckets means Sonar misbehaved — surface as service
  // unavailable so the UI shows the retry path rather than empty columns.
  if (
    result.hot_signals.length === 0 &&
    result.evergreen_winners.length === 0 &&
    result.hidden_gold.length === 0
  ) {
    return NextResponse.json(SERVICE_UNAVAILABLE_BODY, { status: 503 })
  }

  // Honest scoring → low-opportunity flag. The UI uses this to gate the
  // pivot prompt; the underlying data is the same either way.
  if (isLowOpportunity(result)) {
    return NextResponse.json({
      ...result,
      low_opportunity: true,
      pivot_available: true,
      pivot_note:      'Limited reader demand for this specific topic as a standalone book.',
      pivot_topic:     topic,
    })
  }

  return NextResponse.json(result)
}
