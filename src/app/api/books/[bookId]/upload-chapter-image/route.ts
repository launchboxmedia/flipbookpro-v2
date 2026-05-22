import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { storagePathFromPublicUrl } from '@/lib/imageGeneration'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Client uploaded directly to Supabase Storage; we just receive the URL
  const body = await req.json().catch(() => ({}))
  const { pageId, imageUrl } = body

  if (typeof pageId !== 'string') {
    return NextResponse.json({ error: 'pageId required' }, { status: 400 })
  }
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'Valid imageUrl required' }, { status: 400 })
  }

  // Security: verify URL is from our Supabase storage
  if (!imageUrl.includes('supabase')) {
    return NextResponse.json({ error: 'Invalid storage URL' }, { status: 400 })
  }

  // Verify the page belongs to this book (and therefore this user, since
  // we already gated book ownership above). Fetch the existing image_url
  // so we can clean it up after the new one is in place.
  const { data: page } = await supabase
    .from('book_pages')
    .select('id, image_url')
    .eq('id', pageId)
    .eq('book_id', params.bookId)
    .single()
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 })

  // Update DB with new image URL
  const { error: updateError } = await supabase
    .from('book_pages')
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq('id', page.id)
    .eq('book_id', params.bookId)
  if (updateError) {
    console.error('[upload-chapter-image]', updateError.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  // Best-effort cleanup of the previous file
  const oldPath = storagePathFromPublicUrl(page.image_url, 'book-images')
  if (oldPath && page.image_url !== imageUrl) {
    void supabase.storage.from('book-images').remove([oldPath]).then(({ error }) => {
      if (error) console.error('[upload-chapter-image] cleanup failed', error.message)
    })
  }

  return NextResponse.json({ ok: true, url: imageUrl })
}
