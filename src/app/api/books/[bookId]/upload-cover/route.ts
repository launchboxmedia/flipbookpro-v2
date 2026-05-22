import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { storagePathFromPublicUrl } from '@/lib/imageGeneration'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch existing book with current cover URL for cleanup
  const { data: book } = await supabase
    .from('books')
    .select('id, cover_image_url')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Client uploaded directly to Supabase Storage; we just receive the URL
  const body = await req.json().catch(() => ({}))
  const { coverUrl } = body

  if (typeof coverUrl !== 'string' || !coverUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'Valid coverUrl required' }, { status: 400 })
  }

  // Security: verify URL is from our Supabase storage
  if (!coverUrl.includes('supabase')) {
    return NextResponse.json({ error: 'Invalid storage URL' }, { status: 400 })
  }

  // Update DB with new cover URL
  const { error: updateError } = await supabase
    .from('books')
    .update({ cover_image_url: coverUrl, updated_at: new Date().toISOString() })
    .eq('id', params.bookId)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[upload-cover]', updateError.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  // Best-effort cleanup of old cover
  const oldPath = storagePathFromPublicUrl(book.cover_image_url, 'book-images')
  if (oldPath && book.cover_image_url !== coverUrl) {
    void supabase.storage.from('book-images').remove([oldPath]).then(({ error }) => {
      if (error) console.error('[upload-cover] cleanup failed', error.message)
    })
  }

  return NextResponse.json({ ok: true, url: coverUrl })
}
