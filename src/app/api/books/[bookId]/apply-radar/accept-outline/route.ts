import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Accept the suggested outline from /apply-radar ─────────────────────────
// The /apply-radar route returns a suggested outline but never writes it.
// This endpoint applies that suggestion under strict rules:
//   - Approved chapters are NEVER touched (their content + title + brief
//     are canonical once the user has signed off on a draft).
//   - Order is preserved by chapter_index — no reordering.
//   - Unapproved chapters at indices the suggestion covers get their
//     title and brief updated.
//   - Suggested chapters BEYOND the current chapter count are inserted
//     as new unapproved rows.
//   - Existing unapproved chapters BEYOND the suggestion length are left
//     in place — the spec is explicit about not deleting work the user
//     might still want.

const MAX_CHAPTERS = 30
const MAX_TITLE = 200
const MAX_BRIEF = 1500

interface SuggestedChapter { title: string; brief: string }

function clamp(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function validate(input: unknown): SuggestedChapter[] | null {
  if (!Array.isArray(input)) return null
  if (input.length > MAX_CHAPTERS) return null
  const out: SuggestedChapter[] = []
  for (const item of input) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const title = clamp(obj.title, MAX_TITLE)
    if (!title) continue
    out.push({ title, brief: clamp(obj.brief, MAX_BRIEF) })
  }
  return out
}

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const suggested = validate(body?.chapters)
  if (suggested === null) {
    return NextResponse.json({ error: `Invalid chapters payload (max ${MAX_CHAPTERS}).` }, { status: 400 })
  }
  if (suggested.length === 0) {
    return NextResponse.json({ error: 'No chapters to apply.' }, { status: 400 })
  }

  // Ownership
  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .maybeSingle<{ id: string }>()
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Pull current chapter list including approval state. We need each row's
  // id and approved flag to decide which suggestions can be applied.
  const { data: existingPages, error: existingErr } = await supabase
    .from('book_pages')
    .select('id, chapter_index, approved')
    .eq('book_id', params.bookId)
    .gte('chapter_index', 0)
    .order('chapter_index', { ascending: true })
  if (existingErr) {
    console.error('[accept-outline] fetch existing failed', existingErr.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }
  const byIndex: Record<number, { id: string; approved: boolean }> = {}
  for (const p of existingPages ?? []) {
    byIndex[p.chapter_index] = { id: p.id, approved: p.approved }
  }

  let updated = 0
  let inserted = 0
  let skipped = 0

  // Apply suggestions in sequence. Suggestion at position i targets
  // chapter_index i. Approved → skip. Unapproved exists → update. No
  // existing → insert as unapproved.
  for (let i = 0; i < suggested.length; i++) {
    const s = suggested[i]
    const existing = byIndex[i]

    if (existing && existing.approved) {
      skipped++
      continue
    }

    if (existing) {
      const { error } = await supabase
        .from('book_pages')
        .update({
          chapter_title: s.title,
          chapter_brief: s.brief,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('book_id', params.bookId)
      if (error) {
        console.error('[accept-outline] update failed', error.message)
        return NextResponse.json({ error: 'Save failed' }, { status: 500 })
      }
      updated++
    } else {
      const { error } = await supabase
        .from('book_pages')
        .insert({
          book_id:       params.bookId,
          chapter_index: i,
          chapter_title: s.title,
          chapter_brief: s.brief,
          approved:      false,
        })
      if (error) {
        console.error('[accept-outline] insert failed', error.message)
        return NextResponse.json({ error: 'Save failed' }, { status: 500 })
      }
      inserted++
    }
  }

  return NextResponse.json({ ok: true, updated, inserted, skipped })
}
