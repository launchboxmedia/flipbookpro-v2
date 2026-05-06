import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Wizard incremental save ────────────────────────────────────────────────
// Lighter sibling of /setup. Stores whatever subset of WizardData the
// caller sends so a user who exits the wizard mid-flow doesn't lose their
// chapters / title / persona / etc. /setup remains the strict "I'm done
// with the wizard" finaliser — it gates on title + persona + visualStyle +
// palette + chapters and increments the monthly book counter.
//
// This route validates ownership and field shapes but accepts ANY subset.
// Called fire-and-forget from WizardShell on each step transition; the user
// never has to wait for it.

const MAX_TITLE = 200
const MAX_SUBTITLE = 300
const MAX_AUTHOR = 120
const MAX_CHAPTER_TITLE = 200
const MAX_CHAPTER_BRIEF = 1000
const MAX_CHAPTERS = 30
const MAX_TARGET_AUDIENCE = 500
const MAX_WEBSITE_URL = 500
const MAX_GENRE = 80
const MAX_OFFER_TYPE = 50
const MAX_CTA_INTENT = 200
const MAX_TESTIMONIALS = 2000

interface ChapterInput { title: string; brief: string }

/** Trim → optional. Empty string returns null so the column update writes
 *  null, not an empty string (downstream clients check for null/undefined). */
