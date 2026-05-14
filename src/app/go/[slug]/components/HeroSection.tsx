'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { PublishedBook } from '@/types/database'

interface Props {
  slug: string
  title: string
  subtitle: string | null
  coverImageUrl: string | null
  authorName: string
  /** Pulled from the author's profile.avatar_url. Falls back to the
   *  initial-letter avatar block when absent. */
  avatarUrl: string | null
  backCoverTagline: string | null
  chapterCount: number
  resourceCount: number
  /** access_type === 'paid' shows the dollar badge + paid CTA copy;
   *  'email' shows a "Free" outlined badge + email-gate CTA copy;
   *  'free' shows the same Free badge + free CTA. */
  accessType: PublishedBook['access_type']
  /** Pre-formatted price string with leading $, e.g. "$9" or "$9.99".
   *  null for free / email books. */
  priceFormatted: string | null
}

/** Hero block for the conversion landing page.
 *
 *  Marked 'use client' per spec — currently the hero has no JS-driven
 *  behaviour (animations are CSS, CTA is a Link, hover is pure
 *  group-hover), but the boundary is here so future interactions
 *  (sticky CTA, mobile menu, scroll-progress, etc.) can be added
 *  without flipping the parent page to a client component. */
export function HeroSection({
  slug,
  title,
  subtitle,
  coverImageUrl,
  authorName,
  avatarUrl,
  backCoverTagline,
  chapterCount,
  resourceCount,
  accessType,
  priceFormatted,
}: Props) {
  const readHref = `/read/${slug}`
  const cta = ctaCopyFor(accessType, priceFormatted)

  return (
    <section
      className="relative bg-ink-1 overflow-hidden"
      // Radial gold glow behind the book — anchored at 35% horizontal so
      // the brightest point sits behind the cover, not the text. inline
      // backgroundImage so the gradient parameters stay readable.
      style={{
        backgroundImage:
          'radial-gradient(ellipse 60% 70% at 35% 50%, rgba(201,168,76,0.07) 0%, transparent 70%)',
      }}
    >
      <div className="relative max-w-6xl mx-auto px-6 lg:px-8 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-screen">
        {/* LEFT — book cover. Tilted -2° at rest, straightens on hover.
            The drop-shadow filter renders OUTSIDE the rotated box so the
            gold halo stays grounded under the cover at any rotation. */}
        <div className="group relative flex justify-center items-center">
          <div
            className="relative max-w-[300px] w-full mx-auto aspect-[2/3] rounded-xl overflow-hidden transition-transform duration-300 ease-out -rotate-2 group-hover:rotate-0"
            style={{
              // Two stacked drop-shadows — the gold one is the signature
              // hero element; the darker black layer grounds it on dark
              // backgrounds.
              filter:
                'drop-shadow(0 32px 64px rgba(201,168,76,0.25)) drop-shadow(0 8px 32px rgba(0,0,0,0.6))',
            }}
          >
            {coverImageUrl ? (
              <Image
                src={coverImageUrl}
                alt={`${title} cover`}
                fill
                className="object-cover"
                // 300px is the cover's max width; below the lg breakpoint
                // it scales to fill the column up to 80vw.
                sizes="(min-width: 1024px) 300px, 80vw"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-ink-3 flex items-center justify-center">
                <span className="font-playfair text-white/30 text-center px-6 leading-tight">
                  {title}
                </span>
              </div>
            )}

            {/* Gold shimmer overlay — a diagonal highlight that drifts
                across the cover on a 2s linear loop. Pointer-events
                disabled so the overlay doesn't intercept the (future)
                CTA click. */}
            <div
              className="absolute inset-0 pointer-events-none animate-shimmer"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, transparent 30%, rgba(201,168,76,0.06) 45%, rgba(201,168,76,0.10) 50%, rgba(201,168,76,0.06) 55%, transparent 70%)',
                backgroundSize: '200% 200%',
              }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* RIGHT — staggered slide-up details column. Each row uses the
            project's animate-slide-up (defined in globals.css with
            fill-mode `both`, so the FROM state is held during the
            inline animationDelay before the animation kicks in). */}
        <div className="relative">
          {/* 1. Author byline — gold caps with optional avatar pip */}
          <div
            className="flex items-center gap-2 text-gold text-xs uppercase tracking-[0.2em] font-medium mb-3 animate-slide-up"
            style={{ animationDelay: '0s' }}
          >
            {avatarUrl && (
              <Image
                src={avatarUrl}
                alt=""
                width={24}
                height={24}
                className="w-6 h-6 rounded-full object-cover"
              />
            )}
            <span>{authorName}</span>
          </div>

          {/* 2. Title */}
          <h1
            className="font-playfair font-bold leading-tight text-white text-4xl md:text-5xl mb-3 animate-slide-up"
            style={{ animationDelay: '0.1s' }}
          >
            {title}
          </h1>

          {/* 3. Subtitle — italic Source Serif, dimmer than the title */}
          {subtitle && (
            <p
              className="font-source-serif italic text-white/60 text-lg md:text-xl mb-6 animate-slide-up"
              style={{ animationDelay: '0.2s' }}
            >
              {subtitle}
            </p>
          )}

          {/* 4. Gold rule */}
          <div
            className="w-16 h-0.5 bg-gold mb-6 animate-slide-up"
            style={{ animationDelay: '0.3s' }}
            aria-hidden="true"
          />

          {/* 5. Tagline (from back_cover_tagline) — the book's pitch */}
          {backCoverTagline && (
            <p
              className="font-source-serif text-white/80 text-lg leading-relaxed mb-6 animate-slide-up"
              style={{ animationDelay: '0.4s' }}
            >
              {backCoverTagline}
            </p>
          )}

          {/* 6. Trust row — chapter + resource count + "Instant Access".
              Gold middots between items. Resources segment hides when
              the book has zero downloadable artifacts. */}
          <div
            className="flex items-center gap-2 flex-wrap text-white/40 text-sm mb-6 animate-slide-up"
            style={{ animationDelay: '0.5s' }}
          >
            <span>{chapterCount} {chapterCount === 1 ? 'Chapter' : 'Chapters'}</span>
            {resourceCount > 0 && (
              <>
                <span className="text-gold" aria-hidden="true">·</span>
                <span>{resourceCount} {resourceCount === 1 ? 'Resource' : 'Resources'}</span>
              </>
            )}
            <span className="text-gold" aria-hidden="true">·</span>
            <span>Instant Access</span>
          </div>

          {/* 7. Access badge — solid gold pill for paid, outlined gold
              for free / email-gate. Outline reads as "free" without the
              word "free" carrying the weight. */}
          <div
            className="mb-6 animate-slide-up"
            style={{ animationDelay: '0.6s' }}
          >
            {accessType === 'paid' && priceFormatted ? (
              <span className="inline-block bg-gold text-ink-1 font-bold text-sm px-4 py-1.5 rounded-full">
                {priceFormatted}
              </span>
            ) : (
              <span className="inline-block border border-gold/40 text-gold text-xs px-4 py-1.5 rounded-full">
                Free
              </span>
            )}
          </div>

          {/* 8. CTA — full-width gold pill, animates a soft gold glow on
              hover. active:scale-[0.98] gives a tactile press feedback
              that pairs with the hover lift. */}
          <div
            className="animate-slide-up"
            style={{ animationDelay: '0.7s' }}
          >
            <Link
              href={readHref}
              className="block w-full py-4 px-8 rounded-xl bg-gold text-ink-1 font-semibold text-lg text-center transition-all duration-200 hover:bg-gold-soft hover:shadow-[0_0_30px_rgba(201,168,76,0.4)] active:scale-[0.98]"
            >
              {cta.text}
            </Link>

            {/* 9. CTA helper subtext — explains what happens after click
                for email/paid gates. Free books get no subtext (the CTA
                already says "It's Free"). */}
            {cta.sub && (
              <p
                className="text-white/30 text-xs text-center mt-2 animate-slide-up"
                style={{ animationDelay: '0.8s' }}
              >
                {cta.sub}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Per-access-type CTA copy. The arrow is part of the string so the
 *  button stays a single Link rather than a Link wrapping label + icon
 *  (Tailwind hover-shadow looks better on a one-piece element). */
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
