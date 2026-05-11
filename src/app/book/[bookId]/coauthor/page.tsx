import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoauthorShell, type CoauthorStage } from '@/components/coauthor/CoauthorShell'
import { getEffectivePlan } from '@/lib/auth'

const VALID_STAGES: CoauthorStage[] = ['outline', 'radar', 'chapter', 'back-matter', 'complete']

export default async function CoauthorPage({
  params,
  searchParams,
}: {
  params: { bookId: string }
  searchParams: { stage?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: book }, { data: pages }, { data: resources }, planInfo] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('book_pages').select('*').eq('book_id', params.bookId).order('chapter_index', { ascending: true }),
    supabase.from('book_resources').select('*').eq('book_id', params.bookId).order('chapter_index', { ascending: true }),
    getEffectivePlan(supabase, user.id),
  ])

  if (!book) redirect('/dashboard')

  // Default-stage resolution. The URL takes precedence — a user navigating
  // directly to /coauthor?stage=outline gets the outline regardless of
  // radar state. Without a URL stage, first-time entries (radar never
  // applied) land on the Creator Radar stage so the user can review the
  // market intelligence before writing; subsequent entries land on the
  // Outline stage as the default writing surface. Replaces the old
  // RadarInterstitial gating wrapper — one surface, one experience.
  const urlStage = VALID_STAGES.includes(searchParams.stage as CoauthorStage)
    ? (searchParams.stage as CoauthorStage)
    : null
  const initialStage: CoauthorStage =
    urlStage ?? (book.radar_applied_at ? 'outline' : 'radar')

  return (
    <CoauthorShell
      book={book}
      pages={pages ?? []}
      initialResources={resources ?? []}
      userEmail={user.email ?? ''}
      isPremium={planInfo.plan !== 'free'}
      isAdmin={planInfo.isAdmin}
      // Creator Radar gates content by plan. Admins see everything,
      // collapsing to the 'pro' tier from the panel's perspective.
      radarPlan={planInfo.plan === 'admin' ? 'pro' : planInfo.plan}
      initialStage={initialStage}
    />
  )
}
