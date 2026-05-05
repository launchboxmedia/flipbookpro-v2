import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = [
    'full_name', 'author_bio', 'brand_color', 'accent_color', 'social_links', 'logo_url',
    'brand_voice_tone', 'brand_voice_style', 'brand_voice_avoid', 'brand_voice_example',
    // Enrichment-populated fields. The user can hand-edit these on the
    // brand panel after auto-fill, and the panel also persists them via
    // this PATCH after a successful enrichment so the user sees what was
    // saved. enrich_ran_at is server-managed and intentionally NOT here.
    'display_name', 'brand_name', 'brand_tagline', 'cta_url', 'cta_text',
    'primary_color', 'background_color', 'expertise', 'audience_description',
    'offer_types', 'website_url',
  ]
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
