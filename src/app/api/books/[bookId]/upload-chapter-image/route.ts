import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { storagePathFromPublicUrl } from '@/lib/imageGeneration'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

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

  const formData = await req.formData()
  const file   = formData.get('file') as File | null
  const pageId = formData.get('pageId')
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
  if (typeof pageId !== 'string') return NextResponse.json({ error: 'pageId required' }, { status: 400 })

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Image must be PNG, JPEG, or WebP.' }, { status: 415 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Image must be 5 MB or smaller.' }, { status: 413 })
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

  const ext = MIME_TO_EXT[file.type] ?? 'jpg'
  const filename = `chapters/${params.bookId}/upload-${page.id}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('book-images')
    .upload(filename, buffer, { contentType: file.type, upsert: true })
  if (uploadError) {
    console.error('[upload-chapter-image]', uploadError.message)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('book-images').getPublicUrl(filename)

  const { error: updateError } = await supabase
    .from('book_pages')
    .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', page.id)
    .eq('book_id', params.bookId)
  if (updateError) {
    console.error('[upload-chapter-image]', updateError.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  // Best-effort cleanup of the previous file
  const oldPath = storagePathFromPublicUrl(page.image_url, 'book-images')
  if (oldPath && oldPath !== filename) {
    void supabase.storage.from('book-images').remove([oldPath]).then(({ error }) => {
      if (error) console.error('[upload-chapter-image] cleanup failed', error.message)
    })
  }

  return NextResponse.json({ imageUrl: publicUrl })
}
