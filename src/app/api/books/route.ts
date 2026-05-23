import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey } from '@/lib/apiKeys'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  let supabase = await createClient()
  let userId: string

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    userId = user.id
  } else {
    const apiAuth = await validateApiKey(req)
    if (!apiAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = apiAuth.userId
    supabase = supabaseAdmin
  }

  const body = await req.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })

  const persona = typeof body.persona === 'string' ? body.persona.trim() || null : null

  const { data: book, error } = await supabase
    .from('books')
    .insert({
      user_id: userId,
      title,
      status: 'draft',
      cover_has_text: true,
      persona,
      updated_at: new Date().toISOString(),
    })
    .select('id, title, status, created_at')
    .single()

  if (error) {
    console.error('[POST /api/books] insert failed:', error.message)
    return NextResponse.json({ error: 'Failed to create book.' }, { status: 500 })
  }

  return NextResponse.json({ book }, { status: 201 })
}
