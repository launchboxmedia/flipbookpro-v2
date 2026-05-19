import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import {
  ACCESS_COOKIE_TTL_SECONDS,
  cookieNameForSlug,
  signAccessToken,
} from '@/lib/readAccess'

/**
 * Stripe success-URL handler for paid books.
 *
 *   GET /api/read/[slug]/grant?session_id=cs_test_xxx
 *
 *   1. Verifies the Checkout Session with Stripe
 *   2. Confirms payment_status=paid AND metadata.slug matches
 *   3. Records a lead with source='paid' (upsert on the
 *      (published_book_id, email) unique key — promotes any existing
 *      email-gate lead to source='paid')
 *   4. Sets a signed HttpOnly access cookie keyed to the slug
 *   5. Redirects the buyer to a clean /read/{slug} URL (no query string)
 *
 * Failure modes redirect back to /read/{slug} with an error code in the
 * query so the buy gate can surface a message.
 */
// Domain only on the production apex so the cookie is shared across
// bookbuilderpro.app and go.bookbuilderpro.app. Omitted on localhost /
// *.vercel.app where a Domain attribute is rejected (cookie would drop →
// /read↔/go redirect loop).
function cookieDomain(req: NextRequest): string | undefined {
  const host = req.nextUrl.hostname
  return host === 'bookbuilderpro.app' || host.endsWith('.bookbuilderpro.app')
    ? '.bookbuilderpro.app'
    : undefined
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  const back = (code?: string) => {
    const url = new URL(`/read/${params.slug}`, req.url)
    if (code) url.searchParams.set('error', code)
    return NextResponse.redirect(url)
  }

  if (!sessionId) return back('missing-session')

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (e) {
    console.error('[read-grant] retrieve failed', e instanceof Error ? e.message : e)
    return back('verify-failed')
  }

  if (session.payment_status !== 'paid') return back('unpaid')

  // Cross-check that the session was created for THIS slug. If a buyer tries
  // to reuse a session_id from a different book, reject.
  if (session.metadata?.slug && session.metadata.slug !== params.slug) {
    return back('slug-mismatch')
  }

  const buyerEmail = session.customer_details?.email
                  ?? session.customer_email
                  ?? null
  if (!buyerEmail) return back('no-email')

  const supabase = await createClient()

  // Look up the published book to record the lead. If the row vanished
  // between checkout and verification (book unpublished), we still grant
  // access — the buyer paid for it.
  const { data: pub } = await supabase
    .from('published_books')
    .select('id, book_id, user_id')
    .eq('slug', params.slug)
    .maybeSingle()

  if (pub) {
    // Upsert against (published_book_id, email) so an existing email-gate
    // lead gets promoted to source='paid' instead of failing the unique
    // constraint.
    await supabase
      .from('leads')
      .upsert(
        {
          published_book_id: pub.id,
          book_id:           pub.book_id,
          user_id:           pub.user_id,
          email:             buyerEmail.toLowerCase().trim(),
          source:            'paid',
        },
        { onConflict: 'published_book_id,email' },
      )
      .select()
  }

  const token = signAccessToken(params.slug, buyerEmail)
  const response = NextResponse.redirect(new URL(`/read/${params.slug}`, req.url))
  response.cookies.set({
    name:     cookieNameForSlug(params.slug),
    value:    token,
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   ACCESS_COOKIE_TTL_SECONDS,
    path:     '/',
    ...(cookieDomain(req) ? { domain: cookieDomain(req) } : {}),
  })
  return response
}
