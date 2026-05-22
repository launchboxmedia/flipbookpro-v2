import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_NICHE = 200
const MAX_TARGET_AUDIENCE = 500
const MAX_OFFER_DESCRIPTION = 300
const MAX_OFFER_TYPE = 50
const MAX_CTA_INTENT = 200
const MAX_WEBSITE_URL = 500

function clampString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

export async function PATCH(req: NextRequest, { params }: { params: { bookId: string } }) {
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

  const body = await req.json().catch(() => ({}))
  const updates: Partial<Record<string, string | null>> = {}

  if ('niche' in body) {
    updates.niche = clampString(body.niche, MAX_NICHE)
  }

  if ('target_audience' in body) {
    updates.target_audience = clampString(body.target_audience, MAX_TARGET_AUDIENCE)
  }

  if ('offer_description' in body) {
    updates.offer_description = clampString(body.offer_description, MAX_OFFER_DESCRIPTION)
  }

  if ('offer_type' in body) {
    updates.offer_type = clampString(body.offer_type, MAX_OFFER_TYPE)
  }

  if ('cta_intent' in body) {
    updates.cta_intent = clampString(body.cta_intent, MAX_CTA_INTENT)
  }

  if ('website_url' in body) {
    updates.website_url = clampString(body.website_url, MAX_WEBSITE_URL)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('books')
    .update(updates)
    .eq('id', params.bookId)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[book-details] update failed:', updateError.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
