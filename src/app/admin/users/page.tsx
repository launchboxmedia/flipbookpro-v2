import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, Crown } from 'lucide-react'

export const metadata = { title: 'Admin — Users' }

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, plan, books_created_this_month, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)

  const planColor: Record<string, string> = {
    free:     'text-muted-foreground bg-[#2A2A2A]',
    standard: 'text-blue-400 bg-blue-400/10',
    pro:      'text-gold bg-gold/10',
  }

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="font-playfair text-3xl text-cream">Users</h2>
          <p className="text-muted-foreground text-sm font-source-serif mt-1">
            {profiles?.length ?? 0} accounts registered
          </p>
        </div>
      </div>

      {!profiles || profiles.length === 0 ? (
        <div className="flex flex-col items-center py-32 text-center">
          <Users className="w-10 h-10 text-[#333] mb-4" />
          <p className="text-muted-foreground font-source-serif text-sm">No users found.</p>
        </div>
      ) : (
        <div className="bg-[#222] border border-[#333] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#333]">
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">User ID</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Plan</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Books this month</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Last active</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p, i) => (
                <tr key={p.id} className={`border-b border-[#2A2A2A] ${i === profiles.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-5 py-3 text-xs font-inter text-muted-foreground font-mono truncate max-w-[180px]">
                    {p.id}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-inter font-medium px-2 py-0.5 rounded-full capitalize ${planColor[p.plan ?? 'free'] ?? planColor.free}`}>
                      {p.plan === 'pro' && <Crown className="w-2.5 h-2.5" />}
                      {p.plan ?? 'free'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs font-inter text-cream">
                    {p.books_created_this_month ?? 0}
                  </td>
                  <td className="px-5 py-3 text-xs font-inter text-muted-foreground">
                    {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
