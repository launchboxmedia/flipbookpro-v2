import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Book, BookPage, Profile, PublishedBook } from '@/types/database'
import { HeroSection } from './components/HeroSection'
import { ChapterList } from './components/ChapterList'

interface Props {
  params: { slug: string }
}

/**
 * Conversion-page data load. Cached per-request via React.cache so
 * generateMetadata and the page component each call this without
 * doubling the Supabase round-trips. Returns null when the slug
 * doesn't resolve to an active published book; callers either render
 * a 404 (page) or a generic title (metadata).
 */
const loadLanding = cache(async (slug: string) => {
  const supabase = await createClient()

  const { data: pub } = await supabase
    .from('published_books')
    .select('slug, book_id, access_type, price_cents, is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!pub) return null

  // Fan-out: book row + chapter index/titles + resource count + lead
  // count, all in parallel against the resolved book_id. Counts use
  // head:true so we get a count without paying for the row payload.
  const [bookResult, chaptersResult, resourceCountResult, leadCountResult] = await Promise.all([
    supabase
      .from('books')
      .select('id, title, subtitle, author_name, cover_image_url, back_cover_tagline, back_cover_description, palette, user_id')
      .eq('id', pub.book_id)
      .single(),
    supabase
      .from('book_pages')
      .select('chapter_index, chapter_title')
      .eq('book_id', pub.book_id)
      .gte('chapter_index', 0)
      // Exclude the CTA sentinel chapter — it sits at chapter_index 99
      // as a closing call-to-action and shouldn't be counted as
      // content. The landing page is selling the BOOK, not its
      // post-script.
      .lt('chapter_index', 99)
      .order('chapter_index'),
    supabase
      .from('book_resources')
      .select('id', { count: 'exact', head: true })
      .eq('book_id', pub.book_id),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('book_id', pub.book_id),
  ])

  const book = bookResult.data as Pick<Book, 'id' | 'title' | 'subtitle' | 'author_name' | 'cover_image_url' | 'back_cover_tagline' | 'back_cover_description' | 'palette' | 'user_id'> | null
  if (!book) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, full_name, avatar_url, author_bio')
    .eq('id', book.user_id)
    .maybeSingle() as { data: Pick<Profile, 'display_name' | 'full_name' | 'avatar_url' | 'author_bio'> | null }

  const chapters = (chaptersResult.data ?? []) as Pick<BookPage, 'chapter_index' | 'chapter_title'>[]
  const resourceCount = resourceCountResult.count ?? 0
  const leadCount     = leadCountResult.count ?? 0
  // The column is NOT NULL with default 'email' per the 20260430
  // migration, so the cast is safe — but coerce to a known value for
  // type safety against legacy rows.
  const accessType: PublishedBook['access_type'] =
    (pub.access_type as PublishedBook['access_type']) ?? 'email'

  // Format whole-dollar prices without trailing zeros ($9 not $9.00),
  // but preserve cents when present ($9.99).
  const priceFormatted = pub.price_cents > 0
    ? `$${(pub.price_cents / 100).toFixed(pub.price_cents % 100 === 0 ? 0 : 2)}`
    : null

  // Author-name fallback chain: per-book author_name (set on the book)
  // → profile display_name (brand-facing) → profile full_name (auth-side)
  // → 'the author' last-resort. Matches the rest of the app.
  const authorName =
    book.author_name?.trim() ||
    profile?.display_name?.trim() ||
    profile?.full_name?.trim() ||
    'the author'

  return {
    pub,
    book,
    profile,
    chapters,
    chapterCount: chapters.length,
    resourceCount,
    leadCount,
    accessType,
    priceFormatted,
    authorName,
  }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadLanding(params.slug)
  if (!data) return { title: 'Book Not Found', robots: { index: false, follow: false } }

  const { book, authorName } = data
  // back_cover_tagline is the strongest pitch line; subtitle is the
  // fallback when the tagline isn't set. Either way the description
  // surfaces in Google snippets and social cards.
  const description = book.back_cover_tagline ?? book.subtitle ?? undefined
  const canonical = `https://go.bookbuilderpro.app/${params.slug}`

  return {
    title:       `${book.title} — ${authorName}`,
    description,
    openGraph: {
      title:       book.title,
      description,
      url:         canonical,
      type:        'book',
      // 1200×630 is the recommended OG image size. Book covers are
      // portrait (2:3) and will be letterboxed by social scrapers, but
      // tagging the dimensions as the canonical OG size keeps Facebook
      // and Twitter happy at render time.
      images:      book.cover_image_url
        ? [{ url: book.cover_image_url, width: 1200, height: 630, alt: book.title }]
        : [],
    },
    twitter: {
      card:        book.cover_image_url ? 'summary_large_image' : 'summary',
      title:       book.title,
      description,
      images:      book.cover_image_url ? [book.cover_image_url] : [],
    },
    alternates: { canonical },
  }
}

/** Per-access-type CTA copy. Mirrored from HeroSection so the
 *  server-rendered final-CTA section stays in sync with the hero
 *  without bumping the client bundle. The trailing-arrow trim
 *  defends against the paid template emitting a double space when
 *  priceFormatted is empty. */
function ctaCopyFor(
  accessType: PublishedBook['access_type'],
  priceFormatted: string | null,
): { text: string; sub: string | null } {
  if (accessType === 'paid') {
    return {
      text: `Get Instant Access — ${priceFormatted ?? ''} →`.replace(/\s+→$/, ' →'),
      sub:  'Instant access · Secure checkout',
    }
  }
  if (accessType === 'email') {
    return {
      text: 'Get Free Access →',
      sub:  'Enter your email to unlock instantly',
    }
  }
  return {
    text: 'Read Now — It’s Free →',
    sub:  null,
  }
}

export default async function GoPage({ params }: Props) {
  const data = await loadLanding(params.slug)
  if (!data) notFound()

  const {
    book,
    profile,
    chapters,
    chapterCount,
    resourceCount,
    leadCount,
    accessType,
    priceFormatted,
    authorName,
  } = data

  const readHref = `/read/${params.slug}`
  const ctaCopy = ctaCopyFor(accessType, priceFormatted)

  // First letter for the avatar fallback. Defensive against names that
  // start with whitespace or punctuation; falls back to '?'. ASCII-only
  // — non-Latin starting characters skip past to '?', acceptable for an
  // English-language product.
  const authorInitial = authorName.trim().match(/[a-zA-Z0-9]/)?.[0]?.toUpperCase() ?? '?'

  return (
    <>
      {/* ── 1. HERO ─────────────────────────────────────────────────── */}
      <HeroSection
        slug={params.slug}
        title={book.title}
        subtitle={book.subtitle}
        coverImageUrl={book.cover_image_url}
        authorName={authorName}
        avatarUrl={profile?.avatar_url ?? null}
        backCoverTagline={book.back_cover_tagline}
        chapterCount={chapterCount}
        resourceCount={resourceCount}
        accessType={accessType}
        priceFormatted={priceFormatted}
      />

      {/* ── 2. ABOUT THIS BOOK (cream) ─────────────────────────────── */}
      {book.back_cover_description && (
        <section className="bg-cream-1 py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-1/40 font-medium mb-3">
              About This Book
            </p>
            <h2 className="font-playfair text-3xl text-ink-1 mb-8">
              What This Book Is About
            </h2>
            {book.back_cover_description
              .split(/\n\n+/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p, i) => (
                <p
                  key={i}
                  className="font-source-serif text-ink-1/80 text-lg leading-relaxed mb-5"
                >
                  {p}
                </p>
              ))}
            {book.back_cover_tagline && (
              <blockquote className="border-l-4 border-gold pl-6 my-8 font-playfair text-xl italic text-ink-1">
                {book.back_cover_tagline}
              </blockquote>
            )}
          </div>
        </section>
      )}

      {/* ── 3. WHAT'S INSIDE (dark, scroll-reveal chapters) ────────── */}
      <section className="bg-ink-2 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-medium mb-3 text-center">
            What&rsquo;s Inside
          </p>
          <h2 className="font-playfair text-3xl text-white text-center mb-16">
            {chapterCount} {chapterCount === 1 ? 'Chapter' : 'Chapters'} of Field-Tested Strategy
          </h2>
          <ChapterList
            chapters={chapters}
            totalCount={chapterCount}
            resourceCount={resourceCount}
          />
        </div>
      </section>

      {/* ── 4. ABOUT THE AUTHOR (cream) ────────────────────────────── */}
      {profile?.author_bio && (
        <section className="bg-cream-1 py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-1/40 font-medium mb-3">
              About the Author
            </p>
            <h2 className="font-playfair text-3xl text-ink-1 mb-10">
              About {authorName}
            </h2>
            <div className="flex gap-8 items-start">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={authorName}
                  width={96}
                  height={96}
                  className="w-24 h-24 rounded-full object-cover flex-shrink-0 ring-2 ring-gold/30 shadow-lg"
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex-shrink-0 bg-teal-800 flex items-center justify-center font-playfair text-3xl text-white"
                  aria-hidden
                >
                  {authorInitial}
                </div>
              )}
              <div>
                <p className="font-playfair text-xl text-ink-1 font-semibold mb-3">
                  {authorName}
                </p>
                {/* whitespace-pre-line preserves single-line breaks in
                    the bio so authors can format short multi-line bios
                    without writing markdown. */}
                <p className="font-source-serif text-ink-1/70 leading-relaxed text-base whitespace-pre-line">
                  {profile.author_bio}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 5. FINAL CTA (dark, gold glow) ─────────────────────────── */}
      <section
        className="relative bg-ink-1 py-24 px-6 text-center overflow-hidden"
        style={{
          // Mirrors the hero's glow but centered — closes the visual
          // loop. Slightly tighter (50/60 vs 60/70) so the brightest
          // point sits behind the heading itself.
          backgroundImage:
            'radial-gradient(ellipse 50% 60% at 50% 50%, rgba(201,168,76,0.06) 0%, transparent 70%)',
        }}
      >
        <div className="relative max-w-2xl mx-auto">
          {leadCount > 0 && (
            <p className="text-white/30 text-sm mb-4">
              Join {leadCount.toLocaleString()} {leadCount === 1 ? 'reader' : 'readers'}
            </p>
          )}
          {/* Closing headline. Reuses the book's own tagline when set —
              it's already a sharper, book-specific pitch than any
              generic closer we could write. Generic fallback covers
              books that haven't filled in back_cover_tagline yet. */}
          <h2 className="font-playfair text-3xl md:text-4xl text-white mb-4">
            {book.back_cover_tagline ?? 'Ready when you are.'}
          </h2>
          <p className="font-source-serif text-white/50 text-lg mb-10">
            Get instant access and start reading today.
          </p>
          <div className="max-w-sm mx-auto">
            <Link
              href={readHref}
              className="block w-full py-4 px-8 rounded-xl bg-gold text-ink-1 font-semibold text-lg text-center transition-all duration-200 hover:bg-gold-soft hover:shadow-[0_0_30px_rgba(201,168,76,0.4)] active:scale-[0.98]"
            >
              {ctaCopy.text}
            </Link>
            {ctaCopy.sub && (
              <p className="text-white/30 text-xs text-center mt-2">{ctaCopy.sub}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── 6. FOOTER ──────────────────────────────────────────────── */}
      <footer className="bg-[#080E18] py-10 px-6 text-center">
        <p className="text-white/20 text-xs">
          Published with{' '}
          <a
            href="https://bookbuilderpro.app"
            className="text-white/40 hover:text-white/60 transition-colors"
          >
            FlipBookPro
          </a>
        </p>
      </footer>
    </>
  )
}
