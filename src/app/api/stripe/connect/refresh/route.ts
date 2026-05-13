import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, isStripeConfigured } from '@/lib/stripe'

/**
 * Stripe redirects here as the `refresh_url` for Connect account links —
 * typically because the original onboarding link expired before the
 * user finished. We generate a fresh link for the SAME connected
 * account and redirect them straight back into onboarding.
 *
 * Ownership check: the account_id in the query string must match either
 * profiles.stripe_connect_id (the linked-to-us account) OR the account's
 * own metadata.supabase_user_id. This handles the pre-callback case
 * where stripe_connect_id isn't persisted yet (link refreshed before
 * the user ever finished step 1).
 */
export async function GET(req: NextRequest) {
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const billingUrl = `${appUrl}/settings/billing`

  if (!isStripeConfigured()) {
    return NextResponse.redirect(`${billingUrl}?connect_error=stripe_not_configured`)
  }

  const accountId = req.nextUrl.searchParams.get('account_id')
  if (!accountId) {
    return NextResponse.redirect(`${billingUrl}?connect_error=missing_account`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${appUrl}/login`)

  try {
    const [{ data: profile }, account] = await Promise.all([
      supabase
        .from('profiles')
        .select('stripe_connect_id')
        .eq('id', user.id)
        .maybeSingle(),
      stripe.accounts.retrieve(accountId),
    ])

    const ownedViaDb       = profile?.stripe_connect_id === accountId
    const ownedViaMetadata = account.metadata?.supabase_user_id === user.id
    if (!ownedViaDb && !ownedViaMetadata) {
      return NextResponse.redirect(`${billingUrl}?connect_error=account_mismatch`)
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/api/stripe/connect/refresh?account_id=${accountId}`,
      return_url:  `${appUrl}/api/stripe/connect/callback?account_id=${accountId}`,
      type: 'account_onboarding',
    })

    return NextResponse.redirect(accountLink.url)
  } catch (err) {
    console.error('Stripe Connect refresh error:', err)
    return NextResponse.redirect(`${billingUrl}?connect_error=stripe_error`)
  }
}
