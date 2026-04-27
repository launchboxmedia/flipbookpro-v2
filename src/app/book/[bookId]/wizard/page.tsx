import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WizardShell } from '@/components/wizard/WizardShell'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { PLAN_LIMITS } from '@/lib/stripe'

export default async function WizardPage({ params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: book }, { data: profile }, { data: pages }] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('profiles').select('plan').eq('id', user.id).single(),
    supabase.from('book_pages').select('chapter_index, chapter_title, chapter_brief')
      .eq('book_id', params.bookId).order('chapter_index', { ascending: true }),
  ])

  if (!book) redirect('/dashboard')

  const plan = (profile?.plan ?? 'free') as keyof typeof PLAN_LIMITS
  const maxChapters = PLAN_LIMITS[plan]?.maxChapters ?? 6

  const existingChapters = (pages ?? []).map((p) => ({
    title: p.chapter_title ?? '',
    brief: p.chapter_brief ?? '',
  }))

  const isPremium = (profile?.plan ?? 'free') !== 'free'

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <AppSidebar userEmail={user.email ?? ''} isPremium={isPremium} />
      <main className="flex-1 overflow-auto">
        <WizardShell
          bookId={params.bookId}
          maxChapters={maxChapters}
          initialData={{
            title: book.title ?? '',
            subtitle: book.subtitle ?? '',
            authorName: book.author_name ?? '',
            persona: book.persona ?? '',
            vibe: book.vibe ?? '',
            writingTone: book.writing_tone ?? '',
            readerLevel: book.reader_level ?? 5,
            humanScore: book.human_score ?? false,
            visualStyle: book.visual_style ?? '',
            coverDirection: book.cover_direction ?? '',
            typography: book.typography ?? '',
            chapters: existingChapters,
            outline: existingChapters.length > 0
              ? existingChapters.map((c, i) => `Chapter ${i + 1}: ${c.title}${c.brief ? `\n${c.brief}` : ''}`).join('\n\n')
              : '',
          }}
        />
      </main>
    </div>
  )
}
