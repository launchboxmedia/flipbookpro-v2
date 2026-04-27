import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit } from '@/lib/rateLimit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL = 254
const MAX_NAME = 120

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { email, name, publishedBookId, source, website } = body

  // Honeypot — real users won't fill an aria-hidden CSS-hidden field. Bots
  // that auto-fill every input will. Silently 200 so they don't retry.
  if (typeof website === 'string' && website.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  if (typeof email !== 'string' || typeof publishedBookId !== 'string') {
    return NextResponse.json({ error: 'email and publishedBookId required' }, { status: 400 })
  }

  const cleanEmail = email.trim().toLowerCase()
  if (cleanEmail.length === 0 || cleanEmail.length > MAX_EMAIL || !EMAIL_RE.test(cleanEmail)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const cleanName = typeof name === 'string' ? name.trim().slice(0, MAX_NAME) || null : null

  const supabase = await createClient()

  // Per-IP rate limit (10 leads / hour) — anonymous endpoint, so the
  // rate-limit key has to come from the request itself.
  const rl = await consumeRateLimit(supabase, {
    key: `leads:${clientIp(req)}`,
    max: 10,
    windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many submissions. Try again later.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }

  const { data: pub } = await supabase
    .from('published_books')
    .select('id, book_id, user_id, title, slug')
    .eq('id', publishedBookId)
    .eq('is_active', true)
    .single()

  if (!pub) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  const { error: leadError } = await supabase
    .from('leads')
    .upsert({
      published_book_id: publishedBookId,
      book_id: pub.book_id,
      user_id: pub.user_id,
      email: cleanEmail,
      name: cleanName,
      // Ignore client-supplied source — could be used to skew analytics.
      source: typeof source === 'string' && source.length < 50 ? source : 'optin',
    }, { onConflict: 'published_book_id,email', ignoreDuplicates: true })

  if (leadError) {
    console.error('[leads] upsert failed', leadError.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('published_book_id', publishedBookId)

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/read/${pub.slug}`

  // MailerLite enrollment — log on failure so a silent outage is visible.
  if (process.env.MAILERLITE_API_KEY && process.env.MAILERLITE_API_KEY !== 'your_mailerlite_api_key_here') {
    try {
      const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
        },
        body: JSON.stringify({
          email: cleanEmail,
          fields: { name: cleanName ?? '' },
          groups: [],
        }),
      })
      if (!res.ok) {
        console.error('[leads] MailerLite enroll failed:', res.status, await res.text().catch(() => ''))
      }
    } catch (e) {
      console.error('[leads] MailerLite enroll error', e)
    }
  }

  if (
    process.env.TELEGRAM_BOT_TOKEN &&
    process.env.TELEGRAM_CHAT_ID &&
    process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here'
  ) {
    try {
      const msg = `📚 New lead for *${pub.title}*\n👤 ${cleanName ?? 'Anonymous'} — ${cleanEmail}\n🔗 ${shareUrl}\n👥 Total leads: ${count ?? '?'}`
      const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: msg,
          parse_mode: 'Markdown',
        }),
      })
      if (!res.ok) {
        console.error('[leads] Telegram notify failed:', res.status, await res.text().catch(() => ''))
      }
    } catch (e) {
      console.error('[leads] Telegram notify error', e)
    }
  }

  return NextResponse.json({ ok: true })
}
