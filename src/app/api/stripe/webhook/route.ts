import { NextRequest, NextResponse } from 'next/server'
import { stripe, PRICE_TO_PLAN } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'

async function updateUserPlan(customerId: string, plan: 'free' | 'standard' | 'pro') {
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ plan, updated_at: new Date().toISOString() })
    .eq('stripe_customer_id', customerId)
  if (error) console.error('[stripe/webhook] updateUserPlan failed', error.message)
}

/** Returns true if this event has already been processed (idempotency). */
async function alreadyProcessed(eventId: string, eventType: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('stripe_events')
    .insert({ id: eventId, type: eventType })
  // Unique-violation on the primary key means we've seen this event before.
  if (error?.code === '23505') return true
  if (error) {
    console.error('[stripe/webhook] idempotency insert failed', error.message)
    // Fail open — don't block legitimate event handling on a logging error.
    return false
  }
  return false
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[stripe/webhook] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (await alreadyProcessed(event.id, event.type)) {
    return NextResponse.json({ received: true, idempotent: true })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription' && session.customer) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = sub.items.data[0]?.price.id ?? ''
        const plan = PRICE_TO_PLAN[priceId]
        if (!plan) {
          console.error(`[stripe/webhook] unknown price_id ${priceId} on checkout.completed`)
          break
        }
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
      } else if (!plan) {
        console.error(`[stripe/webhook] unknown price_id ${priceId} on subscription.updated`)
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

    // Connect account state changed — typically a previously-pending
    // account becoming active after Stripe finishes verification, but
    // also fires on KYC issues, capabilities updates, etc. We mirror
    // charges_enabled + details_submitted into profiles so the
    // BillingPanel's connect-status pill stays in sync without the user
    // having to bounce back through onboarding for us to learn.
    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      const userId = account.metadata?.supabase_user_id
      // Bail early if the event is for an account we didn't create
      // through this app (no metadata) — there's nothing to sync.
      if (!userId) break

      const isActive = account.charges_enabled && account.details_submitted

      const supabase = await createClient()
      const { error } = await supabase
        .from('profiles')
        .update({ stripe_connect_status: isActive ? 'active' : 'pending' })
        .eq('stripe_connect_id', account.id)
      if (error) console.error('[stripe/webhook] account.updated sync failed', error.message)
      break
    }
  }

  return NextResponse.json({ received: true })
}
