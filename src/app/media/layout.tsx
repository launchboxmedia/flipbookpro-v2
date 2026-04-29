import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { getEffectivePlan } from '@/lib/auth'

export default async function MediaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { plan, isAdmin } = await getEffectivePlan(supabase, user.id)

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <AppSidebar userEmail={user.email ?? ''} isPremium={plan !== 'free'} isAdmin={isAdmin} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
