import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_FILE_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // SVG is intentionally excluded — it can carry inline scripts that execute
  // when the file is rendered as <img src> in older browsers or when opened
  // in a tab via direct URL.
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Logo must be PNG, JPEG, or WebP.' }, { status: 415 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Logo must be 2 MB or smaller.' }, { status: 413 })
  }

  const ext = MIME_TO_EXT[file.type] ?? 'png'
  const path = `${user.id}/logo.${ext}`
  const buf  = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('brand-assets')
    .upload(path, buf, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[profile/logo]', uploadError.message)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('brand-assets').getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (updateError) {
    console.error('[profile/logo]', updateError.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  return NextResponse.json({ logoUrl: publicUrl })
}
