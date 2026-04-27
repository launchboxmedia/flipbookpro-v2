import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'

// Map Stripe price IDs → plan names
// ⚠️  REPLACE WITH REAL STRIPE PRICE IDs from dashboard.stripe.com → Products
const PRICE_TO_PLAN: Record<string, 'standard' | 'pro'> = {
  'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_standard_monthly': 'standard', // REPLACE WITH REAL STRIPE PRICE ID
  'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_standard_annual':  'standard', // REPLACE WITH REAL STRIPE PRICE ID
  'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_pro_monthly':      'pro',      // REPLACE WITH REAL STRIPE PRICE ID
  'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_pro_annual':       'pro',      // REPLACE WITH REAL STRIPE PRICE ID
}

async function updateUserPlan(customerId: string, plan: 'free' | 'standard' | 'pro') {
  const supabase = await createClient()
  await supabase
    .from('profiles')
    .update({ plan, updated_at: new Date().toISOString() })
    .eq('stripe_customer_id', customerId)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: `Webhook error: ${err}` }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription' && session.customer) {
        // Retrieve the subscription to get the price ID
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = sub.items.data[0]?.price.id ?? ''
        const plan = PRICE_TO_PLAN[priceId] ?? 'standard'
        await updateUserPlan(session.customer as string, plan)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const priceId = sub.items.data[0]?.price.id ?? ''
      const plan = PRICE_TO_PLAN[priceId]
      if (plan && sub.customer) {
        await updateUserPlan(sub.customer as string, plan)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      if (sub.customer) {
        await updateUserPlan(sub.customer as string, 'free')
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
