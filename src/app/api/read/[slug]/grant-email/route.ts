import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { consumeRateLimit } from '@/lib/rateLimit'
import { scheduleWelcomeSequence } from '@/lib/emailSequence'
import {
  ACCESS_COOKIE_TTL_SECONDS,
  cookieNameForSlug,
  signAccessToken,
} from '@/lib/readAccess'

/**
 * Email-gate access grant.
 *
 *   POST /api/read/[slug]/grant-email   { email, name, website }
 *
 * Mirrors the paid grant route for the email tier: records the lead,
 * fires the welcome sequence, and sets the same signed HttpOnly
 * `fbp_access_<slug>` cookie so the reader doesn't re-enter their email
 * on every visit. The /go landing page's inline form posts here, then
 * navigates the reader to /read/[slug].
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL = 254
const MAX_NAME = 120

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

// Cookie Domain is only set on the production apex so the cookie is shared
// across bookbuilderpro.app and go.bookbuilderpro.app. On localhost and
// *.vercel.app a Domain attribute would be rejected by the browser (the
// cookie would silently drop → /read↔/go redirect loop), so it's omitted
// there and the cookie stays host-only.
function cookieDomain(req: NextRequest): string | undefined {
  const host = req.nextUrl.hostname
  return host === 'bookbuilderpro.app' || host.endsWith('.bookbuilderpro.app')
    ? '.bookbuilderpro.app'
    : undefined
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const body = await req.json().catch(() => ({}))
  const { email, name, website } = body

  // Honeypot — bots auto-fill the hidden field. Silently 200 so they don't retry.
  if (typeof website === 'string' && website.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  if (typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }
  const cleanEmail = email.trim().toLowerCase()
  if (cleanEmail.length === 0 || cleanEmail.length > MAX_EMAIL || !EMAIL_RE.test(cleanEmail)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }
  const cleanName = typeof name === 'string' ? name.trim().slice(0, MAX_NAME) || null : null

  const supabase = await createClient()

  const rl = await consumeRateLimit(supabase, {
    key: `grant-email:${clientIp(req)}`,
    max: 10,
    windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many submissions. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const { data: pub } = await supabase
    .from('published_books')
    .select('id, book_id, user_id, slug, access_type, is_active')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!pub) return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  if (pub.access_type !== 'email') {
    return NextResponse.json({ error: 'This book is not email-gated.' }, { status: 400 })
  }

  // Record the lead with the service-role client. The reader is anonymous,
  // and the leads INSERT-on-conflict path trips RLS for the anon role, so a
  // normal client 500s here. All values are server-derived from `pub` (not
  // client input beyond the validated email/name), so bypassing RLS is safe.
  //
  // Crucially, a lead-save failure must NEVER block access — the reader
  // entered their email and is owed the book. We log and continue rather
  // than 500, mirroring the fire-and-forget welcome sequence below.
  const { error: leadError } = await supabaseAdmin
    .from('leads')
    .upsert({
      published_book_id: pub.id,
      book_id: pub.book_id,
      user_id: pub.user_id,
      email: cleanEmail,
      name: cleanName,
      source: 'optin',
    }, { onConflict: 'published_book_id,email', ignoreDuplicates: true })

  if (leadError) {
    console.error('[grant-email] lead upsert failed (granting access anyway)', leadError.message)
  }

  // Welcome sequence — fire-and-forget, never blocks the gate (mirrors the
  // /api/leads behaviour so email sequences keep firing for new readers).
  void scheduleWelcomeSequence({
    bookId: pub.book_id,
    leadEmail: cleanEmail,
    leadName: cleanName,
    bookSlug: pub.slug,
  }).catch((err) => console.error('[grant-email] welcome sequence scheduling failed:', err))

  const token = signAccessToken(params.slug, cleanEmail)
  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: cookieNameForSlug(params.slug),
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ACCESS_COOKIE_TTL_SECONDS,
    path: '/',
    ...(cookieDomain(req) ? { domain: cookieDomain(req) } : {}),
  })
  return res
}
