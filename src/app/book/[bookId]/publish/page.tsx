import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PublishPanel } from '@/components/publish/PublishPanel'
import { AppShell } from '@/components/layout/AppShell'
import { getEffectivePlan } from '@/lib/auth'

export default async function PublishPage({ params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: book }, { data: published }, planInfo] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('published_books').select('*').eq('book_id', params.bookId).maybeSingle(),
    getEffectivePlan(supabase, user.id),
  ])

  if (!book) redirect('/dashboard')

  return (
    <AppShell
      userEmail={user.email ?? ''}
      isPremium={planInfo.plan !== 'free'}
      isAdmin={planInfo.isAdmin}
      pageTitle={`Publish · ${book.title}`}
    >
      <PublishPanel book={book} publishedBook={published ?? null} />
    </AppShell>
  )
}
