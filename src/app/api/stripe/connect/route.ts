import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, isStripeConfigured } from '@/lib/stripe'

/**
 * Starts (or resumes) Stripe Connect Standard onboarding for the current
 * user.
 *
 *  - If profiles.stripe_connect_id is unset, creates a new connected
 *    account with `metadata.supabase_user_id` set, then generates an
 *    onboarding account link.
 *  - If profiles.stripe_connect_id is already set, REUSES that account
 *    and generates a fresh onboarding link for it. This prevents a
 *    second click from creating a duplicate Stripe account (the prior
 *    behaviour orphaned the first account and overwrote the column
 *    when the second one finished onboarding).
 *
 * The account_id is NOT persisted here — that happens on callback after
 * Stripe confirms `details_submitted`. We still pass it via the return
 * URL so the callback can verify ownership via the account's metadata.
 */
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_id')
      .eq('id', user.id)
      .maybeSingle()

    let accountId = profile?.stripe_connect_id ?? null

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        metadata: { supabase_user_id: user.id },
      })
      accountId = account.id
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      // refresh_url fires when Stripe needs a fresh link (typically because
      // the original one expired before the user finished). The refresh
      // route generates a new link for the SAME account and redirects.
      refresh_url: `${appUrl}/api/stripe/connect/refresh?account_id=${accountId}`,
      return_url:  `${appUrl}/api/stripe/connect/callback?account_id=${accountId}`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('Stripe Connect error:', err)
    return NextResponse.json(
      { error: 'Failed to create Stripe Connect link' },
      { status: 500 },
    )
  }
}
