import { NextRequest, NextResponse } from 'next/server'
import { generateAndCacheTrendingTopics } from '@/lib/generateTrendingTopics'

// ── Trending topics cache refresh (admin / cron) ────────────────────────────
// Thin wrapper around the shared generator. Still useful for forcing a
// fresh batch outside the 7-day TTL (post-deploy, post-prompt-change). The
// public GET /api/trending-topics auto-generates on cache miss too, so this
// endpoint is no longer required for normal operation — it's the manual
// "refresh now" escape hatch.

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const secret   = process.env.REFRESH_SECRET
  const provided = req.headers.get('x-refresh-secret')
  // Also reject when the env secret is unset so a missing config can't
  // accidentally open the endpoint.
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const topics = await generateAndCacheTrendingTopics()
    return NextResponse.json({ ok: true, count: topics.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error('[refresh-trending-topics] failed:', msg)
    if (msg.includes('PERPLEXITY_API_KEY')) {
      return NextResponse.json({ error: msg }, { status: 503 })
    }
    return NextResponse.json({ error: 'Refresh failed' }, { status: 502 })
  }
}
