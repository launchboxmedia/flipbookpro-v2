import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit } from '@/lib/rateLimit'

export async function DELETE(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await consumeRateLimit(supabase, { key: `delete-resource:${user.id}`, max: 30, windowSeconds: 3600 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in an hour.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }

  const { resourceId } = await req.json().catch(() => ({}))
  if (typeof resourceId !== 'string') {
    return NextResponse.json({ error: 'resourceId required' }, { status: 400 })
  }

  // Verify resource belongs to this book AND user owns the book.
  const { data: resource } = await supabase
    .from('book_resources')
    .select('id, book_id')
    .eq('id', resourceId)
    .eq('book_id', params.bookId)
    .single()

  if (!resource) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
  }

  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('book_resources')
    .delete()
    .eq('id', resourceId)

  if (error) {
    console.error('[delete-resource]', error.message)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
