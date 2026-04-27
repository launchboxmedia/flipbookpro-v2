import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ApiKeysPanel } from './ApiKeysPanel'

export const metadata = { title: 'API Keys — FlipBookPro' }

export default async function ApiKeysPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // NOTE: Requires migration to create api_keys table:
  // create table api_keys (
  //   id uuid default gen_random_uuid() primary key,
  //   user_id uuid references auth.users(id) on delete cascade not null,
  //   name text not null,
  //   key_hash text not null,
  //   key_prefix text not null,
  //   created_at timestamptz default now(),
  //   last_used_at timestamptz
  // );

  // For now, fetch existing keys (masked) if table exists
  let existingKeys: { id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null }[] = []
  try {
    const { data } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, created_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    existingKeys = data ?? []
  } catch {
    // Table may not exist yet
  }

  return <ApiKeysPanel userId={user.id} existingKeys={existingKeys} />
}
