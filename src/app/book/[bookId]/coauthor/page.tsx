import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoauthorEntry } from '@/components/coauthor/CoauthorEntry'
import type { CoauthorStage } from '@/components/coauthor/CoauthorShell'
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

  const [{ data: book }, { data: pages }, planInfo] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('book_pages').select('*').eq('book_id', params.bookId).order('chapter_index', { ascending: true }),
    getEffectivePlan(supabase, user.id),
  ])

  if (!book) redirect('/dashboard')

  const initialStage = VALID_STAGES.includes(searchParams.stage as CoauthorStage)
    ? (searchParams.stage as CoauthorStage)
    : 'outline'

  return (
    <CoauthorEntry
      book={book}
      pages={pages ?? []}
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
