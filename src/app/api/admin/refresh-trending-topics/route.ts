import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ── Trending topics cache refresh (admin / cron) ────────────────────────────
// Protected by a static secret header — there is no user session here, so we
// write through the service-role client (intelligence_cache RLS only allows
// `authenticated`; an anon write would silently fail). Trigger weekly via an
// external cron / curl. Distinct from /api/creator-radar (per-user, seeded
// topic) and /api/books/[bookId]/creator-radar (per-book deep radar).

export const maxDuration = 60

const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions'

// 7-day TTL — matches the weekly refresh cadence with headroom so a missed
// run still serves the previous batch until the next trigger.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const SYSTEM_PROMPT = `You are a book market analyst identifying nonfiction book opportunities. Find 8 specific blue ocean book topics — high reader demand, low competition, underserved by existing books.

Each topic must:
- Solve a specific real problem a real person has RIGHT NOW in 2026
- Have a title that sounds like a real book someone would search for and buy
- Be genuinely underserved (few or no quality books on Amazon covering this exact angle)
- Be broad enough that many different authors could write it from their own expertise

Return ONLY valid JSON array. No preamble:
[
  {
    "title": "Specific Book Title",
    "description": "One sentence: who this is for and what problem it solves",
    "category": "Finance|Health|Business|Creator|Career|Relationships|Parenting|Technology|Marketing|Leadership",
    "opportunity_level": "high|medium"
  }
]

Distribute across at least 5 different categories. Include topics that would appeal to: entrepreneurs, professionals, creators, parents, and people navigating major life transitions.`

const USER_PROMPT = `Find 8 specific blue ocean nonfiction book opportunities for 2026. Focus on topics where reader demand clearly exists but quality books are scarce. Think about what people are searching for, struggling with, or asking about right now that doesn't have a great book answer yet.`

interface PerplexityChoice { message: { content: string } }
interface PerplexityResponse { choices: PerplexityChoice[] }

interface TrendingTopic {
  title:             string
  description:       string
  category:          string
  opportunity_level: 'high' | 'medium'
}

function stripFences(s: string): string {
  let t = s.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*\n?/, '')
    if (t.endsWith('```')) t = t.slice(0, -3)
  }
  return t.trim()
}

/** Pull the first JSON array out of a possibly-prose Sonar response. */
function extractJsonArray(s: string): unknown {
  const cleaned = stripFences(s)
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

/** Last-ditch repair for a JSON array that got truncated mid-string when
 *  Perplexity hit max_tokens. Cuts back to the last complete object and
 *  closes the array — better to serve N topics than to drop the entire
 *  refresh because the 9th object got chopped. */
function repairTruncatedJSON(str: string): string {
  const lastCompleteObject = str.lastIndexOf('},')
  const lastArrayClose     = str.lastIndexOf('}]')

  if (lastArrayClose > lastCompleteObject) {
    return str.substring(0, lastArrayClose + 2)
  }
  if (lastCompleteObject > 0) {
    // Close the array after the last complete object.
    return str.substring(0, lastCompleteObject + 1) + ']'
  }
  return str
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function normaliseTopic(v: unknown): TrendingTopic | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const title = asString(o.title)
  const description = asString(o.description)
  if (!title || !description) return null
  const levelRaw = asString(o.opportunity_level).toLowerCase()
  return {
    title:             title.slice(0, 160),
    description:       description.slice(0, 300),
    category:          asString(o.category).slice(0, 40) || 'Business',
    opportunity_level: levelRaw === 'medium' ? 'medium' : 'high',
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.REFRESH_SECRET
  const provided = req.headers.get('x-refresh-secret')
  // Constant-ish check: also reject when the env secret is unset so a
  // missing config can't accidentally open the endpoint.
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const perplexityKey = process.env.PERPLEXITY_API_KEY
  if (!perplexityKey) {
    return NextResponse.json({ error: 'PERPLEXITY_API_KEY not configured' }, { status: 503 })
  }

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
          { role: 'user',   content: USER_PROMPT },
        ],
        max_tokens:  2000,
        temperature: 0.4,
      }),
    })
    if (!res.ok) {
      console.error('[refresh-trending-topics] Perplexity', res.status)
      return NextResponse.json({ error: 'Upstream research failed' }, { status: 502 })
    }
    const json = (await res.json()) as PerplexityResponse
    const content = json.choices?.[0]?.message?.content ?? ''
    parsed = extractJsonArray(content)
    // Fallback: if Perplexity hit max_tokens mid-string, try to repair the
    // truncated array by closing it after the last complete object.
    if (!Array.isArray(parsed)) {
      try {
        parsed = JSON.parse(repairTruncatedJSON(stripFences(content)))
      } catch { /* repair failed — handled by the Array.isArray check below */ }
    }
  } catch (e) {
    console.error('[refresh-trending-topics] fetch failed:', e instanceof Error ? e.message : 'unknown')
    return NextResponse.json({ error: 'Upstream research failed' }, { status: 502 })
  }

  if (!Array.isArray(parsed)) {
    return NextResponse.json({ error: 'Research returned unexpected format' }, { status: 502 })
  }

  const topics: TrendingTopic[] = []
  for (const item of parsed) {
    const t = normaliseTopic(item)
    if (t) {
      topics.push(t)
      if (topics.length >= 8) break
    }
  }

  if (topics.length === 0) {
    return NextResponse.json({ error: 'Research returned no usable topics' }, { status: 502 })
  }

  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString()
  const { error: upsertError } = await supabaseAdmin
    .from('intelligence_cache')
    .upsert(
      {
        cache_key:  'trending_topics',
        persona:    'global',
        result:     { topics },
        expires_at: expiresAt,
      },
      { onConflict: 'cache_key' },
    )

  if (upsertError) {
    console.error('[refresh-trending-topics] upsert failed:', upsertError.message)
    return NextResponse.json({ error: 'Cache write failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: topics.length })
}
