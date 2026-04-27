import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('books')
    .select('id, title')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: backMatterPages } = await supabase
    .from('book_pages')
    .select('id, chapter_index, chapter_title, content, approved')
    .eq('book_id', params.bookId)
    .lt('chapter_index', 0)
    .order('chapter_index', { ascending: false })

  return NextResponse.json({ pages: backMatterPages ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, content, title } = await req.json()

  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const typeIndexMap: Record<string, number> = {
    upsell: -1,
    affiliate: -2,
    custom: -3,
  }

  const chapterIndex = typeIndexMap[type] ?? -4

  await supabase.from('book_pages').upsert({
    book_id: params.bookId,
    chapter_index: chapterIndex,
    chapter_title: title ?? type,
    content,
    approved: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'book_id,chapter_index' })

  return NextResponse.json({ ok: true })
}
