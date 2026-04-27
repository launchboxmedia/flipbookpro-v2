import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

export const PLANS = {
  // ⚠️  REPLACE WITH REAL STRIPE PRICE IDs from dashboard.stripe.com → Products
  standard_monthly: { priceId: 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_standard_monthly', amount: 900,  interval: 'month' },
  standard_annual:  { priceId: 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_standard_annual',  amount: 7900, interval: 'year'  },
  pro_monthly:      { priceId: 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_pro_monthly',       amount: 4900, interval: 'month' },
  pro_annual:       { priceId: 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_pro_annual',        amount: 39900, interval: 'year' },
} as const

export type PlanKey = keyof typeof PLANS

export const PLAN_LIMITS = {
  free:     { booksPerMonth: 1,  maxChapters: 6  },
  standard: { booksPerMonth: 3,  maxChapters: 8  },
  pro:      { booksPerMonth: 10, maxChapters: 15 },
} as const

// Map Stripe price IDs → plan names
const PRICE_TO_PLAN: Record<string, 'standard' | 'pro'> = {
  [PLANS.standard_monthly.priceId]: 'standard',
  [PLANS.standard_annual.priceId]:  'standard',
  [PLANS.pro_monthly.priceId]:      'pro',
  [PLANS.pro_annual.priceId]:       'pro',
}

/**
 * Authoritative plan check — derives plan from Stripe subscription status,
 * NOT from profiles.plan (which is only a cache updated by webhook).
 * Falls back to profiles.plan if Stripe customer doesn't exist yet.
 */
export async function checkSubscriptionPlan(stripeCustomerId: string | null): Promise<'free' | 'standard' | 'pro'> {
  if (!stripeCustomerId) return 'free'

  try {
    const subs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    })

    if (subs.data.length === 0) return 'free'

    const priceId = subs.data[0].items.data[0]?.price.id ?? ''
    return PRICE_TO_PLAN[priceId] ?? 'standard'
  } catch {
    // If Stripe fails, fall back gracefully
    return 'free'
  }
}
