import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { deriveTheme } from '@/lib/bookTheme'
import { FlipbookViewer } from '@/components/preview/FlipbookViewer'
import { BookResourcesPanel } from '@/components/read/BookResourcesPanel'
import { cookieNameForSlug, verifyAccessToken } from '@/lib/readAccess'
import type { Book, BookPage, BookResource, Profile } from '@/types/database'

// Always render this page per-request. The published flipbook + resources
// panel hydrate from a database read; static rendering would freeze the
// resources list at build time, so adding / editing a resource wouldn't
// surface until the next deploy. Forcing dynamic makes every visit a
// fresh read.
export const dynamic = 'force-dynamic'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: pub } = await supabase
    .from('published_books')
    .select('title, author, subtitle, description, cover_image_url, slug')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!pub) return { title: 'Book Not Found' }

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/read/${pub.slug}`
  const description = pub.description || pub.subtitle || `Read ${pub.title} by ${pub.author || 'the author'}.`

  return {
    title: pub.title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title: pub.title,
      description,
      url,
      type: 'book',
      images: pub.cover_image_url
        ? [{ url: pub.cover_image_url, width: 768, height: 1024, alt: pub.title }]
        : [],
    },
    twitter: {
      card: pub.cover_image_url ? 'summary_large_image' : 'summary',
      title: pub.title,
      description,
      images: pub.cover_image_url ? [pub.cover_image_url] : [],
    },
    alternates: { canonical: url },
  }
}

export default async function ReadPage({ params }: Props) {
  const supabase = await createClient()

  // Explicit column list for type safety —
  // select('*') works but explicit columns
  // keep TypeScript inference clean
  const { data: pub } = await supabase
    .from('published_books')
    .select(`
      id, slug, book_id, user_id, title, subtitle,
      author, description, cover_image_url,
      access_type, gate_type, price_cents,
      is_active, published_at, created_at,
      updated_at
    `)
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!pub) notFound()

  // Resolve the effective access type. New rows have access_type set
  // explicitly; old rows fall back through gate_type.
  const accessType = (pub.access_type as 'free' | 'email' | 'paid' | undefined)
    ?? (pub.gate_type === 'none'    ? 'free' :
        pub.gate_type === 'payment' ? 'paid' : 'email')

  // /read is now a pure cookie check — all gating UI (email form, checkout)
  // lives on /go/[slug], the single gate. Free books are open; email/paid
  // require a valid signed access cookie (set by /api/read/[slug]/grant or
  // grant-email). No valid cookie → bounce to the landing page.
  if (accessType !== 'free') {
    const cookieJar = await cookies()
    const token = cookieJar.get(cookieNameForSlug(params.slug))?.value
    if (!verifyAccessToken(token, params.slug)) {
      redirect(`/go/${params.slug}`)
    }
  }

  const [{ data: book }, { data: allPages }, { data: authorProfile }, { data: resources }] = await Promise.all([
    supabase.from('books').select('*').eq('id', pub.book_id).single(),
    supabase.from('book_pages').select('*').eq('book_id', pub.book_id).order('chapter_index'),
    supabase.from('profiles').select('*').eq('id', pub.user_id).single(),
    supabase.from('book_resources').select('*').eq('book_id', pub.book_id).order('chapter_index'),
  ])

  if (!book) notFound()

  const chapters   = (allPages ?? []).filter((p: BookPage) => p.chapter_index >= 0)
  const backMatter = (allPages ?? []).filter((p: BookPage) => p.chapter_index < 0)
  const theme      = deriveTheme(book as Book, (authorProfile as Profile) ?? null)

  // Chapter titles for the resources panel — labels each chapter's resource
  // group with the real chapter name instead of a bare index.
  const chapterTitles = chapters.map((c: BookPage) => ({
    chapter_index: c.chapter_index,
    chapter_title: c.chapter_title,
  }))
  const bookResources = (resources ?? []) as BookResource[]

  // JSON-LD Book structured data — helps Google Book Search and rich
  // social-card renderers identify the page as a book.
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/read/${pub.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: pub.title,
    ...(pub.author ? { author: { '@type': 'Person', name: pub.author } } : {}),
    ...(pub.description ? { description: pub.description } : {}),
    ...(pub.cover_image_url ? { image: pub.cover_image_url } : {}),
    url,
    inLanguage: 'en',
  }
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- structured data must serialize as <script>
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FlipbookViewer
        book={book as Book}
        chapters={chapters as BookPage[]}
        backMatter={backMatter as BookPage[]}
        theme={theme}
        profile={(authorProfile as Profile) ?? null}
        isPublicView
      />
      <BookResourcesPanel
        slug={params.slug}
        resources={bookResources}
        chapterTitles={chapterTitles}
      />
    </>
  )
}
