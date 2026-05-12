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
// Creator Radar inputs — generous caps so users can be specific without
// blowing out the Perplexity prompt.
const MAX_TARGET_AUDIENCE = 500
const MAX_WEBSITE_URL = 500
const MAX_GENRE = 80
// Business-persona context — generous on testimonials so authors can paste
// a few full quotes; offer/CTA stay short.
const MAX_OFFER_TYPE = 50
// 300 server-side gives a small overflow buffer above the wizard
// textarea's 200-char limit — users typing right at the edge don't
// hit a hard server rejection. clampString truncates rather than
// errors, which is the right ergonomics for a single-line pitch.
const MAX_OFFER_DESCRIPTION = 300
const MAX_CTA_INTENT = 200
const MAX_TESTIMONIALS = 2000

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

  // Chapters are now optional — the new wizard doesn't collect chapters
  // before /setup runs (the OutlineStage in coauthor auto-generates them
  // from radar context). Treat any of the following as "skip the
  // book_pages step entirely":
  //   - field absent / null
  //   - empty array
  // When the caller sends a non-empty array, validate strictly so we
  // don't accept malformed payloads silently.
  let chapters: ChapterInput[] | null = null
  if (Array.isArray(body.chapters) && body.chapters.length > 0) {
    chapters = validateChapters(body.chapters)
    if (!chapters) {
      return NextResponse.json(
        { error: `Provide between 1 and ${MAX_CHAPTERS} chapters, or omit the field entirely.` },
        { status: 400 },
      )
    }
  }

  const readerLevelRaw = typeof body.readerLevel === 'number' ? body.readerLevel : 5
  const readerLevel = Math.max(1, Math.min(10, Math.round(readerLevelRaw)))

  // Resolve author name with a profile fallback: wizard input wins; if the
  // wizard didn't supply one, default to the profile's display_name or
  // full_name so first publish doesn't ship without an author byline. The
  // BookDesignStage author-name field lets users edit / clear this later
  // — that path writes books.author_name directly via the client, so a
  // user clear there is preserved across re-setup runs only because the
  // wizard isn't typically re-run after the book leaves draft state.
  let authorName = clampString(body.authorName, MAX_AUTHOR)
  if (!authorName) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, full_name')
      .eq('id', user.id)
      .maybeSingle()
    authorName =
      clampString(profile?.display_name, MAX_AUTHOR) ??
      clampString(profile?.full_name,    MAX_AUTHOR)
  }

  const { error: bookError } = await supabase
    .from('books')
    .update({
      title,
      subtitle:        clampString(body.subtitle, MAX_SUBTITLE),
      author_name:     authorName,
      persona,
      vibe:            clampString(body.vibe, 50),
      writing_tone:    clampString(body.writingTone, 50),
      reader_level:    readerLevel,
      human_score:     !!body.humanScore,
      visual_style:    visualStyle,
      palette,
      cover_direction: clampString(body.coverDirection, 50),
      typography:      clampString(body.typography, 50),
      // Creator Radar inputs. Persona-conditional fields (website_url for
      // business, genre for storyteller) come through cleared by the wizard
      // when the persona doesn't match — clampString turns empty strings
      // into nulls automatically.
      target_audience: clampString(body.targetAudience, MAX_TARGET_AUDIENCE),
      website_url:     clampString(body.websiteUrl,    MAX_WEBSITE_URL),
      genre:           clampString(body.genre,         MAX_GENRE),
      // Business-persona-only context. The wizard clears these when persona
      // !== 'business', so clampString turns empty input into NULLs and
      // non-business books stay clean.
      offer_type:        clampString(body.offerType,        MAX_OFFER_TYPE),
      offer_description: clampString(body.offerDescription, MAX_OFFER_DESCRIPTION),
      cta_intent:        clampString(body.ctaIntent,        MAX_CTA_INTENT),
      testimonials:      clampString(body.testimonials,     MAX_TESTIMONIALS),
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

  // Chapters block — runs only when the caller sent a chapters array.
  // The new wizard skips this entirely; the OutlineStage in coauthor
  // generates chapters from radar context after setup completes.
  if (chapters === null) {
    return NextResponse.json({ ok: true })
  }

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
