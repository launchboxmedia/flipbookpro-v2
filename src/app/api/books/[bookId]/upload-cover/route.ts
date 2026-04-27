import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Cover must be PNG, JPEG, or WebP.' }, { status: 415 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Cover must be 5 MB or smaller.' }, { status: 413 })
  }

  const ext = MIME_TO_EXT[file.type] ?? 'jpg'
  const filename = `covers/${params.bookId}-upload-${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('book-images')
    .upload(filename, buffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[upload-cover]', uploadError.message)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('book-images').getPublicUrl(filename)

  const { error: updateError } = await supabase
    .from('books')
    .update({ cover_image_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', params.bookId)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[upload-cover]', updateError.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  return NextResponse.json({ imageUrl: publicUrl })
}
