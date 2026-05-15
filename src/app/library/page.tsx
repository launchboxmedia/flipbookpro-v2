import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { LibraryShell } from '@/components/library/LibraryShell'
import { getEffectivePlan } from '@/lib/auth'
import type { BookWithMeta } from '@/components/library/types'
import type { BookStatus } from '@/types/database'

interface BookJoinRow {
  id: string
  title: string
  subtitle: string | null
  author_name: string | null
  status: BookStatus
  cover_image_url: string | null
  palette: string | null
  visual_style: string | null
  created_at: string
  updated_at: string
  published_books: Array<{ slug: string | null; is_active: boolean | null }>
  book_pages: Array<{ id: string; chapter_index: number; approved: boolean }>
}

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // One fan-out: books with their published/pages joins, plus a lead
  // count fetch that's narrow enough (one row per lead) to roll up in
  // memory. Both queries are RLS-scoped to the current user.
  const [{ data: rawBooks }, { data: leadRows }, planInfo] = await Promise.all([
    supabase
      .from('books')
      .select(`
        id, title, subtitle, author_name,
        status, cover_image_url, palette,
        visual_style, created_at, updated_at,
        published_books (slug, is_active),
        book_pages (id, chapter_index, approved)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('leads')
      .select('book_id')
      .eq('user_id', user.id),
    getEffectivePlan(supabase, user.id),
  ])

  const leadCountByBook: Record<string, number> = {}
  for (const row of leadRows ?? []) {
    leadCountByBook[row.book_id] = (leadCountByBook[row.book_id] ?? 0) + 1
  }

  const books: BookWithMeta[] = (rawBooks ?? []).map((b) => {
    const row = b as unknown as BookJoinRow
    // Chapters live in book_pages with chapter_index >= 0; negative
    // indices are reserved for back-matter (upsell / affiliate / etc).
    const chapterPages = (row.book_pages ?? []).filter((p) => p.chapter_index >= 0)
    const approvedCount = chapterPages.filter((p) => p.approved).length
    const published = (row.published_books ?? [])[0]
    return {
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      author_name: row.author_name,
      status: row.status,
      cover_image_url: row.cover_image_url,
      palette: row.palette,
      visual_style: row.visual_style,
      created_at: row.created_at,
      updated_at: row.updated_at,
      chapterCount: chapterPages.length,
      approvedCount,
      isPublished: !!published?.is_active,
      slug: published?.slug ?? null,
      leadCount: leadCountByBook[row.id] ?? 0,
    }
  })

  // Bucket into the three shelves. Order matters because a book can
  // satisfy multiple conditions; published wins, then ready, then
  // anything else falls into in-progress.
  const published: BookWithMeta[] = []
  const ready: BookWithMeta[] = []
  const inProgress: BookWithMeta[] = []
  for (const b of books) {
    if (b.isPublished) {
      published.push(b)
    } else if (
      b.status === 'ready' ||
      b.status === 'published' ||
      (b.chapterCount > 0 && b.approvedCount === b.chapterCount)
    ) {
      ready.push(b)
    } else {
      inProgress.push(b)
    }
  }

  const isPremium = planInfo.plan !== 'free'

  return (
    <AppShell userEmail={user.email ?? ''} isPremium={isPremium} isAdmin={planInfo.isAdmin}>
      <LibraryShell published={published} ready={ready} inProgress={inProgress} />
    </AppShell>
  )
}
