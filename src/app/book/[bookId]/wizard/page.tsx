import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WizardShell } from '@/components/wizard/WizardShell'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { getEffectivePlan } from '@/lib/auth'

export default async function WizardPage({
  params,
  searchParams,
}: {
  params: { bookId: string }
  searchParams: { step?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: book }, { data: pages }, planInfo] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('book_pages').select('chapter_index, chapter_title, chapter_brief')
      .eq('book_id', params.bookId).order('chapter_index', { ascending: true }),
    getEffectivePlan(supabase, user.id),
  ])

  if (!book) redirect('/dashboard')

  // Cap unlimited (admin) at a sensible number of detection slots — Step1Outline's
  // chapter detector still has UI rows per chapter and shouldn't render hundreds.
  const maxChapters = Number.isFinite(planInfo.maxChapters) ? planInfo.maxChapters : 50

  const existingChapters = (pages ?? []).map((p) => ({
    title: p.chapter_title ?? '',
    brief: p.chapter_brief ?? '',
  }))

  const isPremium = planInfo.plan !== 'free'

  const parsedStep = searchParams.step ? Number.parseInt(searchParams.step, 10) : NaN
  const initialStep = Number.isFinite(parsedStep) ? parsedStep : 0

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <AppSidebar userEmail={user.email ?? ''} isPremium={isPremium} isAdmin={planInfo.isAdmin} />
      <main className="flex-1 overflow-auto">
        <WizardShell
          bookId={params.bookId}
          maxChapters={maxChapters}
          initialStep={initialStep}
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
