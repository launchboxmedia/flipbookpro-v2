import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit } from '@/lib/rateLimit'
import { generateAndCacheTrendingTopics } from '@/lib/generateTrendingTopics'

// ── Trending topics (read, with auto-generate on cache miss) ────────────────
// Reads the `trending_topics` row out of intelligence_cache. On miss /
// expired, generates inline via the shared module — users never need a
// manual cron / curl trigger. Cache hits return instantly; misses take
// ~3-5s for the Perplexity call (the wizard's loading skeleton covers it).

// Cache miss may run a Perplexity call; bump maxDuration past the default
// 10s so a slow upstream doesn't cause a hard timeout mid-generation.
export const maxDuration = 60

interface CachedTrending { topics?: unknown }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await consumeRateLimit(supabase, {
    key: `trending-topics:${user.id}`, max: 60, windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  // Cache hit — return immediately.
  const { data } = await supabase
    .from('intelligence_cache')
    .select('result, expires_at')
    .eq('cache_key', 'trending_topics')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ result: CachedTrending; expires_at: string }>()

  const cachedTopics = Array.isArray(data?.result?.topics) ? data.result.topics : null
  if (cachedTopics && cachedTopics.length > 0) {
    return NextResponse.json({ topics: cachedTopics })
  }

  // Cache miss or expired — generate inline. The generator handles its
  // own write back to intelligence_cache (via the service-role client),
  // so the next caller hits the cache. On generation failure we return
  // an empty array — the client's empty state is the right UX.
  try {
    const topics = await generateAndCacheTrendingTopics()
    return NextResponse.json({ topics })
  } catch (e) {
    console.error('[trending-topics] inline generation failed:', e instanceof Error ? e.message : 'unknown')
    return NextResponse.json({ topics: [] })
  }
}
