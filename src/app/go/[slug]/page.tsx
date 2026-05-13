import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Book, BookPage, Profile, PublishedBook } from '@/types/database'

interface Props {
  params: { slug: string }
}

/**
 * Conversion-page data load. Cached per-request via React.cache so
 * generateMetadata and the page component each call this without
 * doubling the supabase round-trips. Returns null when the slug
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
  // head:true so we get a count without paying for row payload.
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
  const accessType    = pub.access_type as PublishedBook['access_type']

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

/** CTA copy + button styling vary by access_type — same shape both
 *  in the hero and the final CTA section. Returned as data so both
 *  render sites stay consistent without duplicating the conditional. */
function ctaCopy(
  accessType: PublishedBook['access_type'],
  priceFormatted: string | null,
): { text: string; subtext: string | null } {
  if (accessType === 'paid') {
    return {
      text:    `Get Instant Access — ${priceFormatted ?? ''} →`.replace(/\s+→$/, ' →'),
      subtext: 'Instant download · 30-day guarantee',
    }
  }
  if (accessType === 'email') {
    return {
      text:    'Get Free Access →',
      subtext: 'Enter your email to unlock instantly',
    }
  }
  return {
    text:    'Read Now — It’s Free →',
    subtext: null,
  }
}

function PrimaryCta({
  href,
  text,
  subtext,
}: {
  href: string
  text: string
  subtext: string | null
}) {
  return (
    <div>
      <Link
        href={href}
        className="w-full bg-gold hover:bg-gold-soft text-ink-1 font-inter font-semibold py-4 px-8 rounded-xl text-lg transition-colors text-center block"
      >
        {text}
      </Link>
      {subtext && (
        <p className="text-white/40 text-xs text-center mt-2 font-inter">
          {subtext}
        </p>
      )}
    </div>
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadLanding(params.slug)
  if (!data) return { title: 'Book Not Found', robots: { index: false, follow: false } }

  const { book, authorName } = data
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
      images:      book.cover_image_url
        ? [{ url: book.cover_image_url, width: 768, height: 1024, alt: book.title }]
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
  const cta = ctaCopy(accessType, priceFormatted)

  // First letter for the avatar fallback initials. Defensive against
  // names that start with whitespace or punctuation; falls back to '?'.
  // ASCII-only match (the project's TS target predates Unicode property
  // escapes) — non-Latin first characters skip past to '?', acceptable
  // for an English-language product.
  const authorInitial = authorName.trim().match(/[a-zA-Z0-9]/)?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="bg-ink-1">
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="min-h-screen bg-ink-1 flex items-center px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 max-w-6xl mx-auto items-center">
          {/* LEFT — Cover image */}
          <div className="flex justify-center md:justify-end order-1 md:order-1">
            {book.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={book.cover_image_url}
                alt={book.title}
                className="rounded-xl shadow-[0_20px_60px_rgba(201,168,76,0.3)] -rotate-2 max-w-xs w-full"
                style={{ aspectRatio: '3/4', objectFit: 'cover' }}
              />
            ) : (
              <div
                className="rounded-xl shadow-[0_20px_60px_rgba(201,168,76,0.3)] -rotate-2 max-w-xs w-full bg-ink-3 flex items-center justify-center"
                style={{ aspectRatio: '3/4' }}
              >
                <span className="font-playfair text-white/30 text-center px-6 leading-tight">
                  {book.title}
                </span>
              </div>
            )}
          </div>

          {/* RIGHT — Book details */}
          <div className="order-2 md:order-2">
            <p className="text-gold font-inter text-xs uppercase tracking-[0.2em] mb-3">
              {authorName}
            </p>
            <h1 className="font-playfair text-4xl md:text-5xl text-white font-bold leading-tight">
              {book.title}
            </h1>
            {book.subtitle && (
              <p className="font-source-serif text-xl text-white/60 italic mt-3">
                {book.subtitle}
              </p>
            )}

            <div className="w-16 h-0.5 bg-gold my-8" aria-hidden />

            {book.back_cover_tagline && (
              <p className="font-source-serif text-white/80 text-lg leading-relaxed">
                {book.back_cover_tagline}
              </p>
            )}

            <div className="flex items-center gap-2 text-white/50 text-sm mt-6 flex-wrap font-inter">
              <span>{chapterCount} {chapterCount === 1 ? 'Chapter' : 'Chapters'}</span>
              {resourceCount > 0 && (
                <>
                  <span className="text-gold" aria-hidden>·</span>
                  <span>{resourceCount} {resourceCount === 1 ? 'Resource' : 'Resources'}</span>
                </>
              )}
              <span className="text-gold" aria-hidden>·</span>
              <span>Instant Access</span>
            </div>

            <div className="mt-4">
              {accessType === 'paid' ? (
                <span className="inline-block bg-gold text-ink-1 text-sm font-bold px-4 py-1.5 rounded-full font-inter">
                  {priceFormatted}
                </span>
              ) : (
                <span className="inline-block border border-gold text-gold text-sm px-4 py-1.5 rounded-full font-inter">
                  Free
                </span>
              )}
            </div>

            <div className="mt-6">
              <PrimaryCta href={readHref} text={cta.text} subtext={cta.subtext} />
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT THIS BOOK (cream) ───────────────────────────────────────── */}
      {book.back_cover_description && (
        <section className="bg-cream-1 py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-playfair text-3xl text-ink-1 mb-8">
              About This Book
            </h2>
            {book.back_cover_description
              .split(/\n\n+/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p, i) => (
                <p key={i} className="font-source-serif text-ink-1 text-lg leading-relaxed mb-4">
                  {p}
                </p>
              ))}
          </div>
        </section>
      )}

      {/* ── WHAT'S INSIDE (dark) ──────────────────────────────────────────── */}
      <section className="bg-ink-2 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-playfair text-3xl text-gold text-center mb-16">
            What’s Inside
          </h2>

          <ol className="space-y-6">
            {chapters.slice(0, 6).map((ch, i) => (
              <li key={ch.chapter_index} className="flex items-start gap-5">
                <span className="font-playfair text-2xl text-gold font-bold w-8 flex-shrink-0 leading-none pt-1">
                  {i + 1}
                </span>
                <span className="font-source-serif text-white text-lg leading-snug">
                  {ch.chapter_title}
                </span>
              </li>
            ))}
          </ol>

          {chapterCount > 6 && (
            <p className="text-gold/50 text-sm mt-8 font-inter">
              + {chapterCount - 6} more {chapterCount - 6 === 1 ? 'chapter' : 'chapters'}
            </p>
          )}

          {resourceCount > 0 && (
            <div className="mt-16 border border-gold/20 bg-gold/5 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl" aria-hidden>📎</span>
                <h3 className="font-playfair text-gold text-xl">
                  {resourceCount} Downloadable {resourceCount === 1 ? 'Resource' : 'Resources'} Included
                </h3>
              </div>
              <p className="font-source-serif text-white/60 text-base leading-relaxed">
                Checklists, templates, scripts, and frameworks — practical tools you keep and use beyond the book.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── ABOUT THE AUTHOR (cream) ──────────────────────────────────────── */}
      {profile?.author_bio && (
        <section className="bg-cream-1 py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-playfair text-3xl text-ink-1 mb-10">
              About the Author
            </h2>
            <div className="flex gap-6 items-start">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={authorName}
                  className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full bg-teal-700 flex items-center justify-center text-white font-playfair text-2xl flex-shrink-0"
                  aria-hidden
                >
                  {authorInitial}
                </div>
              )}
              <div>
                <p className="font-playfair text-xl text-ink-1 font-semibold mb-3">
                  {authorName}
                </p>
                <p className="font-source-serif text-ink-1/75 leading-relaxed whitespace-pre-line">
                  {profile.author_bio}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="bg-ink-1 py-24 px-6 text-center">
        {leadCount > 0 && (
          <p className="text-white/40 text-sm mb-6 font-inter">
            Join {leadCount.toLocaleString()} {leadCount === 1 ? 'reader' : 'readers'}
          </p>
        )}
        <div className="max-w-sm mx-auto">
          <PrimaryCta href={readHref} text={cta.text} subtext={cta.subtext} />
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="bg-[#080E18] py-10 text-center">
        <p className="text-white/20 text-xs font-inter">
          Published with{' '}
          <a
            href="https://bookbuilderpro.app"
            className="text-white/40 hover:text-white/60 transition-colors"
          >
            FlipBookPro
          </a>
        </p>
      </footer>
    </div>
  )
}
