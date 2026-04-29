import type { SupabaseClient } from '@supabase/supabase-js'
import { checkSubscriptionPlan, PLAN_LIMITS } from './stripe'

export type EffectivePlan = 'free' | 'standard' | 'pro' | 'admin'

export interface PlanInfo {
  plan: EffectivePlan
  isAdmin: boolean
  // Admin gets Number.POSITIVE_INFINITY for both — i.e. unlimited.
  booksPerMonth: number
  maxChapters: number
}

/**
 * Authoritative plan resolution. Order:
 *   1. Admin role (user_roles) → unlimited everything
 *   2. Stripe subscription (active) → 'standard' | 'pro'
 *   3. profiles.plan fallback → honours manual comps where there's no Stripe
 *      customer (e.g. friends/beta users gifted a tier directly in the DB)
 *
 * Use this anywhere the app gates a feature on plan. Don't read profiles.plan
 * directly — that misses both the admin role and the Stripe-as-source-of-truth
 * promotion path.
 */
export async function getEffectivePlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlanInfo> {
  const [{ data: role }, { data: profile }] = await Promise.all([
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('stripe_customer_id, plan')
      .eq('id', userId)
      .maybeSingle(),
  ])

  if (role) {
    return {
      plan: 'admin',
      isAdmin: true,
      booksPerMonth: Number.POSITIVE_INFINITY,
      maxChapters: Number.POSITIVE_INFINITY,
    }
  }

  let plan: 'free' | 'standard' | 'pro' = 'free'
  if (profile?.stripe_customer_id) {
    plan = await checkSubscriptionPlan(profile.stripe_customer_id)
  }
  if (plan === 'free') {
    const fallback = (profile?.plan ?? 'free') as 'free' | 'standard' | 'pro'
    if (fallback !== 'free') plan = fallback
  }

  const limits = PLAN_LIMITS[plan]
  return {
    plan,
    isAdmin: false,
    booksPerMonth: limits.booksPerMonth,
    maxChapters: limits.maxChapters,
  }
}

const ORDER: Record<EffectivePlan, number> = { free: 0, standard: 1, pro: 2, admin: 3 }

/** Whether the resolved plan meets/exceeds the required tier. Admin always passes. */
export function planAtLeast(plan: EffectivePlan, required: 'free' | 'standard' | 'pro'): boolean {
  return ORDER[plan] >= ORDER[required]
}
