import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FlipbookViewer } from '@/components/preview/FlipbookViewer'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { deriveTheme } from '@/lib/bookTheme'
import { getEffectivePlan } from '@/lib/auth'

export default async function PreviewPage({ params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: book }, { data: profile }, { data: allPages }, planInfo] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('book_pages').select('*').eq('book_id', params.bookId).order('chapter_index', { ascending: true }),
    getEffectivePlan(supabase, user.id),
  ])

  if (!book) redirect('/dashboard')

  const chapters   = (allPages ?? []).filter((p) => p.chapter_index >= 0)
  const backMatter = (allPages ?? []).filter((p) => p.chapter_index < 0)
  const theme      = deriveTheme(book, profile ?? null)
  const isPremium  = planInfo.plan !== 'free'

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <AppSidebar userEmail={user.email ?? ''} isPremium={isPremium} isAdmin={planInfo.isAdmin} />
      <main className="flex-1 overflow-auto">
        <FlipbookViewer
          book={book}
          chapters={chapters}
          backMatter={backMatter}
          theme={theme}
          profile={profile ?? null}
        />
      </main>
    </div>
  )
}
