import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hashApiKey, generateRawKey } from '@/lib/apiKeys'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, created_at, last_used_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch keys.' }, { status: 500 })
  return NextResponse.json({ keys: data })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })

  const rawKey = generateRawKey()
  const keyHash = hashApiKey(rawKey)
  const keyPrefix = rawKey.slice(0, 11) + '...'

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: user.id, name, key_hash: keyHash, key_prefix: keyPrefix })
    .select('id, name, key_prefix, created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create key.' }, { status: 500 })

  return NextResponse.json({ key: rawKey, meta: data }, { status: 201 })
}
