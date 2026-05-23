import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getEffectivePlan } from '@/lib/auth'
import { MediaShell } from '@/components/media/MediaShell'
import type { MediaImage, BookStub, ChapterStub } from '@/components/media/MediaShell'

export const metadata = { title: 'Media — FlipBookPro' }

type PathType = 'covers' | 'chapters' | 'back-covers'
const PATH_TYPES: PathType[] = ['covers', 'chapters', 'back-covers']

export default async function MediaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rawBooks }, planInfo] = await Promise.all([
    supabase
      .from('books')
      .select('id, title, cover_image_url, back_cover_image_url')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    getEffectivePlan(supabase, user.id),
  ])

  const books = rawBooks ?? []
  const bookIds = books.map((b) => b.id)

  const [{ data: rawPages }] = await Promise.all([
    supabase
      .from('book_pages')
      .select('book_id, chapter_index, chapter_title, image_url')
      .in('book_id', bookIds.length > 0 ? bookIds : ['_'])
      .gte('chapter_index', 0),
  ])

  const pages = rawPages ?? []

  // Build set of in-use URLs for quick lookup
  const inUseUrls = new Set<string>()
  for (const b of books) {
    if (b.cover_image_url) inUseUrls.add(b.cover_image_url)
    if (b.back_cover_image_url) inUseUrls.add(b.back_cover_image_url)
  }
  for (const p of pages) {
    if (p.image_url) inUseUrls.add(p.image_url)
  }

  // List storage objects for each book × path type in parallel
  const listings = await Promise.all(
    books.flatMap((book) =>
      PATH_TYPES.map(async (pathType) => {
        const prefix = `${pathType}/${book.id}`
        const { data: objects } = await supabaseAdmin
          .storage
          .from('book-images')
          .list(prefix, { limit: 200 })

        return (objects ?? [])
          .filter((obj) => obj.name && obj.name !== '.emptyFolderPlaceholder')
          .map((obj): MediaImage => {
            const storageKey = `${prefix}/${obj.name}`
            const publicUrl = supabaseAdmin.storage
              .from('book-images')
              .getPublicUrl(storageKey).data.publicUrl
            return {
              storageKey,
              publicUrl,
              bookId: book.id,
              bookTitle: book.title,
              type:
                pathType === 'covers'
                  ? 'cover'
                  : pathType === 'back-covers'
                    ? 'back-cover'
                    : 'chapter',
              inUse: inUseUrls.has(publicUrl),
              createdAt: obj.created_at ?? '',
              sizeBytes: (obj.metadata as { size?: number } | null)?.size ?? 0,
            }
          })
      }),
    ),
  )

  const images = listings
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const bookStubs: BookStub[] = books.map((b) => ({ id: b.id, title: b.title }))

  const chaptersByBook: Record<string, ChapterStub[]> = {}
  for (const p of pages) {
    if (!chaptersByBook[p.book_id]) chaptersByBook[p.book_id] = []
    chaptersByBook[p.book_id].push({
      chapter_index: p.chapter_index,
      chapter_title: p.chapter_title ?? `Chapter ${p.chapter_index + 1}`,
    })
  }
  for (const arr of Object.values(chaptersByBook)) {
    arr.sort((a, b) => a.chapter_index - b.chapter_index)
  }

  return (
    <AppShell
      userEmail={user.email ?? ''}
      isPremium={planInfo.plan !== 'free'}
      isAdmin={planInfo.isAdmin}
    >
      <MediaShell
        images={images}
        books={bookStubs}
        chaptersByBook={chaptersByBook}
      />
    </AppShell>
  )
}
