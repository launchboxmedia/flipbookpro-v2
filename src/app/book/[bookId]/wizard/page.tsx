import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WizardShell } from '@/components/wizard/WizardShell'
import { AppShell } from '@/components/layout/AppShell'
import { getEffectivePlan } from '@/lib/auth'

export default async function WizardPage({
  params,
  searchParams,
}: {
  params: { bookId: string }
  searchParams: { step?: string; mode?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: book }, { data: pages }, { data: profile }, planInfo] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('book_pages').select('chapter_index, chapter_title, chapter_brief')
      .eq('book_id', params.bookId).order('chapter_index', { ascending: true }),
    // Profile is read for sensible defaults on new books — currently just
    // website_url. Maybe-single because not every user has a profile row
    // (auth-only sign-ups before any /api/profile interaction).
    supabase.from('profiles')
      .select('website_url, audience_description')
      .eq('id', user.id)
      .maybeSingle<{ website_url: string | null; audience_description: string | null }>(),
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

  // Wizard entry mode. 'scratch' is the AI-suggest flow (the user types a
  // topic description, Claude proposes chapters); anything else = the
  // legacy paste-an-outline flow. Editing an existing book has no `?mode=`
  // and always renders as the upload/outline UI.
  const mode: 'scratch' | 'upload' = searchParams.mode === 'scratch' ? 'scratch' : 'upload'
  // eslint-disable-next-line no-console
  console.log('[wizard page] searchParams.mode:', searchParams.mode, '→ resolved mode:', mode)

  // Radar tier as the panel sees it. Admin collapses to Pro for gating.
  const radarPlan: 'free' | 'standard' | 'pro' =
    planInfo.plan === 'admin' ? 'pro' : planInfo.plan

  return (
    <AppShell userEmail={user.email ?? ''} isPremium={isPremium} isAdmin={planInfo.isAdmin}>
      <WizardShell
        bookId={params.bookId}
        maxChapters={maxChapters}
        initialStep={initialStep}
        mode={mode}
        initialRadar={{
          ranAt:     book.creator_radar_ran_at,
          data:      book.creator_radar_data,
          appliedAt: book.radar_applied_at ?? null,
        }}
        radarPlan={radarPlan}
        initialData={{
          title: book.title ?? '',
          subtitle: book.subtitle ?? '',
          authorName: book.author_name ?? '',
          persona: book.persona ?? '',
          // Brand-profile fallbacks — used only when the book's own value
          // is empty, so users who deliberately cleared a field for a
          // specific book don't see it silently re-populate from settings.
          targetAudience: book.target_audience ?? profile?.audience_description ?? '',
          websiteUrl:     book.website_url     ?? profile?.website_url         ?? '',
          genre: book.genre ?? '',
          offerType: book.offer_type ?? '',
          ctaIntent: book.cta_intent ?? '',
          testimonials: book.testimonials ?? '',
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
    </AppShell>
  )
}