function clampString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function validateChapters(value: unknown): ChapterInput[] | null {
  if (!Array.isArray(value)) return null
  if (value.length > MAX_CHAPTERS) return null
  const out: ChapterInput[] = []
  for (const c of value) {
    if (!c || typeof c !== 'object') continue
    const ch = c as { title?: unknown; brief?: unknown }
    const title = clampString(ch.title, MAX_CHAPTER_TITLE)
    if (!title) continue
    out.push({ title, brief: clampString(ch.brief, MAX_CHAPTER_BRIEF) ?? '' })
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

  // Ownership check — single round-trip, no select needed beyond id.
  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .maybeSingle<{ id: string }>()
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Build a partial patch that only touches keys present in the request.
  // Using `in` check instead of `?? null` so we don't accidentally clear
  // fields the caller didn't intend to update.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if ('title' in body) {
    const title = clampString(body.title, MAX_TITLE)
    // Allow null to clear, but the wizard always sends the user's typed
    // value. Default fallback to the empty case is null.
    if (title) patch.title = title
  }
  if ('subtitle'   in body) patch.subtitle    = clampString(body.subtitle,   MAX_SUBTITLE)
  if ('authorName' in body) patch.author_name = clampString(body.authorName, MAX_AUTHOR)
  if ('persona'    in body) patch.persona     = clampString(body.persona, 50)
  if ('vibe'       in body) patch.vibe        = clampString(body.vibe, 50)
  if ('writingTone'in body) patch.writing_tone = clampString(body.writingTone, 50)
  if ('readerLevel' in body) {
    const n = typeof body.readerLevel === 'number' ? body.readerLevel : NaN
    if (Number.isFinite(n)) patch.reader_level = Math.max(1, Math.min(10, Math.round(n)))
  }
  if ('humanScore' in body) patch.human_score = !!body.humanScore
  if ('visualStyle' in body) {
    // No isValidVisualStyle gate here — partial save tolerates the user
    // pivoting between wizard steps where some fields aren't fully chosen
    // yet. setup() still validates it strictly when finalising.
    patch.visual_style = clampString(body.visualStyle, 50)
  }
  if ('palette'        in body) patch.palette         = clampString(body.palette, 50)
  if ('coverDirection' in body) patch.cover_direction = clampString(body.coverDirection, 50)
  if ('typography'     in body) patch.typography      = clampString(body.typography, 50)
  if ('targetAudience' in body) patch.target_audience = clampString(body.targetAudience, MAX_TARGET_AUDIENCE)
  if ('websiteUrl'     in body) patch.website_url     = clampString(body.websiteUrl,     MAX_WEBSITE_URL)
  if ('genre'          in body) patch.genre           = clampString(body.genre,          MAX_GENRE)
  if ('offerType'      in body) patch.offer_type      = clampString(body.offerType,      MAX_OFFER_TYPE)
  if ('ctaIntent'      in body) patch.cta_intent      = clampString(body.ctaIntent,      MAX_CTA_INTENT)
  if ('testimonials'   in body) patch.testimonials    = clampString(body.testimonials,   MAX_TESTIMONIALS)
  // Niche is the topic string from Step 1. Persisted so the per-book
  // Creator Radar's intelligence_cache key has meaningful entropy on the
  // new wizard, where title/audience/genre/etc. are all empty when the
  // background radar fires. Capped at 200 chars (matches MAX_TITLE-ish
  // since users sometimes paste a sentence).
  if ('niche'          in body) patch.niche           = clampString(body.niche, 200)

  // Update book row only when there's at least one field to set besides
  // updated_at (avoids a no-op DB write).
  const hasBookFields = Object.keys(patch).some((k) => k !== 'updated_at')
  if (hasBookFields) {
    const { error: bookError } = await supabase
      .from('books')
      .update(patch)
      .eq('id', params.bookId)
      .eq('user_id', user.id)
    if (bookError) {
      console.error('[wizard-progress] book update failed', bookError.message)
      return NextResponse.json({ error: 'Save failed' }, { status: 500 })
    }
  }

  // Chapters — only touch book_pages when explicitly provided. Mirrors
  // setup's logic: preserve content/approval/image for unchanged indices,
  // upsert in a single round-trip, prune trailing chapters.
  if ('chapters' in body) {
    const chapters = validateChapters(body.chapters)
    if (chapters === null) {
      // Bad shape — refuse but don't 500, the book row update already landed.
      return NextResponse.json({ error: `Invalid chapters payload (max ${MAX_CHAPTERS}).` }, { status: 400 })
    }

    const { data: existingPages, error: existingErr } = await supabase
      .from('book_pages')
      .select('chapter_index, content, approved, image_url')
      .eq('book_id', params.bookId)
    if (existingErr) {
      console.error('[wizard-progress] existing pages fetch failed', existingErr.message)
      return NextResponse.json({ error: 'Save failed' }, { status: 500 })
    }
    const existingByIndex: Record<number, { content?: string | null; approved?: boolean; image_url?: string | null }> = {}
    for (const p of existingPages ?? []) {
      existingByIndex[p.chapter_index] = { content: p.content, approved: p.approved, image_url: p.image_url }
    }

    const maxIndex = chapters.length - 1
    if (maxIndex >= 0) {
      const { error: deleteErr } = await supabase
        .from('book_pages')
        .delete()
        .eq('book_id', params.bookId)
        .gt('chapter_index', maxIndex)
      if (deleteErr) {
        console.error('[wizard-progress] chapter prune failed', deleteErr.message)
        return NextResponse.json({ error: 'Save failed' }, { status: 500 })
      }
    } else {
      // Caller sent an empty array — clear all chapters for this book.
      const { error: deleteErr } = await supabase
        .from('book_pages')
        .delete()
        .eq('book_id', params.bookId)
        .gte('chapter_index', 0)
      if (deleteErr) {
        console.error('[wizard-progress] chapter clear failed', deleteErr.message)
        return NextResponse.json({ error: 'Save failed' }, { status: 500 })
      }
    }

    if (chapters.length > 0) {
      const rows = chapters.map((ch, i) => {
        const prev = existingByIndex[i]
        return {
          book_id:       params.bookId,
          chapter_index: i,
          chapter_title: ch.title,
          chapter_brief: ch.brief,
          content:       prev?.content   ?? null,
          approved:      prev?.approved  ?? false,
          image_url:     prev?.image_url ?? null,
        }
      })
      const { error: upsertErr } = await supabase
        .from('book_pages')
        .upsert(rows, { onConflict: 'book_id,chapter_index' })
      if (upsertErr) {
        console.error('[wizard-progress] chapter upsert failed', upsertErr.message)
        return NextResponse.json({ error: 'Save failed' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
