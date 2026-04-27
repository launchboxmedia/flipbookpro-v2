import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/layout/AppSidebar'

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
  const isPremium = (profile?.plan ?? 'free') !== 'free'

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <AppSidebar userEmail={user.email ?? ''} isPremium={isPremium} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
