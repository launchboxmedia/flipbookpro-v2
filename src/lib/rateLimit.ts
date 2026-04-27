// Postgres-backed fixed-window rate limiter. Atomic via a SECURITY DEFINER
// RPC that increments and returns the current count for the active window.
// For something more accurate (sliding window) or distributed across many
// regions, swap this out for Upstash Redis behind the same interface.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitResult {
  allowed: boolean
  count: number
  max: number
  retryAfterSeconds: number
}

interface Options {
  /** Stable per-user / per-route key. Combine user.id + route name. */
  key: string
  /** Max calls allowed per window. */
  max: number
  /** Window length in seconds. */
  windowSeconds: number
}

export async function consumeRateLimit(
  supabase: SupabaseClient,
  { key, max, windowSeconds }: Options,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_key: key,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    // Fail open — don't block users on a rate-limiter outage. Surface the
    // failure in logs so it can be addressed.
    console.error('[rateLimit] RPC failed:', error.message)
    return { allowed: true, count: 0, max, retryAfterSeconds: 0 }
  }

  const count = typeof data === 'number' ? data : 0
  return {
    allowed: count <= max,
    count,
    max,
    retryAfterSeconds: windowSeconds,
  }
}
