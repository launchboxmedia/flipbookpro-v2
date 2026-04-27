import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS, checkSubscriptionPlan } from '@/lib/stripe'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, stripe_customer_id, books_created_this_month, books_reset_at')
    .eq('id', user.id)
    .single()

  // Plan authority: Stripe subscription check first, fall back to profiles.plan
  const plan = await checkSubscriptionPlan(profile?.stripe_customer_id ?? null)
    || (profile?.plan ?? 'free') as keyof typeof PLAN_LIMITS

  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free

  // Sync plan cache if it drifted
  if (profile && profile.plan !== plan) {
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
    allowed: used < limits.booksPerMonth,
    plan,
    used,
    limit: limits.booksPerMonth,
    maxChapters: limits.maxChapters,
  })
}
