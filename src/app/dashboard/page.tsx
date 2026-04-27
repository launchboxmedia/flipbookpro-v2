import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { BookCard } from '@/components/dashboard/BookCard'
import { NewBookButton } from '@/components/dashboard/NewBookButton'
import { BookOpen } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: books }, { data: profile }] = await Promise.all([
    supabase.from('books').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    supabase.from('profiles').select('plan').eq('id', user.id).single(),
  ])

  const bookIds = (books ?? []).map((b) => b.id)

  const { data: pageCounts } = bookIds.length
    ? await supabase.from('book_pages').select('book_id').in('book_id', bookIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const row of pageCounts ?? []) {
    countMap[row.book_id] = (countMap[row.book_id] ?? 0) + 1
  }

  const isPremium = (profile?.plan ?? 'free') !== 'free'

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <AppSidebar userEmail={user.email ?? ''} isPremium={isPremium} />

      <main className="flex-1 overflow-auto px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-playfair text-3xl text-cream">Your Books</h2>
              <p className="text-muted-foreground text-sm font-source-serif mt-1">
                {books?.length ?? 0} book{books?.length !== 1 ? 's' : ''}
              </p>
            </div>
            <NewBookButton />
          </div>

          {!books || books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <BookOpen className="w-12 h-12 text-[#333] mb-4" />
              <h3 className="font-playfair text-xl text-cream/60 mb-2">No books yet</h3>
              <p className="text-muted-foreground text-sm font-source-serif mb-6 max-w-sm">
                Create your first book and let AI build it with you — from outline to illustrated flipbook.
              </p>
              <NewBookButton />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {books.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  chapterCount={countMap[book.id] ?? 0}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
