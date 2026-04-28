import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { NewBookButton } from '@/components/dashboard/NewBookButton'
import { BookOpen, Sparkles } from 'lucide-react'
import { PLAN_LIMITS } from '@/lib/stripe'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: books }, { data: profile }] = await Promise.all([
    supabase.from('books')
      .select('id, user_id, title, subtitle, status, cover_image_url, slug, persona, created_at, updated_at, published_at, palette, visual_style, typography, cover_direction, author_name, vibe, writing_tone, reader_level, human_score, back_cover_tagline, back_cover_description, back_cover_cta_text, back_cover_cta_url, back_cover_image_url')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase.from('profiles').select('plan, books_created_this_month').eq('id', user.id).single(),
  ])

  const bookIds = (books ?? []).map((b) => b.id)

  const { data: pageCounts } = bookIds.length
    ? await supabase.from('book_pages').select('book_id').in('book_id', bookIds).gte('chapter_index', 0)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const row of pageCounts ?? []) {
    countMap[row.book_id] = (countMap[row.book_id] ?? 0) + 1
  }

  const plan = (profile?.plan ?? 'free') as keyof typeof PLAN_LIMITS
  const isPremium = plan !== 'free'
  const monthlyLimit = PLAN_LIMITS[plan]?.booksPerMonth ?? 1
  const monthlyUsed  = profile?.books_created_this_month ?? 0
  const slotsLeft = Math.max(0, monthlyLimit - monthlyUsed)

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <AppSidebar userEmail={user.email ?? ''} isPremium={isPremium} />

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-10">
          {/* Hero / header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 pb-6 border-b border-ink-3">
            <div>
              <p className="text-[10px] font-inter font-semibold text-gold/70 uppercase tracking-[0.2em] mb-2">
                Your Library
              </p>
              <h1 className="font-playfair text-4xl text-cream font-semibold leading-tight">
                {books && books.length > 0
                  ? `${books.length} book${books.length !== 1 ? 's' : ''} in your shelf`
                  : 'Build your first flipbook'}
              </h1>
              <p className="text-ink-subtle text-sm font-source-serif mt-2 max-w-xl">
                Approved drafts, generating illustrations, and finished books — all in one place.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Monthly slot counter */}
              <div className="hidden sm:flex flex-col items-end px-4 py-2.5 rounded-lg bg-ink-2 border border-ink-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-gold" />
                  <span className="font-inter text-[11px] text-ink-subtle uppercase tracking-wider">
                    This month
                  </span>
                </div>
                <p className="font-playfair text-sm text-cream font-semibold mt-0.5">
                  {monthlyUsed} / {monthlyLimit}
                  <span aria-hidden="true" className="text-ink-muted/50 mx-1.5 font-normal">·</span>
                  <span className="font-inter text-[11px] text-ink-muted font-normal">
                    {slotsLeft === 0 ? 'limit reached' : `${slotsLeft} left`}
                  </span>
                </p>
              </div>
              <NewBookButton />
            </div>
          </div>

          {!books || books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center border border-dashed border-ink-3 rounded-2xl bg-ink-2/30">
              <BookOpen className="w-12 h-12 text-ink-muted mb-4" />
              <h3 className="font-playfair text-xl text-cream/80 mb-2">Your shelf is empty</h3>
              <p className="text-ink-subtle text-sm font-source-serif mb-6 max-w-sm">
                Create your first book and let AI build it with you — from outline to illustrated flipbook.
              </p>
              <NewBookButton />
            </div>
          ) : (
            <DashboardGrid books={books} pageCounts={countMap} />
          )}
        </div>
      </main>
    </div>
  )
}
