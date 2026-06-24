import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FlipbookViewer } from '@/components/preview/FlipbookViewer'
import { BookResourcesPanel } from '@/components/read/BookResourcesPanel'
import { AppShell } from '@/components/layout/AppShell'
import { deriveTheme } from '@/lib/bookTheme'
import { getEffectivePlan } from '@/lib/auth'
import type { BookResource } from '@/types/database'

export default async function PreviewPage({ params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: book }, { data: profile }, { data: allPages }, { data: resources }, planInfo] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('book_pages').select('*').eq('book_id', params.bookId).order('chapter_index', { ascending: true }),
    supabase.from('book_resources').select('*').eq('book_id', params.bookId).order('chapter_index', { ascending: true }),
    getEffectivePlan(supabase, user.id),
  ])

  if (!book) redirect('/dashboard')

  const chapters   = (allPages ?? []).filter((p) => p.chapter_index >= 0)
  const backMatter = (allPages ?? []).filter((p) => p.chapter_index < 0)
  const theme      = deriveTheme(book, profile ?? null)
  const isPremium  = planInfo.plan !== 'free'

  // Resources surfaced via the same panel the public reader uses, but linked
  // through the ownership-gated /book/[bookId]/r/[id] route so they open in
  // preview before the book is published.
  const bookResources = (resources ?? []) as BookResource[]
  const chapterTitles = chapters.map((c) => ({
    chapter_index: c.chapter_index,
    chapter_title: c.chapter_title,
  }))

  return (
    <AppShell
      userEmail={user.email ?? ''}
      isPremium={isPremium}
      isAdmin={planInfo.isAdmin}
      pageTitle={`Preview · ${book.title}`}
    >
      <FlipbookViewer
        book={book}
        chapters={chapters}
        backMatter={backMatter}
        theme={theme}
        profile={profile ?? null}
        resources={bookResources}
        resourceHrefBase={`/book/${book.id}/r/`}
      />
      <BookResourcesPanel
        slug=""
        resources={bookResources}
        chapterTitles={chapterTitles}
        buildHref={(id) => `/book/${book.id}/r/${id}`}
      />
    </AppShell>
  )
}
