import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getEffectivePlan } from '@/lib/auth'
import { MediaShell } from '@/components/media/MediaShell'
import type { MediaImage, BookStub, ChapterStub } from '@/components/media/MediaShell'

export const metadata = { title: 'Media — FlipBookPro' }

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

  const bookById = Object.fromEntries(books.map((b) => [b.id, b.title]))

  function makeImage(
    storageKey: string,
    obj: { name: string; created_at?: string | null; metadata?: unknown },
    bookId: string,
    type: MediaImage['type'],
  ): MediaImage | null {
    const bookTitle = bookById[bookId]
    if (!bookTitle) return null
    const publicUrl = supabaseAdmin.storage.from('book-images').getPublicUrl(storageKey).data.publicUrl
    return {
      storageKey,
      publicUrl,
      bookId,
      bookTitle,
      type,
      inUse: inUseUrls.has(publicUrl),
      createdAt: obj.created_at ?? '',
      sizeBytes: (obj.metadata as { size?: number } | null)?.size ?? 0,
    }
  }

  // covers/ and back-covers/ store files flat as "{bookId}-{timestamp}.jpg"
  // chapters/ uses subfolders: "chapters/{bookId}/{pageId}-{timestamp}.jpg"
  const [
    { data: coverObjects },
    { data: backCoverObjects },
    ...chapterListings
  ] = await Promise.all([
    supabaseAdmin.storage.from('book-images').list('covers', { limit: 500 }),
    supabaseAdmin.storage.from('book-images').list('back-covers', { limit: 500 }),
    ...books.map((book) =>
      supabaseAdmin.storage.from('book-images').list(`chapters/${book.id}`, { limit: 200 })
        .then((res) => ({ bookId: book.id, data: res.data })),
    ),
  ])

  const flatImages: MediaImage[] = []

  // Covers — filename: "{bookId}-{timestamp}.jpg"
  // bookId is a full UUID (36 chars with dashes), so we match against known IDs
  for (const obj of coverObjects ?? []) {
    if (!obj.name || obj.name === '.emptyFolderPlaceholder') continue
    const bookId = bookIds.find((id) => obj.name.startsWith(id + '-'))
    if (!bookId) continue
    const img = makeImage(`covers/${obj.name}`, obj, bookId, 'cover')
    if (img) flatImages.push(img)
  }

  // Back-covers — filename: "{bookId}-{timestamp}.jpg"
  for (const obj of backCoverObjects ?? []) {
    if (!obj.name || obj.name === '.emptyFolderPlaceholder') continue
    const bookId = bookIds.find((id) => obj.name.startsWith(id + '-'))
    if (!bookId) continue
    const img = makeImage(`back-covers/${obj.name}`, obj, bookId, 'back-cover')
    if (img) flatImages.push(img)
  }

  // Chapters — subfolder per book: "chapters/{bookId}/{pageId}-{timestamp}.jpg"
  for (const listing of chapterListings) {
    const { bookId, data: objects } = listing as { bookId: string; data: typeof coverObjects }
    for (const obj of objects ?? []) {
      if (!obj.name || obj.name === '.emptyFolderPlaceholder') continue
      const img = makeImage(`chapters/${bookId}/${obj.name}`, obj, bookId, 'chapter')
      if (img) flatImages.push(img)
    }
  }

  const images = flatImages.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

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
