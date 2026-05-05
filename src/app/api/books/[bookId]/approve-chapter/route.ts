import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/textGeneration'

// Pull-quote extraction limits — tuned to keep the result printable as a
// centered editorial spread. Anything outside this range is treated as a
// validation failure.
const MIN_WORDS = 15
const MAX_WORDS = 40

/** Strip surrounding quote characters Sonnet sometimes wraps the answer in
 *  even when told not to. Strips a single layer of straight or curly
 *  single/double quotes from each end, then trims. */
function stripQuoteWrap(s: string): string {
  let t = s.trim()
  const open  = ['"', '"', '“', "'", '‘']
  const close = ['"', '"', '”', "'", '’']
  if (t.length >= 2 && open.includes(t[0]) && close.includes(t[t.length - 1])) {
    t = t.slice(1, -1).trim()
  }
  return t
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

function looksLikeOneSentence(s: string): boolean {
  // One terminal punctuation mark, no internal sentence break. Trailing
  // period/!/? at end is fine; the count of *internal* terminators must be
  // zero.
  const trimmed = s.trim()
  if (!trimmed) return false
  const internal = trimmed.slice(0, -1).match(/[.!?]/g)
  return !internal || internal.length === 0
}

const SYSTEM_PROMPT = `You are an editorial director. Extract the single best pull quote from this chapter.

A great pull quote:
- Makes complete sense without surrounding context
- Is one sentence only, 15-40 words
- Does not start with "I" or reference the author directly
- Contains no jargon requiring explanation
- Would make a reader want to read the full chapter

Return ONLY the sentence. No quotes, no punctuation wrapper, no preamble.`

const STRICTER_RETRY = `${SYSTEM_PROMPT}

CRITICAL: Your previous attempt failed validation. Return EXACTLY one sentence between 15 and 40 words. No surrounding quote marks. No multiple sentences. No preamble like "Here's the quote:" — just the sentence itself.`

async function extractOnce(content: string, system: string): Promise<string | null> {
  try {
    const raw = await generateText({
      systemPrompt: system,
      userPrompt: `<chapter_content>${content}</chapter_content>\nExtract the single best pull quote.`,
      maxTokens: 200,
      humanize: false,
    })
    const cleaned = stripQuoteWrap(raw)
    if (!cleaned) return null
    const words = countWords(cleaned)
    if (words < MIN_WORDS || words > MAX_WORDS) return null
    if (!looksLikeOneSentence(cleaned)) return null
    return cleaned
  } catch {
    return null
  }
}

/** Fire-and-forget pull-quote extractor. Errors and validation failures both
 *  resolve to NULL — chapter approval must never block on this. */
async function extractPullQuote(content: string): Promise<string | null> {
  const first = await extractOnce(content, SYSTEM_PROMPT)
  if (first) return first
  return await extractOnce(content, STRICTER_RETRY)
}

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pageId, approved } = await req.json()

  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Pull the chapter so we know whether we still need a pull quote (handles
  // the retroactive case: a previously-approved chapter whose quote is null
  // gets re-extracted on the next approve).
  const { data: page } = await supabase
    .from('book_pages')
    .select('content, pull_quote, chapter_index')
    .eq('id', pageId)
    .eq('book_id', params.bookId)
    .single<{ content: string | null; pull_quote: string | null; chapter_index: number }>()

  await supabase
    .from('book_pages')
    .update({ approved, updated_at: new Date().toISOString() })
    .eq('id', pageId)
    .eq('book_id', params.bookId)

  // Fire-and-forget pull-quote extraction. Only on approval, only on real
  // chapters (not back-matter, which has chapter_index < 0), only when there
  // is enough text to extract from, and only when we don't already have one.
  // We don't await — the response returns to the user immediately.
  if (
    approved &&
    page &&
    page.chapter_index >= 0 &&
    !page.pull_quote &&
    page.content && page.content.trim().length > 200
  ) {
    void (async () => {
      const quote = await extractPullQuote(page.content!)
      if (!quote) return
      await supabase
        .from('book_pages')
        .update({ pull_quote: quote })
        .eq('id', pageId)
        .eq('book_id', params.bookId)
    })()
  }

  const { data: pages } = await supabase
    .from('book_pages')
    .select('approved')
    .eq('book_id', params.bookId)

  const allApproved = pages?.every((p) => p.approved) ?? false

  if (allApproved) {
    await supabase
      .from('books')
      .update({ status: 'ready', updated_at: new Date().toISOString() })
      .eq('id', params.bookId)
  }

  return NextResponse.json({ ok: true, allApproved })
}
