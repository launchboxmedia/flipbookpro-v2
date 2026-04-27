import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfilePanel } from '@/components/settings/ProfilePanel'

export const metadata = { title: 'Profile — FlipBookPro' }

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return <ProfilePanel user={{ id: user.id, email: user.email ?? '' }} profile={profile ?? null} />
}
