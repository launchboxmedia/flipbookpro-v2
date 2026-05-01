import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

function resolveAppUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

/**
 * One-time payment checkout for a paid published book. Anonymous (the buyer
 * is a public reader, not an authed user). The cancel URL drops the buyer
 * back at /read/{slug}; the success URL redirects to /read/{slug}?session_id=…
 * which the read page verifies before granting access.
 *
 * If the author has connected a Stripe account (profiles.stripe_connect_id),
 * we use destination charges with a 10% platform fee. Otherwise the platform
 * keeps the full payment.
 */
export async function POST(_req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()

  // Look up the published book + the author profile in parallel. We use the
  // service path (no auth required — this is a public-facing checkout).
  const { data: pub } = await supabase
    .from('published_books')
    .select('id, book_id, user_id, slug, title, author, cover_image_url, access_type, price_cents, is_active')
    .eq('book_id', params.bookId)
    .maybeSingle()

  if (!pub) return NextResponse.json({ error: 'Book not found.' }, { status: 404 })
  if (!pub.is_active) return NextResponse.json({ error: 'Book is not published.' }, { status: 410 })
  if (pub.access_type !== 'paid') {
    return NextResponse.json({ error: 'This book is not for sale.' }, { status: 400 })
  }
  if (!pub.price_cents || pub.price_cents < 100) {
    return NextResponse.json({ error: 'Invalid price.' }, { status: 400 })
  }

  const { data: authorProfile } = await supabase
    .from('profiles')
    .select('stripe_connect_id, full_name')
    .eq('id', pub.user_id)
    .maybeSingle()

  const appUrl = resolveAppUrl()
  if (!appUrl) {
    return NextResponse.json({ error: 'App URL is not configured.' }, { status: 503 })
  }

  // Connect destination + 10% platform fee. If the author hasn't connected
  // a Stripe account, the platform takes the whole payment (no transfer).
  const platformFeeCents = Math.round(pub.price_cents * 0.1)
  const useConnect = !!authorProfile?.stripe_connect_id

  const successUrl = `${appUrl}/read/${pub.slug}?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl  = `${appUrl}/read/${pub.slug}`

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: pub.price_cents,
          product_data: {
            name: pub.title,
            description: pub.author ? `by ${pub.author}` : undefined,
            images: pub.cover_image_url ? [pub.cover_image_url] : undefined,
          },
        },
      }],
      success_url: successUrl,
      cancel_url:  cancelUrl,
      // Stripe will collect the buyer's email on the checkout page; we
      // promote it later to a lead with source=paid.
      // Connect destination charges — funds settle in the author's account
      // minus the platform fee.
      ...(useConnect && {
        payment_intent_data: {
          application_fee_amount: platformFeeCents,
          transfer_data: { destination: authorProfile!.stripe_connect_id! },
        },
      }),
      metadata: {
        published_book_id: pub.id,
        book_id:           pub.book_id,
        slug:              pub.slug,
      },
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Checkout failed.'
    console.error('[book-checkout]', message)
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 })
  }
}
