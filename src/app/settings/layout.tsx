import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { getEffectivePlan } from '@/lib/auth'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { plan, isAdmin } = await getEffectivePlan(supabase, user.id)

  return (
    <AppShell
      userEmail={user.email ?? ''}
      isPremium={plan !== 'free'}
      isAdmin={isAdmin}
      mainBackground="bg-cream-1"
    >
      {children}
    </AppShell>
  )
}
