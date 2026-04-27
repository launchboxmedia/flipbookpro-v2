import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidVisualStyle } from '@/lib/imageGeneration'
import { isValidPaletteId } from '@/lib/palettes'

const MAX_TITLE = 200
const MAX_SUBTITLE = 300
const MAX_AUTHOR = 120
const MAX_CHAPTER_TITLE = 200
const MAX_CHAPTER_BRIEF = 1000
const MAX_CHAPTERS = 30

interface ChapterInput {
  title: string
  brief: string
}

function clampString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function validateChapters(value: unknown): ChapterInput[] | null {
  if (!Array.isArray(value)) return null
  if (value.length === 0 || value.length > MAX_CHAPTERS) return null
  const out: ChapterInput[] = []
  for (const c of value) {
    if (!c || typeof c !== 'object') return null
    const ch = c as { title?: unknown; brief?: unknown }
    const title = clampString(ch.title, MAX_CHAPTER_TITLE)
    if (!title) return null
    out.push({
      title,
      brief: clampString(ch.brief, MAX_CHAPTER_BRIEF) ?? '',
    })
  }
  return out
}

export async function POST(
  req: NextRequest,
  { params }: { params: { bookId: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const title = clampString(body.title, MAX_TITLE)
  if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })

  const persona = clampString(body.persona, 50)
  if (!persona) return NextResponse.json({ error: 'Persona is required.' }, { status: 400 })

  const visualStyle = typeof body.visualStyle === 'string' ? body.visualStyle : null
  if (!visualStyle || !isValidVisualStyle(visualStyle)) {
    return NextResponse.json({ error: 'Invalid visual style.' }, { status: 400 })
  }

  const palette = typeof body.palette === 'string' && body.palette.length > 0 ? body.palette : 'teal-cream'
  if (!isValidPaletteId(palette)) {
    return NextResponse.json({ error: 'Invalid palette.' }, { status: 400 })
  }

  const chapters = validateChapters(body.chapters)
  if (!chapters) {
    return NextResponse.json(
      { error: `Provide between 1 and ${MAX_CHAPTERS} chapters.` },
      { status: 400 },
    )
  }

  const readerLevelRaw = typeof body.readerLevel === 'number' ? body.readerLevel : 5
  const readerLevel = Math.max(1, Math.min(10, Math.round(readerLevelRaw)))

  const { error: bookError } = await supabase
    .from('books')
    .update({
      title,
      subtitle:        clampString(body.subtitle, MAX_SUBTITLE),
      author_name:     clampString(body.authorName, MAX_AUTHOR),
      persona,
      vibe:            clampString(body.vibe, 50),
      writing_tone:    clampString(body.writingTone, 50),
      reader_level:    readerLevel,
      human_score:     !!body.humanScore,
      visual_style:    visualStyle,
      palette,
      cover_direction: clampString(body.coverDirection, 50),
      typography:      clampString(body.typography, 50),
      status:          'draft',
      updated_at:      new Date().toISOString(),
    })
    .eq('id', params.bookId)
    .eq('user_id', user.id)

  if (bookError) {
    console.error('[setup] book update failed', bookError.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  // Increment monthly book counter — non-fatal if it errors, but log so
  // counter drift can be diagnosed.
  const { error: incError } = await supabase.rpc('increment_books_created', { user_id_input: user.id })
  if (incError) console.error('[setup] increment_books_created failed', incError.message)

  // Replace chapters: fetch existing first so we can preserve content/approval/image
  // for unchanged indices, then batch-upsert in a single round-trip.
  const { data: existingPages, error: existingErr } = await supabase
    .from('book_pages')
    .select('chapter_index, content, approved, image_url')
    .eq('book_id', params.bookId)

  if (existingErr) {
    console.error('[setup] existing pages fetch failed', existingErr.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  const existingByIndex: Record<number, { content?: string | null; approved?: boolean; image_url?: string | null }> = {}
  for (const p of existingPages ?? []) {
    existingByIndex[p.chapter_index] = { content: p.content, approved: p.approved, image_url: p.image_url }
  }

  // Trim any chapters beyond the new count
  const maxIndex = chapters.length - 1
  const { error: deleteErr } = await supabase
    .from('book_pages')
    .delete()
    .eq('book_id', params.bookId)
    .gt('chapter_index', maxIndex)
  if (deleteErr) {
    console.error('[setup] chapter prune failed', deleteErr.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  // Single batched upsert — replaces the previous per-chapter loop (N+1).
  const rows = chapters.map((ch, i) => {
    const prev = existingByIndex[i]
    return {
      book_id:        params.bookId,
      chapter_index:  i,
      chapter_title:  ch.title,
      chapter_brief:  ch.brief,
      content:        prev?.content ?? null,
      approved:       prev?.approved ?? false,
      image_url:      prev?.image_url ?? null,
    }
  })

  const { error: upsertErr } = await supabase
    .from('book_pages')
    .upsert(rows, { onConflict: 'book_id,chapter_index' })

  if (upsertErr) {
    console.error('[setup] chapter upsert failed', upsertErr.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
