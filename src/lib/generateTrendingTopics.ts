// Shared Perplexity → trending_topics cache generator.
//
// Originally lived inside /api/admin/refresh-trending-topics. Pulled into
// a shared module so the public GET /api/trending-topics can auto-generate
// on cache miss — users never wait for a manual cron / curl. Both routes
// import this and the cache row is the same; only the trigger differs.
//
// Concurrency note: with N simultaneous first-visitors, each will trigger
// its own Perplexity call before the first write lands. The DB upsert
// (onConflict: cache_key) makes it last-write-wins — no row duplication —
// but the cost is N redundant API calls per cold-start. At this app's
// traffic and the 7-day TTL that's acceptable; revisit with a sentinel
// row or in-flight promise dedupe if traffic grows.

import { supabaseAdmin } from '@/lib/supabase/admin'

const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions'

// 7-day TTL — matches the original weekly refresh cadence with headroom
// so a brief Perplexity outage doesn't churn the cache every page load.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface TrendingTopic {
  title:             string
  description:       string
  category:          string
  opportunity_level: 'high' | 'medium'
}

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
 *  refresh because the last object got chopped. */
function repairTruncatedJSON(str: string): string {
  const lastCompleteObject = str.lastIndexOf('},')
  const lastArrayClose     = str.lastIndexOf('}]')

  if (lastArrayClose > lastCompleteObject) {
    return str.substring(0, lastArrayClose + 2)
  }
  if (lastCompleteObject > 0) {
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

/** Calls Perplexity, parses (with truncation repair), upserts the result
 *  into `intelligence_cache` via the service-role client (RLS on the
 *  table only allows authenticated, and the refresh route has no user
 *  session). Throws on hard failures so callers can map them to an
 *  appropriate HTTP response; persistence failure is logged but does
 *  not fail the call — the user still gets topics for this session. */
export async function generateAndCacheTrendingTopics(): Promise<TrendingTopic[]> {
  const perplexityKey = process.env.PERPLEXITY_API_KEY
  if (!perplexityKey) {
    throw new Error('PERPLEXITY_API_KEY not configured')
  }

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
    console.error('[generateTrendingTopics] Perplexity', res.status)
    throw new Error(`Perplexity ${res.status}`)
  }

  const json = (await res.json()) as PerplexityResponse
  const content = json.choices?.[0]?.message?.content ?? ''

  let parsed: unknown = extractJsonArray(content)
  if (!Array.isArray(parsed)) {
    try {
      parsed = JSON.parse(repairTruncatedJSON(stripFences(content)))
    } catch { /* repair failed — handled by the array check below */ }
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Research returned unexpected format')
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
    throw new Error('Research returned no usable topics')
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
    // Persistence is best-effort — the caller still gets the topics, and
    // the next cache miss will retry the write. We log so a chronic
    // RLS / connection issue surfaces in monitoring.
    console.error('[generateTrendingTopics] cache write failed:', upsertError.message)
  }

  return topics
}
