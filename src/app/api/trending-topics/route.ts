import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit } from '@/lib/rateLimit'

// ── Trending topics (read) ──────────────────────────────────────────────────
// Serves the weekly pre-cached blue-ocean topic list to wizard Step 1.
// Pure DB read of the `trending_topics` row written by
// /api/admin/refresh-trending-topics — no AI call, so the rate limit is
// generous. Empty array when the cache is unpopulated or expired; the
// client renders a graceful "being prepared" state.

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

  const { data } = await supabase
    .from('intelligence_cache')
    .select('result, expires_at')
    .eq('cache_key', 'trending_topics')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ result: CachedTrending; expires_at: string }>()

  const topics = Array.isArray(data?.result?.topics) ? data.result.topics : []
  return NextResponse.json({ topics })
}
