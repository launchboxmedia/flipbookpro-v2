import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { deriveTheme } from '@/lib/bookTheme'
import { FlipbookViewer } from '@/components/preview/FlipbookViewer'
import { EmailGate } from '@/components/read/EmailGate'
import { BuyGate } from '@/components/read/BuyGate'
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
  searchParams: { session_id?: string; error?: string }
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

export default async function ReadPage({ params, searchParams }: Props) {
  // If Stripe just redirected here with a session_id, hop to the grant route
  // which verifies the session, records the lead, and sets the access cookie
  // before redirecting back to a clean /read/{slug}. Server components can't
  // set cookies during render, so the route handler is the only place
  // that can do all three.
  if (searchParams.session_id) {
    redirect(`/api/read/${params.slug}/grant?session_id=${encodeURIComponent(searchParams.session_id)}`)
  }

  const supabase = await createClient()

  // Explicit column list — select('*') was silently returning null even
  // though all rows + RLS + column grants check out. The matching column
  // list in generateMetadata works, so we mirror that pattern: only ask
  // for the columns the route actually uses.
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
  const structuredData = (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- structured data must serialize as <script>
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )

  // Resolve the effective access type. New rows have access_type set
  // explicitly; old rows fall back through gate_type.
  const accessType = (pub.access_type as 'free' | 'email' | 'paid' | undefined)
    ?? (pub.gate_type === 'none'    ? 'free' :
        pub.gate_type === 'payment' ? 'paid' : 'email')

  // Build the floating resources panel once. Renders nothing internally
  // when the book has no resources, so it's safe to drop into every
  // post-gate path unconditionally.
  const resourcesPanel = (
    <BookResourcesPanel
      slug={params.slug}
      resources={bookResources}
      chapterTitles={chapterTitles}
    />
  )

  // FlipbookViewer alone — the panel used to be folded into this fragment,
  // but that nested it inside EmailGate's `children`, which only renders
  // after the visitor submits an email AND only ever lives under EmailGate's
  // render path. Lifting the panel out lets it render as a top-level
  // sibling for both email-gated and free paths, so a returning visitor
  // who lands back on the gate form still sees the resources affordance.
  const viewer = (
    <FlipbookViewer
      book={book as Book}
      chapters={chapters as BookPage[]}
      backMatter={backMatter as BookPage[]}
      theme={theme}
      profile={(authorProfile as Profile) ?? null}
      isPublicView
    />
  )

  // Paid books: show the buy gate unless the visitor has a valid signed
  // access cookie keyed to this slug. The panel is intentionally NOT
  // rendered for the unpaid view — if the visitor hasn't bought, they
  // shouldn't see the download links either.
  if (accessType === 'paid') {
    const cookieJar = await cookies()
    const token = cookieJar.get(cookieNameForSlug(params.slug))?.value
    const claims = verifyAccessToken(token, params.slug)
    if (!claims) {
      return (
        <>
          {structuredData}
          <BuyGate
            bookId={pub.book_id}
            title={pub.title}
            author={pub.author}
            subtitle={pub.subtitle}
            description={pub.description}
            coverImageUrl={pub.cover_image_url}
            priceCents={pub.price_cents ?? 0}
            errorCode={searchParams.error ?? null}
          />
        </>
      )
    }
    // Valid cookie → flipbook + resources panel.
    return <>{structuredData}{viewer}{resourcesPanel}</>
  }

  // Email-gated: collect an email before reading. The panel sits OUTSIDE
  // EmailGate so it stays mounted regardless of submit state — the
  // resource download URLs are public anyway (anyone with slug + id can
  // hit /read/[slug]/r/[id]), so there's no soft-gate purpose served by
  // hiding the panel pre-submit.
  if (accessType === 'email') {
    return (
      <>
        {structuredData}
        <EmailGate
          publishedBookId={pub.id}
          book={book as Book}
          coverImageUrl={pub.cover_image_url}
          title={pub.title}
          author={pub.author}
          description={pub.description}
        >
          {viewer}
        </EmailGate>
        {resourcesPanel}
      </>
    )
  }

  // Free — open access. Panel rendered as a top-level sibling of the
  // viewer so its `position: fixed` lives at the page root with no
  // wrapper that might trap stacking or be hidden by a parent
  // condition.
  return <>{structuredData}{viewer}{resourcesPanel}</>
}
