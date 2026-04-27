import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    // Create a Standard connected account
    const account = await stripe.accounts.create({
      type: 'standard',
      metadata: { supabase_user_id: user.id },
    })

    // Generate an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${appUrl}/settings/billing`,
      return_url: `${appUrl}/api/stripe/connect/callback?account_id=${account.id}`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('Stripe Connect error:', err)
    return NextResponse.json(
      { error: 'Failed to create Stripe Connect link' },
      { status: 500 }
    )
  }
}
