import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  await supabase
    .from('book_pages')
    .update({ approved, updated_at: new Date().toISOString() })
    .eq('id', pageId)
    .eq('book_id', params.bookId)

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
