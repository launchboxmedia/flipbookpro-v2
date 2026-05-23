import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: Request,
  { params }: { params: { keyId: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', params.keyId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to delete key.' }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
