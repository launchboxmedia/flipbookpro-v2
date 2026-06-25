import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { consumeRateLimit } from '@/lib/rateLimit'
import { inngest } from '@/inngest/client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { publishedBookId, email, surveyResponse } = body

  if (
    typeof publishedBookId !== 'string' ||
    typeof email !== 'string' ||
    typeof surveyResponse !== 'string'
  ) {
    return NextResponse.json(
      { error: 'publishedBookId, email, and surveyResponse required' },
      { status: 400 },
    )
  }

  const cleanEmail = email.trim().toLowerCase()
  if (!EMAIL_RE.test(cleanEmail)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const cleanResponse = surveyResponse.trim()
  if (!cleanResponse || cleanResponse.length > 500) {
    return NextResponse.json({ error: 'Invalid survey response' }, { status: 400 })
  }

  const supabase = await createClient()

  const rl = await consumeRateLimit(supabase, {
    key: `survey:${clientIp(req)}`,
    max: 20,
    windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many submissions. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  // Verify survey is active and response is one of the allowed options.
  // Prevents arbitrary strings being injected into the AI sequence prompt.
  const { data: pub } = await supabaseAdmin
    .from('published_books')
    .select('id, book_id, user_id, title, slug, survey_enabled, survey_options')
    .eq('id', publishedBookId)
    .eq('is_active', true)
    .single()

  if (!pub) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  if (!pub.survey_enabled) {
    return NextResponse.json({ error: 'Survey not enabled for this book' }, { status: 400 })
  }

  const allowedOptions = Array.isArray(pub.survey_options) ? pub.survey_options as string[] : null
  if (allowedOptions && !allowedOptions.includes(cleanResponse)) {
    return NextResponse.json({ error: 'Invalid survey option' }, { status: 400 })
  }

  // Verify the lead exists — only readers who already opted in can submit.
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, name, survey_response')
    .eq('published_book_id', publishedBookId)
    .eq('email', cleanEmail)
    .maybeSingle()

  if (!lead) {
    return NextResponse.json({ error: 'Please submit your email first' }, { status: 403 })
  }

  // Idempotent — don't fire the sequence again if they already answered.
  if (lead.survey_response) {
    return NextResponse.json({ ok: true })
  }

  const { error: updateError } = await supabaseAdmin
    .from('leads')
    .update({ survey_response: cleanResponse })
    .eq('id', lead.id)

  if (updateError) {
    console.error('[leads/survey] update failed', updateError.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  // Fetch book details for the Inngest payload.
  const { data: book } = await supabaseAdmin
    .from('books')
    .select('author_name, back_cover_description, user_id')
    .eq('id', pub.book_id)
    .single()

  let authorName = 'The Author'
  if (book?.author_name) {
    authorName = book.author_name
  } else if (book?.user_id) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('display_name')
      .eq('id', book.user_id)
      .single()
    if (profile?.display_name) authorName = profile.display_name
  }

  void inngest.send({
    name: 'app/lead.survey_response',
    data: {
      leadId: lead.id,
      email: cleanEmail,
      readerName: lead.name ?? null,
      bookTitle: pub.title,
      authorName,
      bookDescription: book?.back_cover_description ?? '',
      surveyResponse: cleanResponse,
      bookId: pub.book_id,
    },
  }).catch((err) => console.error('[leads/survey] inngest.send failed:', err))

  return NextResponse.json({ ok: true })
}
