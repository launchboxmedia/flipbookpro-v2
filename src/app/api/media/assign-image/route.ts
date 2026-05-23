import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { publicUrl, bookId, chapterIndex, type } = body

  if (typeof publicUrl !== 'string' || !publicUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'Valid publicUrl required' }, { status: 400 })
  }
  if (typeof bookId !== 'string') {
    return NextResponse.json({ error: 'bookId required' }, { status: 400 })
  }
  if (!['cover', 'chapter', 'back-cover'].includes(type)) {
    return NextResponse.json({ error: 'type must be cover, chapter, or back-cover' }, { status: 400 })
  }

  // Verify user owns the target book
  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('id', bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  if (type === 'cover') {
    const { error } = await supabase
      .from('books')
      .update({ cover_image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', bookId)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  } else if (type === 'back-cover') {
    const { error } = await supabase
      .from('books')
      .update({ back_cover_image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', bookId)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  } else if (type === 'chapter') {
    if (typeof chapterIndex !== 'number') {
      return NextResponse.json({ error: 'chapterIndex required for chapter type' }, { status: 400 })
    }
    const { error } = await supabase
      .from('book_pages')
      .update({ image_url: publicUrl })
      .eq('book_id', bookId)
      .eq('chapter_index', chapterIndex)
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
