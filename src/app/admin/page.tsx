import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, BookOpen, Globe, Mail, Crown } from 'lucide-react'

export const metadata = { title: 'Admin Dashboard — FlipBookPro' }

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check admin role
  const { data: role } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (!role) redirect('/dashboard')

  // Fetch aggregate stats
  const [
    { count: totalUsers },
    { count: totalBooks },
    { count: totalPublished },
    { count: totalLeads },
    { data: recentUsers },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('published_books').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('id, email, plan, books_created_this_month, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // Get book counts per user for the recent users list
  const userIds = (recentUsers ?? []).map(u => u.id)
  const { data: bookRows } = userIds.length
    ? await supabase.from('books').select('user_id').in('user_id', userIds)
    : { data: [] }

  const bookCountMap: Record<string, number> = {}
  for (const row of bookRows ?? []) {
    bookCountMap[row.user_id] = (bookCountMap[row.user_id] ?? 0) + 1
  }

  const stats = [
    { label: 'Total Users', value: totalUsers ?? 0, icon: <Users className="w-5 h-5" />, color: 'text-blue-400' },
    { label: 'Total Books', value: totalBooks ?? 0, icon: <BookOpen className="w-5 h-5" />, color: 'text-accent' },
    { label: 'Published', value: totalPublished ?? 0, icon: <Globe className="w-5 h-5" />, color: 'text-gold' },
    { label: 'Leads', value: totalLeads ?? 0, icon: <Mail className="w-5 h-5" />, color: 'text-purple-400' },
  ]

  const planColor: Record<string, string> = {
    free:     'text-muted-foreground bg-[#2A2A2A]',
    standard: 'text-blue-400 bg-blue-400/10',
    pro:      'text-gold bg-gold/10',
  }

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-playfair text-3xl text-cream">Admin Dashboard</h2>
        <p className="text-muted-foreground text-sm font-source-serif mt-1">Platform overview</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[#222] border border-[#333] rounded-xl px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={stat.color}>{stat.icon}</span>
              <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            </div>
            <p className="text-3xl font-playfair text-cream">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent users table */}
      <div className="mb-6">
        <h3 className="font-playfair text-xl text-cream mb-4">Recent Users</h3>
      </div>

      {!recentUsers || recentUsers.length === 0 ? (
        <div className="flex flex-col items-center py-32 text-center">
          <Users className="w-10 h-10 text-[#333] mb-4" />
          <p className="text-muted-foreground font-source-serif text-sm">No users found.</p>
        </div>
      ) : (
        <div className="bg-[#222] border border-[#333] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#333]">
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Plan</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Books</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
                <th className="text-left px-5 py-3 text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((p, i) => (
                <tr key={p.id} className={`border-b border-[#2A2A2A] ${i === recentUsers.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-5 py-3 text-sm font-inter text-cream truncate max-w-[220px]">
                    {p.email ?? <span className="text-muted-foreground italic">No email</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-inter font-medium px-2 py-0.5 rounded-full capitalize ${planColor[p.plan ?? 'free'] ?? planColor.free}`}>
                      {p.plan === 'pro' && <Crown className="w-2.5 h-2.5" />}
                      {p.plan ?? 'free'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm font-inter text-cream">
                    {bookCountMap[p.id] ?? 0}
                  </td>
                  <td className="px-5 py-3 text-xs font-inter text-muted-foreground">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
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
