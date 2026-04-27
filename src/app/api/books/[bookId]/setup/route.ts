import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: { bookId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, subtitle, authorName, persona, vibe, writingTone, readerLevel, humanScore, visualStyle, palette, coverDirection, typography, chapters } = body

  const { error: bookError } = await supabase
    .from('books')
    .update({
      title,
      subtitle,
      author_name: authorName,
      persona,
      vibe,
      writing_tone: writingTone,
      reader_level: readerLevel,
      human_score: humanScore,
      visual_style: visualStyle,
      palette,
      cover_direction: coverDirection,
      typography,
      status: 'draft',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.bookId)
    .eq('user_id', user.id)

  if (bookError) return NextResponse.json({ error: bookError.message }, { status: 500 })

  // Increment monthly book counter
  await supabase.rpc('increment_books_created', { user_id_input: user.id })

  if (chapters && chapters.length > 0) {
    // Upsert on book_id + chapter_index composite key
    // Preserves existing content and approval status
    const { data: existingPages } = await supabase
      .from('book_pages')
      .select('chapter_index, content, approved, image_url')
      .eq('book_id', params.bookId)

    const existingByIndex: Record<number, { content?: string; approved?: boolean; image_url?: string }> = {}
    for (const p of existingPages ?? []) {
      existingByIndex[p.chapter_index] = { content: p.content, approved: p.approved, image_url: p.image_url }
    }

    // Remove chapters beyond the new count
    const maxIndex = chapters.length - 1
    await supabase
      .from('book_pages')
      .delete()
      .eq('book_id', params.bookId)
      .gt('chapter_index', maxIndex)

    // Upsert each chapter — preserves existing content for unchanged indices
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i] as { title: string; brief: string }
      const existing = existingByIndex[i]

      const { error } = await supabase
        .from('book_pages')
        .upsert(
          {
            book_id: params.bookId,
            chapter_index: i,
            chapter_title: ch.title,
            chapter_brief: ch.brief,
            content: existing?.content ?? null,
            approved: existing?.approved ?? false,
            image_url: existing?.image_url ?? null,
          },
          { onConflict: 'book_id,chapter_index' }
        )

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
