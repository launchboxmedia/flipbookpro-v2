import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const billingUrl = `${appUrl}/settings/billing`

  const accountId = req.nextUrl.searchParams.get('account_id')
  if (!accountId) {
    return NextResponse.redirect(`${billingUrl}?connect_error=missing_account`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  try {
    // Verify the account exists and check onboarding status
    const account = await stripe.accounts.retrieve(accountId)

    if (account.metadata?.supabase_user_id !== user.id) {
      return NextResponse.redirect(`${billingUrl}?connect_error=account_mismatch`)
    }

    const isActive = account.charges_enabled && account.details_submitted

    const { error } = await supabase
      .from('profiles')
      .update({
        stripe_connect_id: accountId,
        stripe_connect_status: isActive ? 'active' : 'pending',
      })
      .eq('id', user.id)

    if (error) {
      console.error('Failed to update profile:', error)
      return NextResponse.redirect(`${billingUrl}?connect_error=db_update_failed`)
    }

    return NextResponse.redirect(
      `${billingUrl}?connect_success=${isActive ? 'active' : 'pending'}`
    )
  } catch (err) {
    console.error('Stripe Connect callback error:', err)
    return NextResponse.redirect(`${billingUrl}?connect_error=stripe_error`)
  }
}
