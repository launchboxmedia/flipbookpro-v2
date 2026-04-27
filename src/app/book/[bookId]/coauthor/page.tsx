import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoauthorShell } from '@/components/coauthor/CoauthorShell'

export default async function CoauthorPage({ params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: book }, { data: profile }, { data: pages }] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('profiles').select('plan').eq('id', user.id).single(),
    supabase.from('book_pages').select('*').eq('book_id', params.bookId).order('chapter_index', { ascending: true }),
  ])

  if (!book) redirect('/dashboard')

  return (
    <CoauthorShell
      book={book}
      pages={pages ?? []}
      userEmail={user.email ?? ''}
      isPremium={(profile?.plan ?? 'free') !== 'free'}
    />
  )
}
