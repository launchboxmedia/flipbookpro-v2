import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { NewBookButton } from '@/components/dashboard/NewBookButton'
import { BookOpen } from 'lucide-react'
import { getEffectivePlan } from '@/lib/auth'

/** Greeting tier driven by the user's local hour-of-day. Server-rendered, so
 *  it reflects the server's clock. Good enough for the first paint — the
 *  product isn't sensitive to a ±1h drift at timezone boundaries. */
function greeting(date: Date): string {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function firstName(email: string, fallback?: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim().split(/\s+/)[0]
  const local = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ').trim()
  return local.split(/\s+/)[0] || 'there'
}

function todayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // All data the dashboard needs in one round trip. Counts are derived
  // client-side over small, RLS-gated result sets — no aggregate query needed.
  const [
    { data: books },
    { data: pageRows },
    { data: publishedRows },
    { data: leadRows },
    { data: recentLeads },
    { data: profile },
    planInfo,
  ] = await Promise.all([
    supabase.from('books')
      .select('id, title, status, updated_at, cover_image_url')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase.from('book_pages')
      .select('book_id, approved')
      .gte('chapter_index', 0),
    supabase.from('published_books')
      .select('book_id, is_active, slug')
      .eq('user_id', user.id),
    supabase.from('leads')
      .select('book_id')
      .eq('user_id', user.id),
    supabase.from('leads')
      .select('email, name, created_at, books!inner(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle(),
    getEffectivePlan(supabase, user.id),
  ])

  // Per-book chapter rollup: total + approved counts.
  const chapterStats: Record<string, { total: number; approved: number }> = {}
  for (const row of pageRows ?? []) {
    const s = chapterStats[row.book_id] ?? { total: 0, approved: 0 }
    s.total += 1
    if (row.approved) s.approved += 1
    chapterStats[row.book_id] = s
  }

  // Per-book published state — keyed by book_id. Only one row per book exists
  // (unique index), so the map directly maps to the row.
  const publishedByBook: Record<string, { is_active: boolean; slug: string }> = {}
  for (const row of publishedRows ?? []) {
    publishedByBook[row.book_id] = { is_active: !!row.is_active, slug: row.slug }
  }

  // Per-book lead count.
  const leadsByBook: Record<string, number> = {}
  for (const row of leadRows ?? []) {
    leadsByBook[row.book_id] = (leadsByBook[row.book_id] ?? 0) + 1
  }

  const now = new Date()
  const greetingLine = `${greeting(now)}, ${firstName(user.email ?? '', (profile as { full_name?: string } | null)?.full_name)}`
  const isPremium = planInfo.plan !== 'free'

  const hasBooks = (books?.length ?? 0) > 0

  return (
    <AppShell
      userEmail={user.email ?? ''}
      isPremium={isPremium}
      isAdmin={planInfo.isAdmin}
      mainBackground="bg-cream-1 dark:bg-canvas"
    >
      <div className="max-w-6xl mx-auto px-6 py-10 min-h-[calc(100vh-0px)]">
        {!hasBooks ? (
          // Empty state — first-run command center. Centered card, single CTA.
          <div className="flex flex-col items-center justify-center text-center py-32">
            <BookOpen className="w-12 h-12 text-gold mb-6" />
            <h1 className="font-playfair text-2xl text-ink-1 dark:text-white mb-3">
              Your first book is one click away
            </h1>
            <p className="text-ink-1/50 dark:text-white/50 font-source-serif mb-8 max-w-md">
              Create a book in minutes with AI assistance.
            </p>
            <NewBookButton />
          </div>
        ) : (
          <>
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
              <div>
                <h1 className="font-playfair text-3xl text-ink-1 dark:text-white leading-tight">
                  {greetingLine}
                </h1>
                <p className="text-ink-1/40 dark:text-white/40 text-sm font-source-serif mt-1">
                  {todayLabel(now)}
                </p>
              </div>
              <div className="shrink-0">
                <NewBookButton />
              </div>
            </header>

            <DashboardGrid
              books={books ?? []}
              chapterStats={chapterStats}
              publishedByBook={publishedByBook}
              leadsByBook={leadsByBook}
              recentLeads={(recentLeads ?? []).map((l) => ({
                email: l.email as string,
                name: (l.name as string | null) ?? null,
                created_at: l.created_at as string,
                book_title: Array.isArray(l.books)
                  ? ((l.books[0] as { title?: string } | undefined)?.title ?? '')
                  : ((l.books as { title?: string } | null)?.title ?? ''),
              }))}
            />
          </>
        )}
      </div>
    </AppShell>
  )
}
