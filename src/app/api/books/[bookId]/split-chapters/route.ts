import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/textGeneration'
import { consumeRateLimit } from '@/lib/rateLimit'
import { validateApiKey } from '@/lib/apiKeys'
import { supabaseAdmin } from '@/lib/supabase/admin'

const MAX_TEXT = 500_000

/** Attempts regex-based chapter boundary detection.
 *  Returns per-chapter content array (null = chapter not found),
 *  or null if coverage < 50% (triggers Haiku fallback). */
function regexSplitChapters(
  text: string,
  chapters: Array<{ title: string }>,
): Array<string | null> | null {
  const positions: Array<{ idx: number; pos: number }> = []

  for (let i = 0; i < chapters.length; i++) {
    const escapedTitle = chapters[i].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const patterns = [
      new RegExp(escapedTitle, 'i'),
      new RegExp(`chapter\\s+${i + 1}\\b`, 'i'),
      new RegExp(`^\\s*${i + 1}[.)\\s]`, 'im'),
    ]
    for (const pattern of patterns) {
      const match = pattern.exec(text)
      if (match) {
        positions.push({ idx: i, pos: match.index })
        break
      }
    }
  }

  if (positions.length / chapters.length < 0.5) return null

  positions.sort((a, b) => a.pos - b.pos)

  const result: Array<string | null> = chapters.map(() => null)
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos
    const end = i + 1 < positions.length ? positions[i + 1].pos : text.length
    result[positions[i].idx] = text.slice(start, end).trim() || null
  }
  return result
}

/** Haiku fallback: asks model to return the opening ~100 chars of each chapter
 *  (anchor text), then searches those anchors in the original text to find
 *  split positions. Keeps output small regardless of manuscript length. */
async function haikuAnchorSplit(
  text: string,
  chapters: Array<{ title: string }>,
): Promise<Array<string | null>> {
  const chapterList = chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')
  const raw = await generateText({
    systemPrompt: `You receive chapter titles and a manuscript. For each chapter, find where it begins. Return ONLY a JSON array: [{"title":"<exact title>","anchor":"<first 100 chars of that chapter opening text, verbatim>"}]. Use null for anchor if the chapter cannot be located.`,
    userPrompt: `Chapters:\n${chapterList}\n\nManuscript:\n<manuscript>\n${text.slice(0, 200_000)}\n</manuscript>`,
    maxTokens: 2000,
    humanize: false,
    model: 'claude-haiku-4-5-20251001',
  })

  type AnchorItem = { title: string; anchor: string | null }
  let anchors: AnchorItem[] = []
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    anchors = match ? (JSON.parse(match[0]) as AnchorItem[]) : []
  } catch {
    return chapters.map(() => null)
  }

  const positions: Array<{ idx: number; pos: number }> = []
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i].anchor
    if (!anchor) continue
    const pos = text.indexOf(anchor)
    if (pos !== -1) positions.push({ idx: i, pos })
  }

  positions.sort((a, b) => a.pos - b.pos)

  const result: Array<string | null> = chapters.map(() => null)
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos
    const end = i + 1 < positions.length ? positions[i + 1].pos : text.length
    result[positions[i].idx] = text.slice(start, end).trim() || null
  }
  return result
}

async function splitChapters(
  text: string,
  chapters: Array<{ title: string; brief: string }>,
): Promise<Array<string | null>> {
  const regexResult = regexSplitChapters(text, chapters)
  if (regexResult !== null) return regexResult
  return haikuAnchorSplit(text, chapters)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { bookId: string } },
) {
  let supabase = await createClient()
  let userId: string

  const authResult = await supabase.auth.getUser()
  if (authResult.data.user) {
    userId = authResult.data.user.id
  } else {
    const apiAuth = await validateApiKey(req)
    if (!apiAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = apiAuth.userId
    supabase = supabaseAdmin
  }

  const rl = await consumeRateLimit(supabase, {
    key: `split-chapters:${userId}`,
    max: 10,
    windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSeconds) },
    })
  }

  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('id', params.bookId)
    .eq('user_id', userId)
    .single()
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const text: string = typeof body.text === 'string' ? body.text.slice(0, MAX_TEXT) : ''
  const chapters: Array<{ title: string; brief: string }> =
    Array.isArray(body.chapters) ? body.chapters : []

  if (!text || chapters.length === 0) {
    return NextResponse.json({ error: 'text and chapters required' }, { status: 400 })
  }

  try {
    const contents = await splitChapters(text, chapters)
    return NextResponse.json({
      chapters: chapters.map((ch, i) => ({ ...ch, content: contents[i] ?? null })),
    })
  } catch (e: unknown) {
    console.error('[split-chapters]', e instanceof Error ? e.message : 'Unknown error')
    return NextResponse.json({ error: 'Split failed' }, { status: 500 })
  }
}
