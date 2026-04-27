import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BrandPanel } from '@/components/settings/BrandPanel'

export default async function BrandPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return <BrandPanel profile={profile ?? null} />
}
