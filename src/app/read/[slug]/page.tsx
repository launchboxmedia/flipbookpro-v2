import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deriveTheme } from '@/lib/bookTheme'
import { FlipbookViewer } from '@/components/preview/FlipbookViewer'
import { EmailGate } from '@/components/read/EmailGate'
import type { Book, BookPage, Profile } from '@/types/database'

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

  const { data: pub } = await supabase
    .from('published_books')
    .select('*')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!pub) notFound()

  const [{ data: book }, { data: allPages }, { data: authorProfile }] = await Promise.all([
    supabase.from('books').select('*').eq('id', pub.book_id).single(),
    supabase.from('book_pages').select('*').eq('book_id', pub.book_id).order('chapter_index'),
    supabase.from('profiles').select('*').eq('id', pub.user_id).single(),
  ])

  if (!book) notFound()

  const chapters   = (allPages ?? []).filter((p: BookPage) => p.chapter_index >= 0)
  const backMatter = (allPages ?? []).filter((p: BookPage) => p.chapter_index < 0)
  const theme      = deriveTheme(book as Book, (authorProfile as Profile) ?? null)

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

  // Email gate — show gate if gate_type is 'email'
  if (pub.gate_type === 'email') {
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
          <FlipbookViewer
            book={book as Book}
            chapters={chapters as BookPage[]}
            backMatter={backMatter as BookPage[]}
            theme={theme}
            profile={(authorProfile as Profile) ?? null}
            isPublicView
          />
        </EmailGate>
      </>
    )
  }

  return (
    <>
      {structuredData}
      <FlipbookViewer
        book={book as Book}
        chapters={chapters as BookPage[]}
        backMatter={backMatter as BookPage[]}
        theme={theme}
        profile={(authorProfile as Profile) ?? null}
        isPublicView
      />
    </>
  )
}
