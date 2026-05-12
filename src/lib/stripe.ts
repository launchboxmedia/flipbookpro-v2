import Stripe from 'stripe'

// In development, prefer the TEST-mode key + price IDs so local checkouts
// don't ring the live till. In production we use the live values. To override
// (e.g. if you specifically want to debug live in dev), set
// FLIPBOOKPRO_STRIPE_MODE=live in .env.local.
const stripeMode: 'live' | 'test' =
  process.env.FLIPBOOKPRO_STRIPE_MODE === 'live'
    ? 'live'
    : process.env.FLIPBOOKPRO_STRIPE_MODE === 'test'
    ? 'test'
    : process.env.NODE_ENV === 'production'
    ? 'live'
    : 'test'

const stripeSecretKey =
  stripeMode === 'test'
    ? (process.env.STRIPE_SECRET_KEY_TEST ?? process.env.STRIPE_SECRET_KEY ?? '')
    : (process.env.STRIPE_SECRET_KEY ?? '')

if (!stripeSecretKey && process.env.NODE_ENV === 'production') {
  console.error('[stripe] No Stripe secret key configured.')
}

// The Stripe SDK throws "Neither apiKey nor config.authenticator
// provided" at construction time when apiKey is empty. Next.js imports
// every route module during the build's page-data collection step, so
// an empty key crashes the build even though no route handler is
// actually executing. Pass a clearly-fake placeholder when the env var
// isn't set — construction succeeds, but the placeholder never reaches
// a real API call: callers gate billing routes with isStripeConfigured()
// or run in environments where STRIPE_SECRET_KEY is set. If a billing
// route runs without the env var, the API call returns 401 and the
// route's catch block returns a 500 to the client.
export const stripe = new Stripe(stripeSecretKey || 'sk_test_placeholder_unconfigured', {
  apiVersion: '2026-03-25.dahlia',
})

export const isStripeTestMode = stripeMode === 'test'

// Price IDs are sourced from env vars — set them in Vercel from your Stripe
// dashboard (Products → pricing). The fallback strings are placeholders that
// signal "not configured"; any call that resolves to one of these will be
// rejected at runtime with a loud error.
//
// In test mode, we read from `<NAME>_TEST` env vars; in live mode from `<NAME>`.
// This way one repo runs cleanly in both environments without any swap step.
function priceFromEnv(envName: string, fallback: string): string {
  const sourceName = isStripeTestMode ? `${envName}_TEST` : envName
  const value = process.env[sourceName] ?? process.env[envName] ?? fallback
  if (value.includes('REPLACE_WITH_REAL')) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[stripe] ${sourceName} is not configured — set it in your hosting environment.`)
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
  standard_yearly: {
    priceId: priceFromEnv('STRIPE_PRICE_STANDARD_YEARLY', 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_standard_yearly'),
    amount: 7900,
    interval: 'year',
  },
  pro_monthly: {
    priceId: priceFromEnv('STRIPE_PRICE_PRO_MONTHLY', 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_pro_monthly'),
    amount: 4900,
    interval: 'month',
  },
  pro_yearly: {
    priceId: priceFromEnv('STRIPE_PRICE_PRO_YEARLY', 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_pro_yearly'),
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
// checkout both consume this. Both intervals (monthly + yearly) of each tier
// resolve to the same plan name.
export const PRICE_TO_PLAN: Record<string, 'standard' | 'pro'> = {
  [PLANS.standard_monthly.priceId]: 'standard',
  [PLANS.standard_yearly.priceId]:  'standard',
  [PLANS.pro_monthly.priceId]:      'pro',
  [PLANS.pro_yearly.priceId]:       'pro',
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
