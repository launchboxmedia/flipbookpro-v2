'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { PublishedBook } from '@/types/database'

interface Props {
  slug: string
  title: string
  subtitle: string | null
  coverImageUrl: string | null
  authorName: string
  /** Pulled from the author's profile.avatar_url. Falls back to no
   *  byline avatar pip when absent. */
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

/** Deterministic particle field for the parallax back layer. Hand-placed
 *  positions so the dots render identically on SSR and client (random
 *  positions would cause hydration mismatches). 24 dots, ~half pulsing,
 *  staggered animation-delays so they don't pulse in lockstep. */
const PARTICLES: ReadonlyArray<{
  top: string; left: string; delay: string; pulse: boolean
}> = [
  { top:  '8%', left: '10%', delay: '0s',   pulse: true  },
  { top: '14%', left: '78%', delay: '0.4s', pulse: false },
  { top: '20%', left: '22%', delay: '0.8s', pulse: true  },
  { top: '24%', left: '50%', delay: '1.2s', pulse: false },
  { top: '28%', left: '88%', delay: '0.2s', pulse: true  },
  { top: '34%', left: '15%', delay: '0.6s', pulse: false },
  { top: '38%', left: '65%', delay: '1.0s', pulse: true  },
  { top: '44%', left: '92%', delay: '0.3s', pulse: false },
  { top: '48%', left: '32%', delay: '0.7s', pulse: true  },
  { top: '54%', left:  '6%', delay: '1.1s', pulse: false },
  { top: '58%', left: '72%', delay: '0.5s', pulse: true  },
  { top: '62%', left: '42%', delay: '0.9s', pulse: false },
  { top: '68%', left: '95%', delay: '0.1s', pulse: true  },
  { top: '72%', left: '18%', delay: '1.3s', pulse: false },
  { top: '76%', left: '58%', delay: '0.4s', pulse: true  },
  { top: '80%', left: '85%', delay: '0.8s', pulse: false },
  { top: '84%', left: '28%', delay: '1.2s', pulse: true  },
  { top: '88%', left: '68%', delay: '0.6s', pulse: false },
  { top: '92%', left: '12%', delay: '1.0s', pulse: true  },
  { top: '94%', left: '48%', delay: '0.2s', pulse: false },
  { top: '40%', left: '50%', delay: '0.7s', pulse: true  },
  { top: '50%', left: '60%', delay: '1.4s', pulse: false },
  { top: '26%', left: '38%', delay: '0.5s', pulse: true  },
  { top: '70%', left: '32%', delay: '1.1s', pulse: false },
]

/** Per-page background tone (Page 1 → 6 maps to index 0 → 5). Cycling
 *  the project's cream values keeps successive sheets visually distinct
 *  as they flip past. */
const RIFFLE_PAGE_BG = [
  '#F5F0E8', // 1 — table of contents
  '#F5F0E8', // 2 — chapter image
  '#FAF7F2', // 3 — body text
  '#F5F0E8', // 4 — chapter opener
  '#FAF7F2', // 5 — image + text
  '#EDE6D8', // 6 — resources
] as const

/** Body-text bar widths for the text-heavy page (Page 3). Index 5 gets
 *  extra top margin to read as a paragraph break. */
const TEXT_PAGE_BARS: ReadonlyArray<string> = [
  '85%', '92%', '78%', '95%', '60%',
  '88%', '90%', '72%', '94%', '65%',
]

/** Inner content for each riffle page. A page is only visibly flipping
 *  for ~0.25s, so this is impressionistic — the goal is to register
 *  distinct content TYPES (contents / chapter image / body text /
 *  chapter opener / image+text / resource checklist), not legibility.
 *  All bars use the ink-1 token at low opacity so they read as print
 *  on the cream stock. */
function RifflePage({ index }: { index: number }) {
  switch (index) {
    case 0: // Table of contents
      return (
        <div className="flex h-full flex-col">
          <span className="font-playfair text-ink-1/60 text-[10px] leading-none mb-3">
            Contents
          </span>
          <div className="flex flex-1 flex-col justify-between py-0.5">
            {Array.from({ length: 6 }).map((_, r) => (
              <div key={r} className="flex items-center justify-between">
                <span className="w-24 h-1.5 bg-ink-1/15 rounded" />
                <span className="w-4 h-1.5 bg-ink-1/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      )
    case 1: // Chapter image + caption
      return (
        <div className="flex h-full flex-col">
          <div className="bg-teal-700/40 rounded-sm" style={{ height: '60%' }} />
          <div className="mt-3 space-y-2">
            <span className="block w-3/4 h-1 bg-ink-1/10 rounded" />
            <span className="block w-1/2 h-1 bg-ink-1/10 rounded" />
          </div>
        </div>
      )
    case 2: // Body text
      return (
        <div className="flex h-full flex-col justify-center gap-1.5">
          {TEXT_PAGE_BARS.map((w, r) => (
            <span
              key={r}
              className="block h-1 bg-ink-1/10 rounded"
              style={{ width: w, marginTop: r === 5 ? '0.5rem' : undefined }}
            />
          ))}
        </div>
      )
    case 3: // Chapter opener
      return (
        <div className="flex h-full flex-col">
          <span className="font-playfair text-ink-1/20 text-4xl leading-none">
            04
          </span>
          <span className="block w-32 h-2 bg-ink-1/20 rounded mt-3" />
          <div className="mt-4 space-y-2">
            <span className="block w-full h-1 bg-ink-1/10 rounded" />
            <span className="block w-11/12 h-1 bg-ink-1/10 rounded" />
            <span className="block w-4/5 h-1 bg-ink-1/10 rounded" />
          </div>
        </div>
      )
    case 4: // Image + text
      return (
        <div className="flex h-full flex-col">
          <div className="flex gap-3">
            <div className="flex-1 space-y-2 pt-0.5">
              <span className="block w-full h-1 bg-ink-1/10 rounded" />
              <span className="block w-5/6 h-1 bg-ink-1/10 rounded" />
              <span className="block w-full h-1 bg-ink-1/10 rounded" />
              <span className="block w-3/4 h-1 bg-ink-1/10 rounded" />
            </div>
            <div className="bg-gold/20 w-1/3 aspect-square rounded-sm shrink-0" />
          </div>
          <div className="mt-3 space-y-2">
            <span className="block w-full h-1 bg-ink-1/10 rounded" />
            <span className="block w-11/12 h-1 bg-ink-1/10 rounded" />
            <span className="block w-4/5 h-1 bg-ink-1/10 rounded" />
            <span className="block w-2/3 h-1 bg-ink-1/10 rounded" />
          </div>
        </div>
      )
    case 5: // Resource checklist
      return (
        <div className="flex h-full flex-col">
          <span className="font-playfair text-ink-1/60 text-[10px] leading-none mb-3">
            Resources
          </span>
          <div className="flex flex-1 flex-col justify-evenly">
            {Array.from({ length: 4 }).map((_, r) => (
              <div key={r} className="flex items-center">
                <span className="w-3 h-3 border border-ink-1/20 rounded-sm" />
                <span className="w-20 h-1.5 bg-ink-1/15 rounded ml-2" />
              </div>
            ))}
          </div>
        </div>
      )
    case 6: // Closing page — what the interior backdrop shows after the
            // last page flips, before the cover sweeps shut. Centered
            // with a gold rule so it reads as a colophon / end page,
            // distinct from the resource page that just flipped past.
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <span className="w-28 h-2 bg-ink-1/20 rounded" />
          <span className="w-10 h-px bg-gold/50 rounded" />
          <span className="w-40 h-1 bg-ink-1/10 rounded" />
          <span className="w-32 h-1 bg-ink-1/10 rounded" />
        </div>
      )
    default:
      return null
  }
}

// Full cover-open → pages-flip → cover-close cycle.
// Cover animation: 2s (0–0.4s open, 0.4–1.6s hold open, 1.6–2.0s close).
// Pages: start at 0.4s, last page ends at 1.5s. 100ms buffer added
// to the unmount timeout so we don't unmount mid-frame.
const RIFFLE_DURATION_MS = 2100

/** Hero block for the conversion landing page.
 *
 *  Marked 'use client' for the scroll-driven parallax + book riffle.
 *  Five layers (particles, glow, book, text, vignette) translate at
 *  different rates as scrollY grows, creating depth as the hero exits
 *  into the next section.
 *
 *  The book itself is a real 3D animation: the cover hinges open
 *  around the spine (left edge), six cream pages flip through in
 *  sequence, the cover hinges closed. perspective lives on the book
 *  column, transform-style: preserve-3d on the rotation wrapper. The
 *  drop-shadow that used to live on the book box was moved to a
 *  box-shadow because filter implicitly flattens preserve-3d (the
 *  previous attempt was crippled by this). */
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

  // Parallax state.
  //  - scrollY: window scroll position, clamped to viewport height. Past
  //    one screen the hero is offscreen and continued transforms just
  //    waste cycles.
  //  - isMobile: < 768px viewport — halves every layer's scroll rate and
  //    hides the particle field entirely to keep mobile GPUs cool.
  //  - parallaxEnabled: false when the user prefers reduced motion. All
  //    layers freeze at offset 0.
  const [scrollY, setScrollY] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [parallaxEnabled, setParallaxEnabled] = useState(true)
  const tickingRef = useRef(false)

  // Riffle state. isRiffling drives the conditional render of the page
  // stack + the cover's animation; isRifflingRef mirrors it for the
  // trigger guard (state inside a timer callback would close over a
  // stale value); hasRiffledRef is the latch — set on first hover, kills
  // the 4s auto-cycle so the riffle becomes purely interactive.
  const [isRiffling, setIsRiffling] = useState(false)
  const isRifflingRef = useRef(false)
  const hasRiffledRef = useRef(false)

  const riffleBook = () => {
    if (isRifflingRef.current) return
    isRifflingRef.current = true
    setIsRiffling(true)
    window.setTimeout(() => {
      isRifflingRef.current = false
      setIsRiffling(false)
    }, RIFFLE_DURATION_MS)
  }

  // Parallax effect — scroll listener with rAF throttling.
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Reduced-motion users get the static hero — no scroll listener
    // installed at all so the parallax cost is exactly zero.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setParallaxEnabled(false)
      return
    }

    const updateMobile = () => setIsMobile(window.innerWidth < 768)
    updateMobile()

    // rAF throttling — scroll fires at native refresh rate (often
    // 120+Hz on modern monitors), but we only need one parallax
    // update per browser paint. The ref gate ensures at most one
    // setState per frame.
    const handleScroll = () => {
      if (tickingRef.current) return
      tickingRef.current = true
      requestAnimationFrame(() => {
        setScrollY(Math.min(window.scrollY, window.innerHeight))
        tickingRef.current = false
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', updateMobile)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updateMobile)
    }
  }, [])

  // Auto-riffle effect — kicks off at 3s (long enough for the page to
  // settle), then every 6s (gives the user time to register the previous
  // cycle), until the first hover sets hasRiffledRef. Reduced-motion
  // users skip the cycle entirely.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const initial = window.setTimeout(() => {
      if (!hasRiffledRef.current) riffleBook()
    }, 3000)
    const interval = window.setInterval(() => {
      if (!hasRiffledRef.current) riffleBook()
    }, 6000)

    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hover handler — latch hasRiffledRef so auto-cycle stops, then
  // either riffle (motion-safe) or fall through to the CSS-driven
  // scale(1.02) hover state (motion-reduce).
  const handleBookHover = () => {
    hasRiffledRef.current = true
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    riffleBook()
  }

