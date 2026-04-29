import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectivePlan } from '@/lib/auth'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, books_created_this_month, books_reset_at')
    .eq('id', user.id)
    .single()

  // Authoritative plan: admin role → Stripe → profile.plan fallback.
  const { plan, booksPerMonth, maxChapters, isAdmin } = await getEffectivePlan(supabase, user.id)

  // Sync the profile.plan cache when Stripe says something different. Admins
  // are intentionally NOT cached as a plan — admin is a separate role flag.
  if (!isAdmin && profile && profile.plan !== plan) {
    await supabase
      .from('profiles')
      .update({ plan, updated_at: new Date().toISOString() })
      .eq('id', user.id)
  }

  // Reset monthly counter if it's a new month
  const resetAt = new Date(profile?.books_reset_at ?? '2000-01-01')
  const now = new Date()
  let used = profile?.books_created_this_month ?? 0

  if (now.getFullYear() !== resetAt.getFullYear() || now.getMonth() !== resetAt.getMonth()) {
    await supabase
      .from('profiles')
      .update({ books_created_this_month: 0, books_reset_at: now.toISOString() })
      .eq('id', user.id)
    used = 0
  }

  return NextResponse.json({
    allowed: used < booksPerMonth,
    plan,
    used,
    // JSON.stringify converts Number.POSITIVE_INFINITY to null; surface that
    // as a sentinel value for the client (NewBookButton treats null as
    // "no limit" and skips the gate).
    limit: Number.isFinite(booksPerMonth) ? booksPerMonth : null,
    maxChapters: Number.isFinite(maxChapters) ? maxChapters : null,
    isAdmin,
  })
}
