import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_TAGLINE = 200
const MAX_DESCRIPTION = 1000
const MAX_CTA_TEXT = 80
const MAX_CTA_URL = 500

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_CTA_URL) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function clamp(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const ctaUrl = body.back_cover_cta_url === null || body.back_cover_cta_url === undefined || body.back_cover_cta_url === ''
    ? null
    : safeUrl(body.back_cover_cta_url)
  if (body.back_cover_cta_url && ctaUrl === null) {
    return NextResponse.json({ error: 'CTA URL must be a valid http(s) URL.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('books')
    .update({
      back_cover_tagline:     clamp(body.back_cover_tagline, MAX_TAGLINE),
      back_cover_description: clamp(body.back_cover_description, MAX_DESCRIPTION),
      back_cover_cta_text:    clamp(body.back_cover_cta_text, MAX_CTA_TEXT),
      back_cover_cta_url:     ctaUrl,
      updated_at:             new Date().toISOString(),
    })
    .eq('id', params.bookId)
    .eq('user_id', user.id)

  if (error) {
    console.error('[back-cover]', error.message)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