  // Mobile halves every layer's scroll rate. Reduced-motion zeroes
  // everything out via the gate on scrollY itself.
  const mobileFactor = isMobile ? 0.5 : 1
  const effective = parallaxEnabled ? scrollY : 0

  // Parallax rates. Book at 0.08x and text at 0.40x carry the depth
  // — the gap between them creates the visible separation as the hero
  // exits the viewport.
  const layerOffset = {
    particles: effective *  0.02 * mobileFactor,
    glow:      effective *  0.05 * mobileFactor,
    book:      effective *  0.08 * mobileFactor,
    text:      effective *  0.40 * mobileFactor,
    // Negative — vignette drifts UP as user scrolls DOWN.
    vignette:  effective * -0.05 * mobileFactor,
  }

  // Single source of truth for the will-change hint applied to every
  // parallax layer. Promotes them to their own compositor layers so
  // the browser can transform them on the GPU without repainting.
  const willChangeTransform = { willChange: 'transform' as const }

  // Particles hide on mobile entirely (per spec) and on reduced-motion
  // (no point rendering still dots when the parent isn't moving).
  const showParticles = parallaxEnabled && !isMobile

  return (
    <section className="relative bg-ink-1 overflow-hidden">
      {/* ── Layer 1: particle field (slowest, 0.02x) ────────────────
          Behind everything else. Twenty-four hand-placed dots scattered
          across the section; the wrapper translates at 0.02x scroll so
          they feel infinitely far away. Hidden on mobile and reduced
          motion. */}
      {showParticles && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ transform: `translateY(${layerOffset.particles}px)`, ...willChangeTransform }}
          aria-hidden="true"
        >
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className={`absolute w-1 h-1 rounded-full bg-gold/20 ${p.pulse ? 'animate-pulse-subtle' : ''}`}
              style={{ top: p.top, left: p.left, animationDelay: p.delay }}
            />
          ))}
        </div>
      )}

      {/* ── Layer 2: radial gold glow (0.05x) ───────────────────────
          Replaces the section's previous static gradient — same job
          (gold halo behind the cover) but drifting slowly for depth. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translateY(${layerOffset.glow}px)`,
          backgroundImage:
            'radial-gradient(ellipse 80% 80% at 40% 50%, rgba(201,168,76,0.12) 0%, transparent 70%)',
          ...willChangeTransform,
        }}
        aria-hidden="true"
      />

      {/* Content grid */}
      <div className="relative max-w-6xl mx-auto px-6 lg:px-8 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-screen">
        {/* ── Layer 3: book column (0.08x) ──────────────────────────
            perspective lives here so descendants can rotateY in 3D.
            The column itself has no other transform-style — the 3D
            context starts at the book box below. */}
        <div
          className="group relative flex justify-center items-center"
          style={{
            transform: `translateY(${layerOffset.book}px)`,
            perspective: '1000px',
            ...willChangeTransform,
          }}
          onMouseEnter={handleBookHover}
        >
          {/* Book box — the rotation wrapper. preserve-3d so children
              (cover, pages, interior) rotate in real 3D. The -2°/0°
              hover tilt and the box-shadow drop both live here. NOTE:
              no `overflow-hidden` and no `filter` — both silently
              flatten preserve-3d, which is what broke the previous
              flip attempt. The shadow is therefore box-shadow (an
              outline shadow) rather than drop-shadow (alpha-channel
              shadow). At rest the cover fills the box completely, so
              the two look identical. */}
          <div
            className="relative max-w-[300px] w-full mx-auto aspect-[2/3] rounded-xl transition-transform duration-300 ease-out -rotate-2 motion-safe:group-hover:rotate-0 motion-reduce:group-hover:scale-[1.02]"
            style={{
              transformStyle: 'preserve-3d',
              boxShadow:
                '0 32px 80px rgba(201,168,76,0.35), 0 8px 32px rgba(0,0,0,0.7)',
            }}
          >
            {/* ── Interior backdrop ──────────────────────────────────
                The "inside" of the book — the deepest layer, always
                mounted. After the last page flips away it's exposed for
                ~0.5s before the cover sweeps shut, so it carries the
                closing-page content (index 6) rather than being blank.
                Fully covered by the cover at rest. */}
            <div
              className="absolute inset-0 rounded-xl overflow-hidden p-3"
              style={{ backgroundColor: '#F5F0E8' }}
              aria-hidden="true"
            >
              <RifflePage index={6} />
            </div>

            {/* ── Pages (only mounted during a riffle) ───────────────
                Rendered in REVERSE so page 0 lands last in the DOM and
                therefore paints on top of the other pages at the same
                z-depth. Each page hinges around its left edge, going
                from rotateY(0) (covering the cover area) to rotateY(-180)
                (flipped flat to the left of the spine). backface-
                visibility: hidden cuts the page out at -90°, so the
                visible portion is the quarter-turn flip — a real page
                flipping past the camera. */}
            {isRiffling &&
              Array.from({ length: RIFFLE_PAGE_BG.length }).map((_, j) => {
                // Reverse: render page 5 first (DOM-wise, paints below)
                // through page 0 last (paints on top of pages 1-5).
                const i = RIFFLE_PAGE_BG.length - 1 - j
                return (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-xl overflow-hidden p-3 animate-riffle-flip"
                    style={{
                      backgroundColor: RIFFLE_PAGE_BG[i],
                      transformOrigin: 'left center',
                      backfaceVisibility: 'hidden',
                      animationDelay: `${0.4 + i * 0.12}s`,
                      willChange: 'transform',
                    }}
                    aria-hidden="true"
                  >
                    <RifflePage index={i} />
                  </div>
                )
              })}

            {/* ── Cover ──────────────────────────────────────────────
                Always mounted (so the Image element isn't unmounted
                between riffles). At rest, no animation — element stays
                at rotateY(0) covering everything. During a riffle,
                animates open (0 → -160°), holds open while the pages
                flip behind it (cover is past -90°, hidden by backface-
                visibility), then closes back (-160° → 0). overflow-
                hidden lives HERE (not on the book box) so the Image's
                rounded corners are clipped without breaking the parent's
                preserve-3d. */}
            <div
              className={`absolute inset-0 rounded-xl overflow-hidden ${isRiffling ? 'animate-riffle-cover' : ''}`}
              style={{
                transformOrigin: 'left center',
                backfaceVisibility: 'hidden',
                ...(isRiffling ? { willChange: 'transform' as const } : {}),
              }}
            >
              {coverImageUrl ? (
                <Image
                  src={coverImageUrl}
                  alt={`${title} cover`}
                  fill
                  className="object-cover"
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
                  across the cover on a 2s linear loop. */}
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
        </div>

        {/* ── Layer 4: text column (0.40x) ──────────────────────────
            Moves five times faster than the book — the gap is what
            creates the depth illusion. Each child still uses its own
            slide-up entrance via animate-slide-up + inline delay. */}
        <div
          className="relative"
          style={{ transform: `translateY(${layerOffset.text}px)`, ...willChangeTransform }}
        >
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

          {/* 6. Trust row */}
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

          {/* 7. Access badge */}
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

          {/* 8. CTA + 9. helper subtext */}
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

      {/* ── Layer 5: foreground vignette (-0.05x, moves UP on scroll) ──
          On top of everything (paints last, pointer-events disabled so
          clicks still reach the CTA). */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translateY(${layerOffset.vignette}px)`,
          backgroundImage:
            'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 60%, rgba(15,22,35,0.4) 100%)',
          ...willChangeTransform,
        }}
        aria-hidden="true"
      />
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
