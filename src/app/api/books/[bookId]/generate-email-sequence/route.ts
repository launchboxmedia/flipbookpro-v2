import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit } from '@/lib/rateLimit'
import { generateText } from '@/lib/textGeneration'
import { checkSubscriptionPlan } from '@/lib/stripe'
import type { EmailItem } from '@/types/database'

const SYSTEM_PROMPT = `You are an expert email copywriter for authors and thought leaders. You write 5-email welcome sequences that feel personal, deliver genuine value, and build a relationship between the author and their readers.

RULES:
- Write in first person as the author
- Be specific to this book's content — never generic
- Each email has ONE clear purpose
- Subject lines create curiosity without being clickbait
- Body: 150-200 words. Punchy. No fluff.
- Never start with 'I hope this email finds you'
- Never use: 'excited', 'thrilled', 'delighted', 'journey', 'dive in'
- End each email with exactly ONE clear CTA
- Write to one person, not a list

Sequence structure:
Email 1 (day 0): Welcome + confirm what they just got access to. Warm, direct. CTA: read the first chapter now.
Email 2 (day 2): One specific insight from the book that changes how they see their problem. No CTA to buy anything. CTA: reply with their biggest challenge.
Email 3 (day 4): The core framework or argument the book makes. Why it works when everything else hasn't. CTA: go back and read chapter X.
Email 4 (day 7): Address the #1 objection or doubt readers have after reading. Show you understand their hesitation. CTA: take one specific small action.
Email 5 (day 14): What comes next. The natural next step with the author. This is the soft pitch. CTA: book a call / join a program / buy a product (use the final CTA goal if set).

Return ONLY a JSON array. No preamble. No markdown. No explanation.

[
  {
    "position": 1,
    "subject": "string",
    "preview_text": "string (max 90 chars)",
    "body": "string (HTML with <p> tags)",
    "delay_days": 0
  }
]

delay_days must be exactly: 0, 2, 4, 7, 14 for positions 1-5 respectively.`

const VALID_DELAYS = [0, 2, 4, 7, 14]

function parseSequence(raw: string): EmailItem[] {
  // Strip markdown fences / preamble, then slice to the outermost array.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return a JSON array')
  }
  const arr = JSON.parse(cleaned.slice(start, end + 1)) as unknown
  if (!Array.isArray(arr) || arr.length !== 5) {
    throw new Error('Expected exactly 5 emails')
  }
  return arr.map((e, i): EmailItem => {
    const item = e as Record<string, unknown>
    const position = Number(item.position) || i + 1
    const delayRaw = Number(item.delay_days)
    return {
      position,
      subject: String(item.subject ?? '').slice(0, 200),
      preview_text: String(item.preview_text ?? '').slice(0, 90),
      body: String(item.body ?? ''),
      delay_days: VALID_DELAYS.includes(delayRaw) ? delayRaw : VALID_DELAYS[i] ?? 0,
    }
  })
}

export async function POST(_req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Plan gate — email sequences are Pro only. Authoritative Stripe check.
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, display_name, author_bio')
    .eq('id', user.id)
    .single()

  const plan = await checkSubscriptionPlan(profile?.stripe_customer_id ?? null)
  if (plan !== 'pro') {
    return NextResponse.json({ error: 'Email sequences require a Pro plan' }, { status: 403 })
  }

  const rl = await consumeRateLimit(supabase, {
    key: `gen-email-seq:${user.id}`,
    max: 3,
    windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many sequence generations. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  // Book — defense-in-depth user_id filter even though RLS enforces it.
  const { data: book } = await supabase
    .from('books')
    .select('id, title, subtitle, author_name, persona, back_cover_tagline, back_cover_description, closing_pitch')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()
  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  const { data: pages } = await supabase
    .from('book_pages')
    .select('chapter_title, chapter_index')
    .eq('book_id', params.bookId)
    .gte('chapter_index', 0)
    .neq('chapter_index', 99)
    .order('chapter_index')

  const chapterTitles = (pages ?? [])
    .map((p) => p.chapter_title)
    .filter(Boolean)
    .join(', ')

  const authorName = book.author_name || profile?.display_name || 'the author'

  const userPrompt = `Write a 5-email welcome sequence for readers of '${book.title}' by ${authorName}.

About the book: ${book.back_cover_description || book.subtitle || book.title}
Core promise: ${book.back_cover_tagline || 'Not provided'}
Chapter topics: ${chapterTitles || 'Not provided'}
Author background: ${profile?.author_bio || 'Not provided'}
Final CTA goal: ${book.closing_pitch || 'Learn more from the author'}`

  let emails: EmailItem[]
  try {
    const raw = await generateText({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      humanize: false,
      maxTokens: 4000,
    })
    emails = parseSequence(raw)
  } catch (e) {
    console.error('[generate-email-sequence] generation/parse failed:', (e as Error).message)
    return NextResponse.json({ error: 'Could not generate the email sequence. Try again.' }, { status: 502 })
  }

  // One sequence row per book — update in place if it already exists so
  // re-publishing refreshes rather than duplicating.
  const { data: existing } = await supabase
    .from('email_sequences')
    .select('id')
    .eq('book_id', params.bookId)
    .limit(1)
    .maybeSingle()

  let sequenceId: string | null = null
  if (existing) {
    const { data, error } = await supabase
      .from('email_sequences')
      .update({ emails, status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) {
      console.error('[generate-email-sequence] update failed:', error.message)
      return NextResponse.json({ error: 'Could not save the sequence.' }, { status: 500 })
    }
    sequenceId = data.id
  } else {
    const { data, error } = await supabase
      .from('email_sequences')
      .insert({ book_id: params.bookId, user_id: user.id, emails, status: 'draft' })
      .select('id')
      .single()
    if (error) {
      console.error('[generate-email-sequence] insert failed:', error.message)
      return NextResponse.json({ error: 'Could not save the sequence.' }, { status: 500 })
    }
    sequenceId = data.id
  }

  return NextResponse.json({ sequence_id: sequenceId, emails })
}
