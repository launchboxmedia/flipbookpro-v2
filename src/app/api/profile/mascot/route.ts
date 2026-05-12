import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Upload the brand mascot/character to brand-assets/{userId}/mascot.{ext}
// and save the public URL as profiles.mascot_url. Used by the Mascot
// Cover mode in Book Design — openai.images.edit places this character
// as the central hero element on the generated cover layout.
//
// PNG/WebP only on purpose — the mascot is composited onto coloured
// backgrounds, so a transparency channel is required. JPEG is excluded.

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME = new Set(['image/png', 'image/webp'])
const MIME_TO_EXT: Record<string, string> = {
  'image/png':  'png',
  'image/webp': 'webp',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Mascot must be PNG or WebP (transparency required).' }, { status: 415 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Mascot must be 5 MB or smaller.' }, { status: 413 })
  }

  const ext = MIME_TO_EXT[file.type] ?? 'png'
  const path = `${user.id}/mascot.${ext}`
  const buf  = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('brand-assets')
    .upload(path, buf, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[profile/mascot]', uploadError.message)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('brand-assets').getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ mascot_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (updateError) {
    console.error('[profile/mascot]', updateError.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  return NextResponse.json({ mascotUrl: publicUrl })
}
