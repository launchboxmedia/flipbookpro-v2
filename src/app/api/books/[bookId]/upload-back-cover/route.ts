import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { storagePathFromPublicUrl } from '@/lib/imageGeneration'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch existing book with current back cover URL for cleanup
  const { data: book } = await supabase
    .from('books')
    .select('id, back_cover_image_url')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Client uploaded directly to Supabase Storage; we just receive the URL
  const body = await req.json().catch(() => ({}))
  const { backCoverUrl } = body

  if (typeof backCoverUrl !== 'string' || !backCoverUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'Valid backCoverUrl required' }, { status: 400 })
  }

  // Security: verify URL is from our Supabase storage
  if (!backCoverUrl.includes('supabase')) {
    return NextResponse.json({ error: 'Invalid storage URL' }, { status: 400 })
  }

  // Update DB with new back cover URL
  const { error: updateError } = await supabase
    .from('books')
    .update({ back_cover_image_url: backCoverUrl, updated_at: new Date().toISOString() })
    .eq('id', params.bookId)
    .eq('user_id', user.id)
  if (updateError) {
    console.error('[upload-back-cover]', updateError.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  // Best-effort cleanup of old file
  const oldPath = storagePathFromPublicUrl(book.back_cover_image_url, 'book-images')
  if (oldPath && book.back_cover_image_url !== backCoverUrl) {
    void supabase.storage.from('book-images').remove([oldPath]).then(({ error }) => {
      if (error) console.error('[upload-back-cover] cleanup failed', error.message)
    })
  }

  return NextResponse.json({ ok: true, url: backCoverUrl })
}

export async function DELETE(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: book } = await supabase
    .from('books')
    .select('id, back_cover_image_url')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error: updateError } = await supabase
    .from('books')
    .update({ back_cover_image_url: null, updated_at: new Date().toISOString() })
    .eq('id', params.bookId)
    .eq('user_id', user.id)
  if (updateError) {
    console.error('[upload-back-cover]', updateError.message)
    return NextResponse.json({ error: 'Remove failed' }, { status: 500 })
  }

  const oldPath = storagePathFromPublicUrl(book.back_cover_image_url, 'book-images')
  if (oldPath) {
    void supabase.storage.from('book-images').remove([oldPath]).then(({ error }) => {
      if (error) console.error('[upload-back-cover] cleanup failed', error.message)
    })
  }

  return NextResponse.json({ ok: true })
}
