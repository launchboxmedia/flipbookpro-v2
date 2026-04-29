import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoauthorShell, type CoauthorStage } from '@/components/coauthor/CoauthorShell'
import { getEffectivePlan } from '@/lib/auth'

const VALID_STAGES: CoauthorStage[] = ['outline', 'chapter', 'back-matter', 'complete']

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
    <CoauthorShell
      book={book}
      pages={pages ?? []}
      userEmail={user.email ?? ''}
      isPremium={planInfo.plan !== 'free'}
      isAdmin={planInfo.isAdmin}
      initialStage={initialStage}
    />
  )
}
