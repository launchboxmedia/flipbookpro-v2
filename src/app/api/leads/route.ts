import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, name, publishedBookId, source } = await req.json()
  if (!email || !publishedBookId) {
    return NextResponse.json({ error: 'email and publishedBookId required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch the published book to get owner info
  const { data: pub } = await supabase
    .from('published_books')
    .select('id, book_id, user_id, title, slug')
    .eq('id', publishedBookId)
    .eq('is_active', true)
    .single()

  if (!pub) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  // Save lead (ignore duplicate)
  const { error: leadError } = await supabase
    .from('leads')
    .upsert({
      published_book_id: publishedBookId,
      book_id: pub.book_id,
      user_id: pub.user_id,
      email: email.toLowerCase().trim(),
      name: name?.trim() || null,
      source: source || 'optin',
    }, { onConflict: 'published_book_id,email', ignoreDuplicates: true })

  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 })

  // Get total lead count for Telegram
  const { count } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('published_book_id', publishedBookId)

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/read/${pub.slug}`

  // MailerLite enrollment
  if (process.env.MAILERLITE_API_KEY && process.env.MAILERLITE_API_KEY !== 'your_mailerlite_api_key_here') {
    try {
      await fetch('https://connect.mailerlite.com/api/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MAILERLITE_API_KEY}`,
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          fields: { name: name?.trim() || '' },
          groups: [],
        }),
      })
    } catch {
      // Non-fatal — don't block the lead response
    }
  }

  // Telegram notification
  if (
    process.env.TELEGRAM_BOT_TOKEN &&
    process.env.TELEGRAM_CHAT_ID &&
    process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here'
  ) {
    try {
      const msg = `📚 New lead for *${pub.title}*\n👤 ${name || 'Anonymous'} — ${email}\n🔗 ${shareUrl}\n👥 Total leads: ${count ?? '?'}`
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: msg,
          parse_mode: 'Markdown',
        }),
      })
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({ ok: true })
}
