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
  const { title, subtitle, authorName, persona, visualStyle, coverDirection, typography, chapters } = body

  const { error: bookError } = await supabase
    .from('books')
    .update({
      title,
      subtitle,
      author_name: authorName,
      persona,
      visual_style: visualStyle,
      cover_direction: coverDirection,
      typography,
      status: 'draft',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.bookId)
    .eq('user_id', user.id)

  if (bookError) return NextResponse.json({ error: bookError.message }, { status: 500 })

  if (chapters && chapters.length > 0) {
    await supabase.from('book_pages').delete().eq('book_id', params.bookId)

    const pages = chapters.map((ch: { title: string; brief: string }, i: number) => ({
      book_id: params.bookId,
      chapter_index: i,
      chapter_title: ch.title,
      chapter_brief: ch.brief,
      approved: false,
    }))

    const { error: pagesError } = await supabase.from('book_pages').insert(pages)
    if (pagesError) return NextResponse.json({ error: pagesError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
