import type { SupabaseClient } from '@supabase/supabase-js'
import { consumeRateLimit } from '@/lib/rateLimit'
import { generateText } from '@/lib/textGeneration'
import { getEffectivePlan, planAtLeast } from '@/lib/auth'
import type { EmailItem } from '@/types/database'

// Shared welcome-sequence generation. Called two ways:
//   1. Directly from the publish route via waitUntil (no HTTP round-trip —
//      the old fire-and-forget self-fetch died on serverless teardown).
//   2. From the generate-email-sequence API route (manual trigger button).
// Always receives the caller's *authenticated* Supabase client so the
// email_sequences write happens as the owning author under RLS.

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

export interface GenerateSequenceArgs {
  bookId: string
  userId: string
  supabase: SupabaseClient
}

export interface GenerateSequenceResult {
  success: boolean
  error?: string
  /** HTTP status the API wrapper should return on failure. */
  status?: number
  sequenceId?: string
}

export async function generateEmailSequence(
  { bookId, userId, supabase }: GenerateSequenceArgs,
): Promise<GenerateSequenceResult> {
  // 1. Pro gate — use the SAME resolver as the rest of the app
  // (getEffectivePlan: admin role → active Stripe sub → profiles.plan
  // comp fallback). Calling checkSubscriptionPlan directly here was the
  // bug: it ignored admins and DB-gifted comps, so the UI showed the
  // button but the API 403'd. planAtLeast lets admin pass too.
  const { plan } = await getEffectivePlan(supabase, userId)
  if (!planAtLeast(plan, 'pro')) {
    return { success: false, error: 'Email sequences require a Pro plan', status: 403 }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, author_bio')
    .eq('id', userId)
    .single()

  // 2. Rate limit — 3/hr per user.
  const rl = await consumeRateLimit(supabase, {
    key: `gen-email-seq:${userId}`,
    max: 3,
    windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return { success: false, error: 'Too many sequence generations. Try again later.', status: 429 }
  }

  // 3. Book — defense-in-depth user_id filter even though RLS enforces it.
  const { data: book } = await supabase
    .from('books')
    .select('id, title, subtitle, author_name, persona, back_cover_tagline, back_cover_description, closing_pitch')
    .eq('id', bookId)
    .eq('user_id', userId)
    .single()
  if (!book) return { success: false, error: 'Book not found', status: 404 }

  const { data: pages } = await supabase
    .from('book_pages')
    .select('chapter_title, chapter_index')
    .eq('book_id', bookId)
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

  // 4 + 5. Generate + parse.
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
    console.error('[generateEmailSequence] generation/parse failed:', (e as Error).message)
    return { success: false, error: 'Could not generate the email sequence. Try again.', status: 502 }
  }

  // 6. Upsert — one sequence row per book; update in place if it exists so
  // re-publishing refreshes rather than duplicating.
  const { data: existing } = await supabase
    .from('email_sequences')
    .select('id')
    .eq('book_id', bookId)
    .limit(1)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('email_sequences')
      .update({ emails, status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) {
      console.error('[generateEmailSequence] update failed:', error.message)
      return { success: false, error: 'Could not save the sequence.', status: 500 }
    }
    return { success: true, sequenceId: data.id }
  }

  const { data, error } = await supabase
    .from('email_sequences')
    .insert({ book_id: bookId, user_id: userId, emails, status: 'draft' })
    .select('id')
    .single()
  if (error) {
    console.error('[generateEmailSequence] insert failed:', error.message)
    return { success: false, error: 'Could not save the sequence.', status: 500 }
  }
  return { success: true, sequenceId: data.id }
}
