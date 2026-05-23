import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { storageKey } = body

  if (typeof storageKey !== 'string' || !storageKey) {
    return NextResponse.json({ error: 'storageKey required' }, { status: 400 })
  }

  // Extract bookId from storageKey: "{type}/{bookId}/{filename}"
  const parts = storageKey.split('/')
  if (parts.length < 3) {
    return NextResponse.json({ error: 'Invalid storageKey' }, { status: 400 })
  }
  const bookId = parts[1]

  // Verify user owns this book
  const { data: book } = await supabase
    .from('books')
    .select('id, cover_image_url, back_cover_image_url')
    .eq('id', bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Build the public URL to match against DB columns
  const publicUrl = supabaseAdmin.storage.from('book-images').getPublicUrl(storageKey).data.publicUrl

  // Delete from storage
  const { error: storageError } = await supabaseAdmin
    .storage
    .from('book-images')
    .remove([storageKey])

  if (storageError) {
    console.error('[delete-image] storage remove failed:', storageError.message)
    return NextResponse.json({ error: 'Storage delete failed' }, { status: 500 })
  }

  // Null out DB references if image was in use
  const pathType = parts[0]

  if (pathType === 'covers' && book.cover_image_url === publicUrl) {
    await supabase
      .from('books')
      .update({ cover_image_url: null })
      .eq('id', bookId)
      .eq('user_id', user.id)
  }

  if (pathType === 'back-covers' && book.back_cover_image_url === publicUrl) {
    await supabase
      .from('books')
      .update({ back_cover_image_url: null })
      .eq('id', bookId)
      .eq('user_id', user.id)
  }

  if (pathType === 'chapters') {
    await supabase
      .from('book_pages')
      .update({ image_url: null })
      .eq('book_id', bookId)
      .eq('image_url', publicUrl)
  }

  return NextResponse.json({ ok: true })
}
