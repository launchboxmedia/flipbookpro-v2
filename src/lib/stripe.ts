import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

// Price IDs are sourced from env vars — set them in Vercel from your Stripe
// dashboard (Products → pricing). The fallback strings are placeholders that
// signal "not configured"; any call that resolves to one of these will be
// rejected at runtime with a loud error.
function priceFromEnv(envName: string, fallback: string): string {
  const value = process.env[envName] ?? fallback
  if (value.includes('REPLACE_WITH_REAL')) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[stripe] ${envName} is not configured — set it in your hosting environment.`)
    }
  }
  return value
}

export const PLANS = {
  standard_monthly: {
    priceId: priceFromEnv('STRIPE_PRICE_STANDARD_MONTHLY', 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_standard_monthly'),
    amount: 900,
    interval: 'month',
  },
  standard_annual: {
    priceId: priceFromEnv('STRIPE_PRICE_STANDARD_ANNUAL', 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_standard_annual'),
    amount: 7900,
    interval: 'year',
  },
  pro_monthly: {
    priceId: priceFromEnv('STRIPE_PRICE_PRO_MONTHLY', 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_pro_monthly'),
    amount: 4900,
    interval: 'month',
  },
  pro_annual: {
    priceId: priceFromEnv('STRIPE_PRICE_PRO_ANNUAL', 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_pro_annual'),
    amount: 39900,
    interval: 'year',
  },
} as const

export type PlanKey = keyof typeof PLANS

export const PLAN_LIMITS = {
  free:     { booksPerMonth: 1,  maxChapters: 6  },
  standard: { booksPerMonth: 3,  maxChapters: 8  },
  pro:      { booksPerMonth: 10, maxChapters: 15 },
} as const

// Map Stripe price IDs → plan names. Single source of truth — webhook and
// checkout both consume this.
export const PRICE_TO_PLAN: Record<string, 'standard' | 'pro'> = {
  [PLANS.standard_monthly.priceId]: 'standard',
  [PLANS.standard_annual.priceId]:  'standard',
  [PLANS.pro_monthly.priceId]:      'pro',
  [PLANS.pro_annual.priceId]:       'pro',
}

export function isKnownPriceId(priceId: string): boolean {
  return priceId in PRICE_TO_PLAN
}

export function isStripeConfigured(): boolean {
  return Object.values(PLANS).every((p) => !p.priceId.includes('REPLACE_WITH_REAL'))
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
    return 'free'
  }
}
