import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BillingPanel } from '@/components/settings/BillingPanel'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return <BillingPanel profile={profile ?? null} />
}
