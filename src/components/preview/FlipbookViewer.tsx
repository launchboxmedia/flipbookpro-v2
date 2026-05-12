'use client'

import { useRef, useCallback, useState, useEffect, useLayoutEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Download, ArrowLeft, FileText, Printer } from 'lucide-react'
import Link from 'next/link'
import type { Book, BookPage, Profile } from '@/types/database'
import type { BookTheme } from '@/lib/bookTheme'
import { paginateText, WORDS_PER_PAGE, FIRST_PAGE_BUDGET } from '@/lib/paginateText'
import { paginateMeasured } from '@/lib/paginateMeasured'
import { detectAcronymBlock, type AcronymEntry } from '@/lib/acronymBlock'

// ── Layout constants ────────────────────────────────────────────────────────

const PW = 400   // page width  (fixed per spec)
const PH = 550   // page height (fixed per spec)
const SW = 8     // spine width
const BW = PW * 2 + SW  // total book width = 808

// Re-export so legacy imports keep working.
export { WORDS_PER_PAGE, FIRST_PAGE_BUDGET }

// ── Types ───────────────────────────────────────────────────────────────────

export interface FlipbookViewerProps {
  book: Book
  chapters: BookPage[]
  backMatter: BookPage[]
  theme: BookTheme
  profile: Profile | null
  isPublicView?: boolean
}

type PageContent =
  | { type: 'blank'; dark?: boolean }
  | { type: 'cover' }
  | { type: 'diamond' }                      // facing-blank with centered ornament
  | { type: 'interior-title' }               // typographic title page (front matter)
  | { type: 'copyright' }                    // copyright / imprint block (front matter)
  | {
      type: 'introduction'
      /** Optional chapter the intro text was sourced from. Undefined when
       *  there is no Introduction/Preface/Foreword chapter and we're showing
       *  the first chunk of chapter 1 as a lead-in. */
      sourceChapterTitle?: string
      chunk: string
      chunkIndex: number
      totalChunks: number
    }
  | { type: 'toc'; tocEntries: TocEntry[] }
  | { type: 'chapter-image'; page: BookPage; num: number }
  | {
      type: 'chapter-text'
      page: BookPage
      num: number
      /** Pre-paginated text chunk for this page. Each chunk = one spread's
       *  right page. The first chunk gets the full chapter header + drop cap;
       *  continuation chunks get a smaller header. */
      chunk: string
      chunkIndex: number
      totalChunks: number
      /** Page number printed in the bottom-right corner. */
      pageNum: number
      /** Decorative framework letter (e.g. "C" for Control Payment History
       *  in the C.R.E.D.I.T. Cleanse). Only set when the chapter maps to
       *  a framework step in book.framework_data. Rendered as an 80px
       *  gold Playfair character in the top-right of the page, partially
       *  overlapping the chapter title. Shown on the first chunk only. */
      frameworkLetter?: string
    }
  | { type: 'back-matter';   page: BookPage }
  | { type: 'back-cover' }
  /** Editorial pull-quote spread, only emitted on the right page of a
   *  continuation spread when a chapter ends on the LEFT (the right slot
   *  would otherwise be blank) AND it is not the final chapter.
   *  `quote === null` renders just the two gold rules — better than blank. */
  | { type: 'pull-quote'; quote: string | null }

interface TocEntry {
  num: number
  title: string
  pageNum: number
}

interface Spread {
  id: string
  left: PageContent
  right: PageContent
  /** 'flip' = 3-D spine-anchored turn; 'fade' = crossfade */
  transition: 'flip' | 'fade'
  chapterNum?: number
  chapterTitle?: string
}

interface FlipState { fromIdx: number; toIdx: number; forward: boolean }
interface FadeState { fromIdx: number; toIdx: number }

// ── Spread builder ──────────────────────────────────────────────────────────

/** Detect a chapter that is conventionally front-matter prose, so it can be
 *  pulled out of the regular chapter sequence and used as the introduction
 *  text on the right page of the copyright spread. */
function isIntroChapter(ch: BookPage): boolean {
  return /^(introduction|preface|foreword)\b/i.test(ch.chapter_title.trim())
}

function buildSpreads(
  chapters: BookPage[],
  backMatter: BookPage[],
  framework: import('@/types/database').FrameworkData | null,
  /** Optional pre-measured chunks per chapter id. When present, these are
   *  used verbatim — the measurement layer has already split the chapter
   *  by rendered-pixel height. When absent, fall back to the heuristic
   *  paginateText (also used for SSR / initial paint before layout-effect
   *  measurement runs). */
  measuredByChapterId?: Map<string, string[]> | null,
): Spread[] {
  const chunksFor = (ch: BookPage): string[] => {
    const measured = measuredByChapterId?.get(ch.id)
    if (measured && measured.length > 0) return measured
    return paginateText(ch.content ?? '')
  }
  // Map a chapter_index → its framework letter (only for chapters that
  // correspond to a step). Used to overlay the decorative letter on the
  // chapter text page.
  const letterByChapterIndex = new Map<number, string>()
  if (framework?.steps) {
    for (const step of framework.steps) {
      if (typeof step.chapter_index === 'number' && step.letter) {
        letterByChapterIndex.set(step.chapter_index, step.letter.toUpperCase())
      }
    }
  }
  // Optional introduction. Only present when the first chapter is explicitly
  // titled Introduction / Preface / Foreword. Pulled out of the regular
  // chapter sequence so it doesn't render twice. CRITICAL: never auto-promote
  // chapter 1 as a "teaser" on the copyright spread — that broke the
  // sequence by surfacing chapter content before the TOC.
  const introChapter = chapters[0] && isIntroChapter(chapters[0]) ? chapters[0] : null
  const mainChapters = introChapter ? chapters.slice(1) : chapters

  // Pre-paginate every main chapter so we know how many spreads each one
  // needs (and so the TOC can compute correct page numbers). Uses the
  // measured chunks when available, falls back to the heuristic paginator
  // otherwise.
  const chapterChunks = mainChapters.map((ch) => chunksFor(ch))

  // Introduction chunks — empty array when there is no intro chapter, which
  // means no introduction spreads are emitted at all.
  const introChunks: string[] = introChapter
    ? paginateText(introChapter.content ?? '')
    : []
  const hasIntro = introChunks.length > 0
  const introTitle = introChapter?.chapter_title

  // Each main chapter takes 1 spread for the image+chunk0 opener, then pairs
  // the remaining chunks across left+right of subsequent spreads.
  // ceil((N + 1) / 2) spreads. (N=1 → 1, N=2 → 2, N=3 → 2, N=4 → 3, N=5 → 3.)
  function spreadsForChapter(n: number) { return Math.ceil((n + 1) / 2) }

  // Front-matter spread layout:
  //   0 = cover
  //   1 = diamond + interior title
  //   2 = copyright + (intro chunk 0 if hasIntro, else blank)
  //   …continuation intro spreads only when hasIntro and intro is long…
  //   N = TOC
  //   N+1… = chapter spreads
  //
  // Page numbering convention — every spread has 2 pages, left=even, right=odd:
  //   spread 0 = cover                     pages 0, 1
  //   spread 1 = title                     pages 2, 3
  //   spread 2 = copyright (+ intro|blank) pages 4, 5
  //   …                                    …
  //   spread N (TOC)                       pages 2N, 2N+1
  //   spread N+k = chapter…                pages 2(N+k), 2(N+k)+1
  // pageNum = spreadIdx * 2 + (side === 'left' ? 0 : 1)
  const introContinuationSpreads = hasIntro && introChunks.length > 1
    ? Math.ceil((introChunks.length - 1) / 2)
    : 0

  // TOC sits at: cover(1) + title(1) + copyright(1) + introContinuationSpreads
  const tocSpreadIdx = 3 + introContinuationSpreads

  // First main-chapter spread starts immediately after the TOC.
  let cursor = tocSpreadIdx + 1
  const tocEntries: TocEntry[] = mainChapters.map((ch, i) => {
    const entry: TocEntry = {
      num: i + 1,
      title: ch.chapter_title,
      pageNum: cursor * 2 + 1, // chapter text starts on the right page of its first spread
    }
    cursor += spreadsForChapter(chapterChunks[i].length)
    return entry
  })

  const out: Spread[] = []

  // Spread 0 — cover. Single right page, dark canvas on left.
  out.push({
    id: 'cover',
    left:  { type: 'blank', dark: true },
    right: { type: 'cover' },
    transition: 'fade',
  })

  // Spread 1 — diamond ornament (left) + interior title page (right).
  out.push({
    id: 'front-title',
    left:  { type: 'diamond' },
    right: { type: 'interior-title' },
    transition: 'flip',
  })

  // Spread 2 — copyright (left) + introduction chunk 0 (right) when an intro
  // chapter exists, otherwise blank right.
  out.push({
    id: 'front-copyright',
    left:  { type: 'copyright' },
    right: hasIntro
      ? {
          type: 'introduction',
          sourceChapterTitle: introTitle,
          chunk: introChunks[0],
          chunkIndex: 0,
          totalChunks: introChunks.length,
        }
      : { type: 'blank' },
    transition: 'flip',
  })

  // Spreads 3..N-1 — introduction continuation, pairing chunks 1+2, 3+4, …
  // Only emitted when an intro chapter actually exists.
  if (hasIntro) {
    for (let k = 1; k < introChunks.length; k += 2) {
      out.push({
        id: `front-intro-cont-${k}`,
        left: {
          type: 'introduction',
          sourceChapterTitle: introTitle,
          chunk: introChunks[k],
          chunkIndex: k,
          totalChunks: introChunks.length,
        },
        right: introChunks[k + 1] !== undefined
          ? {
              type: 'introduction',
              sourceChapterTitle: introTitle,
              chunk: introChunks[k + 1]!,
              chunkIndex: k + 1,
              totalChunks: introChunks.length,
            }
          : { type: 'blank' },
        transition: 'flip',
      })
    }
  }

  // Spread N — TOC. Blank left, TOC right.
  out.push({
    id: 'toc',
    left:  { type: 'blank' },
    right: { type: 'toc', tocEntries },
    transition: 'flip',
  })

  // Chapters — first spread is image-left + chunk0-right (the opener). Then
  // pair remaining chunks two at a time (chunk1 left, chunk2 right; chunk3
  // left, chunk4 right; …). If a chapter has an even number of chunks, the
  // very last spread has a blank right page — unavoidable without bleeding
  // into the next chapter, but rare and limited to one half-page per chapter
  // rather than one half-page per continuation.
  let runningSpreadIdx = tocSpreadIdx + 1
  mainChapters.forEach((ch, i) => {
    const chunks = chapterChunks[i]
    // Look up by the page's actual chapter_index (which is the source-of-truth
    // identifier for framework mapping), not by position in mainChapters
    // (which can drift if the intro chapter is excluded).
    const frameworkLetter = letterByChapterIndex.get(ch.chapter_index)

    // Opener — image left, first text chunk right. Framework letter overlay
    // (if any) goes on the opener only since that's where the chapter title
    // lives.
    const openerIdx = runningSpreadIdx
    out.push({
      id:           `ch-${ch.id}-s${openerIdx}`,
      left:         { type: 'chapter-image', page: ch, num: i + 1 },
      right: {
        type:        'chapter-text',
        page:        ch,
        num:         i + 1,
        chunk:       chunks[0],
        chunkIndex:  0,
        totalChunks: chunks.length,
        pageNum:     openerIdx * 2 + 1,
        frameworkLetter,
      },
      transition:   'flip',
      chapterNum:   i + 1,
      chapterTitle: ch.chapter_title,
    })
    runningSpreadIdx++

    // Continuation spreads: pair chunks 1+2, 3+4, …
    const isFinalChapter = i === mainChapters.length - 1
    for (let k = 1; k < chunks.length; k += 2) {
      const sIdx = runningSpreadIdx
      const leftChunk = chunks[k]
      const rightChunk: string | undefined = chunks[k + 1]
      // When the chapter ends on the LEFT of this continuation spread, the
      // right slot is otherwise blank. Use that slot for an editorial pull
      // quote — except on the final chapter, where there's nothing to lead
      // into. Quote may be null if extraction hasn't run yet; the renderer
      // falls back to two gold rules in that case.
      const rightSlot: PageContent =
        rightChunk !== undefined
          ? {
              type:        'chapter-text',
              page:        ch,
              num:         i + 1,
              chunk:       rightChunk,
              chunkIndex:  k + 1,
              totalChunks: chunks.length,
              pageNum:     sIdx * 2 + 1,
            }
          : isFinalChapter
            ? { type: 'blank' }
            : { type: 'pull-quote', quote: ch.pull_quote ?? null }
      out.push({
        id:           `ch-${ch.id}-s${sIdx}`,
        left: {
          type:        'chapter-text',
          page:        ch,
          num:         i + 1,
          chunk:       leftChunk,
          chunkIndex:  k,
          totalChunks: chunks.length,
          pageNum:     sIdx * 2,
        },
        right:        rightSlot,
        transition:   'flip',
        chapterNum:   i + 1,
        chapterTitle: ch.chapter_title,
      })
      runningSpreadIdx++
    }
  })

  // Back matter — pair pages into spreads
  const bm = backMatter.filter((p) => p.content)
  for (let i = 0; i < bm.length; i += 2) {
    out.push({
      id:         `bm-${bm[i].id}`,
      left:       { type: 'back-matter', page: bm[i] },
      right:      bm[i + 1] ? { type: 'back-matter', page: bm[i + 1] } : { type: 'blank' },
      transition: 'flip',
    })
  }

  // Back cover — single left page, dark canvas on right
  out.push({
    id:    'back-cover',
    left:  { type: 'back-cover' },
    right: { type: 'blank', dark: true },
    transition: 'fade',
  })

  return out
}

// ── Inline style helpers (all colors via CSS vars) ──────────────────────────

const pageBase: React.CSSProperties = {
  width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
  userSelect: 'none',
}
const padLeft:  React.CSSProperties = { padding: '34px 24px 26px 38px' }  // outer gutter left
const padRight: React.CSSProperties = { padding: '34px 38px 26px 24px' }  // outer gutter right

// Body containers on chapter and back-matter pages use flex:1 + overflow:hidden
// to fill the page below the header. We rely on the dynamic title-height
// measurement (see useLayoutEffect below) so the paginator's per-chapter
// budget already accounts for however many lines the title wraps to —
// no bottom fade needed.

// ── Page components — zero hardcoded colour values ──────────────────────────

function BlankPage({ dark }: { dark?: boolean }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: dark ? 'var(--canvas-bg)' : 'var(--page-bg)',
    }} />
  )
}

function CoverPage({ book, profile }: { book: Book; profile: Profile | null }) {
  const author   = book.author_name || profile?.full_name || 'Author Name'
  const title    = book.title || 'Untitled'
  const subtitle = book.subtitle || null

  // With cover image: full-bleed image, title overlaid, bottom band for subtitle + author.
  // EXCEPT when book.cover_has_text is true — the user has indicated their
  // uploaded image already contains the title/subtitle/author, so we skip
  // the gradients and overlay entirely and let the artwork breathe.
  if (book.cover_image_url) {
    if (book.cover_has_text) {
      return (
        <div style={{ ...pageBase, position: 'relative', overflow: 'hidden', background: 'var(--cover-bg)' }}>
          <img
            src={book.cover_image_url}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )
    }

    return (
      <div style={{ ...pageBase, position: 'relative', overflow: 'hidden', background: 'var(--cover-bg)' }}>
        {/* Full-bleed cover image — z:1 */}
        <img
          src={book.cover_image_url}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', zIndex: 1 }}
        />
        {/* Dark gradient over top for title legibility — z:2 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.80) 0%, transparent 100%)', zIndex: 2 }} />
        {/* Dark gradient over bottom for band legibility — z:2 */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(to top, rgba(0,0,0,0.92) 10%, transparent 100%)', zIndex: 2 }} />

        {/* Logo top-left — z:3 */}
        {profile?.logo_url && (
          <img src={profile.logo_url} alt="" style={{ position: 'absolute', top: 18, left: 20, height: 20, objectFit: 'contain', opacity: 0.8, zIndex: 3 }} />
        )}

        {/* Title — top area, always rendered — z:4 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '28px 28px 0', zIndex: 4 }}>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 26,
            fontWeight: 700,
            color: '#FFFFFF',
            lineHeight: 1.15,
            margin: 0,
            textShadow: '0 2px 16px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,0.9)',
          }}>
            {title}
          </h1>
        </div>

        {/* Bottom band — subtitle + rule + author — always rendered — z:4 */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 28px 24px', zIndex: 4 }}>
          {subtitle && (
            <p style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: 10.5,
              color: 'rgba(255,255,255,0.85)',
              fontStyle: 'italic',
              margin: '0 0 10px',
              textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            }}>
              {subtitle}
            </p>
          )}
          <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,0.5)', marginBottom: 8 }} />
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 7.5,
            color: '#FFFFFF',
            fontVariant: 'small-caps',
            letterSpacing: '0.14em',
            margin: 0,
            opacity: 0.85,
            textShadow: '0 1px 4px rgba(0,0,0,0.9)',
          }}>
            {author}
          </p>
        </div>
      </div>
    )
  }

  // Without cover image: typographic cover with cover-bg
  return (
    <div style={{ ...pageBase, background: 'var(--cover-bg)', justifyContent: 'space-between', padding: '40px 36px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, right: 20, height: 1, background: 'var(--rule-color)' }} />

      {/* Top: logo */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {profile?.logo_url && (
          <img src={profile.logo_url} alt="" style={{ height: 24, objectFit: 'contain', opacity: 0.65 }} />
        )}
      </div>

      {/* Middle: title + subtitle */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 2, background: 'var(--cover-band)', margin: '0 auto 18px' }} />
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 700, color: 'var(--cover-text)', lineHeight: 1.15, margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 11, color: 'var(--accent)', fontStyle: 'italic', marginTop: 10, marginBottom: 0 }}>
            {subtitle}
          </p>
        )}
        <div style={{ width: 32, height: 2, background: 'var(--cover-band)', margin: '18px auto 0' }} />
      </div>

      {/* Bottom: author — always rendered */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: 'var(--cover-text)', opacity: 0.6, fontVariant: 'small-caps', letterSpacing: '0.14em', margin: 0 }}>
          {author}
        </p>
      </div>

      <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, height: 1, background: 'var(--rule-color)' }} />
    </div>
  )
}

// Resolve the publisher imprint with the spec's fallback chain — brand
// profile's display name first, then the LaunchBox.Media default.
function resolveImprint(profile: Profile | null): string {
  return profile?.full_name?.trim() || 'LaunchBox.Media'
}

function bookYear(book: Book): number {
  const created = book.created_at ? new Date(book.created_at) : null
  if (created && !Number.isNaN(created.getTime())) return created.getFullYear()
  return new Date().getFullYear()
}

function DiamondOrnament() {
  return (
    <div style={{
      ...pageBase,
      background: 'var(--page-bg)',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* A small rotated square in the accent colour — quiet enough to read
          as a typographic flourish, not a feature. */}
      <div
        aria-hidden="true"
        style={{
          width: 12,
          height: 12,
          transform: 'rotate(45deg)',
          background: 'var(--accent)',
          opacity: 0.5,
        }}
      />
    </div>
  )
}

function InteriorTitlePage({ book, profile }: { book: Book; profile: Profile | null }) {
  const title    = book.title || 'Untitled'
  const subtitle = book.subtitle || null
  const author   = book.author_name || profile?.full_name || null
  const imprint  = resolveImprint(profile)

  return (
    <div style={{
      ...pageBase,
      ...padRight,
      background: 'var(--page-bg)',
      alignItems: 'center',
      justifyContent: 'space-between',
      textAlign: 'center',
      padding: '60px 36px 36px',
    }}>
      {/* Top spacer */}
      <div style={{ flex: 1 }} />

      {/* Centre block — title + subtitle + rule + author */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 280 }}>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 30,
          fontWeight: 700,
          color: 'var(--page-text)',
          lineHeight: 1.15,
          margin: 0,
          letterSpacing: '-0.005em',
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            fontFamily: 'var(--body-font)',
            fontSize: 12,
            fontStyle: 'italic',
            color: 'var(--page-text)',
            opacity: 0.7,
            lineHeight: 1.4,
            margin: 0,
          }}>
            {subtitle}
          </p>
        )}
        <div style={{ width: 36, height: 1, background: 'var(--accent)', marginTop: 12, marginBottom: 6 }} />
        {author && (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 9,
            color: 'var(--page-text)',
            fontVariant: 'small-caps',
            letterSpacing: '0.18em',
            margin: 0,
          }}>
            {author}
          </p>
        )}
      </div>

      {/* Bottom spacer + imprint */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%' }}>
        <p style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 8,
          color: 'var(--page-text)',
          opacity: 0.5,
          fontVariant: 'small-caps',
          letterSpacing: '0.18em',
          margin: 0,
        }}>
          {imprint}
        </p>
      </div>
    </div>
  )
}

function CopyrightPage({ book, profile }: { book: Book; profile: Profile | null }) {
  const author  = book.author_name || profile?.full_name || 'Author'
  const year    = bookYear(book)
  const imprint = resolveImprint(profile)

  // Sections rendered in order, separated by an em-dash rule.
  const sections: string[] = [
    imprint,
    'An Imprint of FlipBookPro',
    `Copyright © ${year} ${author}`,
    'All rights reserved including the right to reproduce this book or portions thereof in any form whatsoever.',
    'Generated with AI assistance by FlipBookPro — LaunchBox.Media',
    `First FlipBookPro edition ${year}`,
  ]

  return (
    <div style={{
      ...pageBase,
      ...padLeft,
      background: 'var(--page-bg)',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '80px 36px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 270 }}>
        {sections.map((line, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {i > 0 && (
              <span
                aria-hidden="true"
                style={{
                  fontFamily: "'Source Serif 4', Georgia, serif",
                  fontSize: 10,
                  color: 'var(--page-text)',
                  opacity: 0.35,
                  margin: '10px 0',
                  lineHeight: 1,
                }}
              >
                —
              </span>
            )}
            <p style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: 10,
              color: 'var(--page-text)',
              lineHeight: 1.55,
              margin: 0,
              opacity: i === 0 ? 0.95 : 0.78,
              fontWeight: i === 0 ? 600 : 400,
              letterSpacing: i === 0 ? '0.05em' : 0,
              textTransform: i === 0 ? 'uppercase' : 'none',
            }}>
              {line}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function IntroductionPage({
  sourceChapterTitle, chunk, chunkIndex, side,
}: {
  sourceChapterTitle?: string
  chunk: string
  chunkIndex: number
  side: 'left' | 'right'
}) {
  const paras = chunk.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
  const hasContent = chunk.length > 0
  const pad = side === 'left' ? padLeft : padRight
  // First chunk only gets the heading. Continuation chunks flow plain so the
  // intro reads as one continuous block of prose across spreads.
  const showHeading = chunkIndex === 0

  return (
    <div style={{ ...pageBase, ...pad, background: 'var(--page-bg)' }}>
      {showHeading && (
        <div style={{ flexShrink: 0, marginBottom: 14 }}>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 7.5,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--chapter-num-color)',
            display: 'block',
            marginBottom: 4,
          }}>
            {sourceChapterTitle ? sourceChapterTitle : 'Begin'}
          </span>
          <div style={{ width: 22, height: 2, background: 'var(--accent)' }} />
        </div>
      )}

      <div style={{
        flex: 1,
        overflow: 'hidden',
        fontFamily: 'var(--body-font)',
        fontSize: 'var(--body-size)',
        color: 'var(--page-text)',
        lineHeight: 'var(--line-height)',
      }}>
        {!hasContent ? (
          <p style={{ color: 'var(--page-text-muted)', fontStyle: 'italic', margin: 0 }}>
            (Introduction not yet written.)
          </p>
        ) : (
          paras.map((p, i) => <p key={i} style={{ margin: '0 0 0.8em' }}>{p}</p>)
        )}
      </div>
    </div>
  )
}

function TocPage({ entries }: { entries: TocEntry[] }) {
  return (
    <div style={{ ...pageBase, ...padRight, background: 'var(--page-bg)' }}>
      <h2 style={{ fontFamily: 'var(--heading-font)', fontSize: 'var(--heading-size)', fontWeight: 700, color: 'var(--page-text)', margin: '0 0 6px' }}>
        Contents
      </h2>
      <div style={{ width: 22, height: 2, background: 'var(--accent)', marginBottom: 18 }} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {entries.map((entry) => (
          <div key={entry.num} style={{ display: 'flex', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid var(--accent-subtle)' }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 7.5, color: 'var(--chapter-num-color)', minWidth: 14, flexShrink: 0 }}>
              {entry.num}
            </span>
            <span style={{ fontFamily: 'var(--body-font)', fontSize: 9.5, color: 'var(--page-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: 4 }}>
              {entry.title}
            </span>
            {/* Dotted leader */}
            <span style={{ flex: 1, borderBottom: '1px dotted var(--accent-subtle)', marginBottom: '0.25em', flexShrink: 1, minWidth: 8 }} />
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 7.5, color: 'var(--chapter-num-color)', marginLeft: 4, flexShrink: 0 }}>
              {entry.pageNum}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChapterImagePage({ page }: { page: BookPage; num: number }) {
  // Full-bleed art on the left page. Chapter images are generated at 16:9
  // and the page is portrait (400×550, ~3:4), so contain leaves a thumbnail
  // floating in dark canvas. cover + inset:0 fills the page and trims the
  // landscape sides — the trade-off is intentional and what "fills the
  // page" actually means here.
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--canvas-bg)',
        overflow: 'hidden',
      }}
    >
      {page.image_url
        ? <img
            src={page.image_url}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        : <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--accent-subtle)',
            }}
          />
      }
    </div>
  )
}

/** Render either an AcronymBlock or a plain paragraph. Used by both the
 *  chapter text page and (in spirit) the HTML export. */
function ParagraphOrAcronym({
  text, withDropCap,
}: {
  text: string
  withDropCap?: boolean
}) {
  const acronym = detectAcronymBlock(text)
  if (acronym) return <AcronymBlock entries={acronym} />
  if (withDropCap) {
    return (
      <p style={{ margin: '0 0 0.8em' }}>
        <span style={{ float: 'left', fontFamily: 'var(--heading-font)', fontSize: 'var(--drop-cap-size)', fontWeight: 700, lineHeight: 0.78, marginRight: '0.05em', marginTop: '0.1em', color: 'var(--drop-cap-color)' }}>
          {text[0]}
        </span>
        {text.slice(1)}
      </p>
    )
  }
  return <p style={{ margin: '0 0 0.8em' }}>{text}</p>
}

function AcronymBlock({ entries }: { entries: AcronymEntry[] }) {
  return (
    <div style={{ margin: '0.4em 0 1.1em', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700,
            fontSize: 26,
            color: 'var(--accent)',
            lineHeight: 1,
            width: '1.15em',
            flexShrink: 0,
            textAlign: 'center',
          }}>
            {entry.letter}
          </span>
          <span style={{
            fontFamily: 'var(--body-font)',
            fontSize: 'var(--body-size)',
            color: 'var(--page-text)',
            lineHeight: 1.45,
          }}>
            {entry.definition}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChapterTextPage({
  page, num, chunk, chunkIndex, totalChunks, pageNum, side, frameworkLetter,
}: {
  page: BookPage
  num: number
  chunk: string
  chunkIndex: number
  totalChunks: number
  pageNum: number
  side: 'left' | 'right'
  frameworkLetter?: string
}) {
  const isFirstChunk = chunkIndex === 0 // always rendered on the right page
  const paras = chunk.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
  const [first, ...rest] = paras
  const hasContent = chunk.length > 0
  // Outer gutter follows side: padLeft has the wider margin on the left
  // (away from the spine), padRight on the right. Page numbers also pin to
  // the outer corner so the spread feels balanced.
  const pad = side === 'left' ? padLeft : padRight
  const numAlign: React.CSSProperties['textAlign'] = side === 'left' ? 'left' : 'right'
  // The drop cap on the first chunk's first paragraph is suppressed when
  // that paragraph is itself an acronym block — no leading character to
  // letter-set.
  const firstIsAcronym = !!first && !!detectAcronymBlock(first)

  return (
    <div style={{ ...pageBase, ...pad, background: 'var(--page-bg)', position: 'relative' }}>
      {/* Decorative framework letter — only on the chapter opener (first
          chunk, right page) when the chapter maps to a framework step. 80px
          gold Playfair, top-right corner, partially overlapping the chapter
          title area below. pointer-events:none so it never blocks clicks. */}
      {isFirstChunk && frameworkLetter && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 18,
            right: 26,
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 80,
            fontWeight: 700,
            color: 'var(--accent)',
            opacity: 0.85,
            lineHeight: 1,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          {frameworkLetter}
        </span>
      )}

      {/* Header — full chapter title + accent rule on first page; smaller
          continuation header ("Chapter N · cont.") on overflow pages so the
          reader keeps context without the title eating a third of the page. */}
      {isFirstChunk ? (
        <div style={{ flexShrink: 0, marginBottom: 16, position: 'relative', zIndex: 3 }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 7.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--chapter-num-color)', display: 'block', marginBottom: 3 }}>
            Chapter {num}
          </span>
          <h2 style={{ fontFamily: 'var(--heading-font)', fontSize: 'var(--heading-size)', fontWeight: 700, color: 'var(--page-text)', lineHeight: 1.2, margin: '0 0 9px', /* leave room for the framework letter overlay so the title doesn't visually collide with it */ paddingRight: frameworkLetter ? 60 : 0 }}>
            {page.chapter_title}
          </h2>
          <div style={{ width: 22, height: 2, background: 'var(--accent)' }} />
        </div>
      ) : (
        <div style={{ flexShrink: 0, marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 7, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--chapter-num-color)' }}>
            Chapter {num}
          </span>
          <span style={{ fontFamily: 'var(--body-font)', fontStyle: 'italic', fontSize: 9, color: 'var(--page-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {page.chapter_title}
          </span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 7, color: 'var(--page-text-muted)', flexShrink: 0 }}>
            {chunkIndex + 1} / {totalChunks}
          </span>
        </div>
      )}

      {/* Body. Hard-clips overflow at the bottom edge — the per-chapter
          paginator budget (computed from a measured title height) is
          sized so partial lines essentially never occur, so a clean
          clip is fine. */}
      <div style={{ flex: 1, overflow: 'hidden', fontFamily: 'var(--body-font)', fontSize: 'var(--body-size)', color: 'var(--page-text)', lineHeight: 'var(--line-height)', position: 'relative', zIndex: 3 }}>
        {!hasContent ? (
          <p style={{ color: 'var(--page-text-muted)', fontStyle: 'italic', margin: 0 }}>Chapter not yet written.</p>
        ) : isFirstChunk ? (
          <>
            {first && (
              <ParagraphOrAcronym text={first} withDropCap={!firstIsAcronym} />
            )}
            {rest.map((p, i) => <ParagraphOrAcronym key={i} text={p} />)}
          </>
        ) : (
          // Continuation page — no drop cap, paragraphs flow normally.
          paras.map((p, i) => <ParagraphOrAcronym key={i} text={p} />)
        )}
      </div>

      {/* Page number — pinned to the outer corner of the spread */}
      <div style={{ flexShrink: 0, textAlign: numAlign, fontFamily: "'Inter', sans-serif", fontSize: 8, color: 'var(--page-text-muted)', paddingTop: 6, position: 'relative', zIndex: 3 }}>
        {pageNum}
      </div>
    </div>
  )
}

/** Centred italic pull quote bracketed by two thin gold rules. Renders on
 *  the right page of a continuation spread when a chapter ends on the LEFT
 *  and would otherwise leave the right blank. With NULL quote we still emit
 *  the two rules — a quieter, deliberate spread is better than a blank one. */
function PullQuotePage({ quote }: { quote: string | null }) {
  return (
    <div
      style={{
        ...pageBase,
        background: 'var(--page-bg)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 36px',
      }}
    >
      <div style={{ width: '4rem', height: 1, background: 'var(--accent)' }} />
      {quote && (
        <blockquote
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 18,
            lineHeight: 1.6,
            color: 'var(--page-text)',
            textAlign: 'center',
            maxWidth: '75%',
            margin: '20px 0',
            padding: 0,
          }}
        >
          {quote}
        </blockquote>
      )}
      {!quote && <div style={{ height: 40 }} />}
      <div style={{ width: '4rem', height: 1, background: 'var(--accent)' }} />
    </div>
  )
}

function BackMatterPage({ page, side }: { page: BookPage; side: 'left' | 'right' }) {
  const pad = side === 'left' ? padLeft : padRight
  const paras = (page.content ?? '').split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
  return (
    <div style={{ ...pageBase, ...pad, background: 'var(--page-bg)' }}>
      <h2 style={{ fontFamily: 'var(--heading-font)', fontSize: 'var(--heading-size)', fontWeight: 700, color: 'var(--page-text)', margin: '0 0 7px', lineHeight: 1.2 }}>
        {page.chapter_title}
      </h2>
      <div style={{ width: 22, height: 2, background: 'var(--accent)', marginBottom: 16, flexShrink: 0 }} />
      <div style={{ flex: 1, overflow: 'hidden', fontFamily: 'var(--body-font)', fontSize: 'var(--body-size)', color: 'var(--page-text)', lineHeight: 'var(--line-height)' }}>
        {paras.map((p, i) => <p key={i} style={{ margin: '0 0 0.8em' }}>{p}</p>)}
      </div>
    </div>
  )
}

function BackCoverPage({ book, profile }: { book: Book; profile: Profile | null }) {
  const author = book.author_name || profile?.full_name || null
  const tagline = book.back_cover_tagline || book.subtitle || null
  const description = book.back_cover_description || null
  const ctaText = book.back_cover_cta_text || null
  const ctaUrl  = book.back_cover_cta_url  || null
  const backImage = book.back_cover_image_url || null

  return (
    <div style={{ ...pageBase, background: 'var(--back-cover-bg)', position: 'relative', padding: '44px 36px', justifyContent: 'space-between', overflow: 'hidden' }}>
      {/* Optional uploaded back-cover image — sits behind everything with a
          dark gradient overlay so the text stays readable. */}
      {backImage && (
        <>
          <img
            src={backImage}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.78) 100%)',
              zIndex: 1,
            }}
          />
        </>
      )}

      {/* Top rule */}
      <div style={{ position: 'absolute', top: 20, left: 20, right: 20, height: 1, background: 'var(--rule-color)', opacity: 0.5, zIndex: 2 }} />

      {/* Top spacer */}
      <div style={{ position: 'relative', zIndex: 2 }} />

      {/* Centre content */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', padding: '0 8px' }}>
        {tagline && (
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 17,
            fontWeight: 700,
            color: '#FFFFFF',
            lineHeight: 1.25,
            margin: 0,
          }}>
            {tagline}
          </h2>
        )}
        {description && (
          <p style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            fontSize: 10,
            color: 'rgba(255,255,255,0.70)',
            lineHeight: 1.65,
            margin: 0,
          }}>
            {description}
          </p>
        )}
        {ctaText && ctaUrl && (
          <div style={{
            marginTop: 6,
            display: 'inline-block',
            background: 'var(--accent)',
            color: '#FFFFFF',
            fontFamily: "'Inter', sans-serif",
            fontSize: 8.5,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '7px 18px',
            borderRadius: 4,
          }}>
            {ctaText}
          </div>
        )}
      </div>

      {/* Bottom: author + logo */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {author ? (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 7,
            color: 'var(--cover-text)',
            fontVariant: 'small-caps',
            letterSpacing: '0.14em',
            opacity: 0.5,
            margin: 0,
          }}>
            {author}
          </p>
        ) : <span />}
        {profile?.logo_url && (
          <img src={profile.logo_url} alt="" style={{ height: 16, objectFit: 'contain', opacity: 0.35 }} />
        )}
      </div>

      {/* Bottom rule */}
      <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, height: 1, background: 'var(--rule-color)', opacity: 0.5, zIndex: 2 }} />
    </div>
  )
}

// ── Page dispatcher ─────────────────────────────────────────────────────────

function Page({
  content, side, book, profile,
}: {
  content: PageContent
  side: 'left' | 'right'
  book: Book
  profile: Profile | null
}) {
  switch (content.type) {
    case 'blank':            return <BlankPage dark={content.dark} />
    case 'cover':            return <CoverPage book={book} profile={profile} />
    case 'diamond':          return <DiamondOrnament />
    case 'interior-title':   return <InteriorTitlePage book={book} profile={profile} />
    case 'copyright':        return <CopyrightPage book={book} profile={profile} />
    case 'introduction':     return (
      <IntroductionPage
        sourceChapterTitle={content.sourceChapterTitle}
        chunk={content.chunk}
        chunkIndex={content.chunkIndex}
        side={side}
      />
    )
    case 'toc':              return <TocPage entries={content.tocEntries} />
    case 'chapter-image':    return <ChapterImagePage page={content.page} num={content.num} />
    case 'chapter-text':  return (
      <ChapterTextPage
        page={content.page}
        num={content.num}
        chunk={content.chunk}
        chunkIndex={content.chunkIndex}
        totalChunks={content.totalChunks}
        pageNum={content.pageNum}
        side={side}
        frameworkLetter={content.frameworkLetter}
      />
    )
    case 'back-matter':   return <BackMatterPage   page={content.page} side={side} />
    case 'back-cover':    return <BackCoverPage book={book} profile={profile} />
    case 'pull-quote':    return <PullQuotePage quote={content.quote} />
  }
}

// ── Spine shadow overlay ────────────────────────────────────────────────────

function Spine() {
  return (
    <div style={{
      position: 'absolute', left: PW, top: 0, width: SW, height: PH, zIndex: 20,
      background: 'linear-gradient(to right, var(--spine-start), var(--spine-end))',
      boxShadow: '0 0 12px rgba(0,0,0,0.5)',
      pointerEvents: 'none',
    }} />
  )
}

// ── Edge shadow applied over a page face ────────────────────────────────────
// Simulates depth as the page lifts; direction = which edge the shadow falls on

function EdgeShadow({ edge }: { edge: 'left' | 'right' }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: edge === 'right'
        ? 'linear-gradient(to left,  rgba(0,0,0,0.18) 0%, transparent 35%)'
        : 'linear-gradient(to right, rgba(0,0,0,0.18) 0%, transparent 35%)',
    }} />
  )
}

// ── Main component ──────────────────────────────────────────────────────────

function ExportMenu({ bookId }: { bookId: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOut)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOut)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 text-sm font-inter text-muted-foreground hover:text-accent transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-2xl py-1 z-50"
        >
          <a
            href={`/api/books/${bookId}/export-html`}
            role="menuitem"
            className="flex items-center gap-3 px-3 py-2 text-sm font-inter text-cream/80 hover:bg-[#2A2A2A] hover:text-cream transition-colors"
            onClick={() => setOpen(false)}
          >
            <FileText className="w-4 h-4 text-gold/70" />
            <div className="flex-1">
              <p className="leading-tight">HTML</p>
              <p className="text-[10px] text-muted-foreground">Standalone web page</p>
            </div>
          </a>
          <a
            href={`/api/books/${bookId}/export-pdf`}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className="flex items-center gap-3 px-3 py-2 text-sm font-inter text-cream/80 hover:bg-[#2A2A2A] hover:text-cream transition-colors"
            onClick={() => setOpen(false)}
          >
            <Printer className="w-4 h-4 text-gold/70" />
            <div className="flex-1">
              <p className="leading-tight">PDF</p>
              <p className="text-[10px] text-muted-foreground">Opens print dialog · Save as PDF</p>
            </div>
          </a>
        </div>
      )}
    </div>
  )
}

/** Render a hidden div with the real chapter-title styles and return its
 *  measured pixel height. Mirrors the inline styles on the <h2> in
 *  ChapterTextPage — same font, size, weight, line-height, margins, and
 *  available width (which differs for framework chapters because the
 *  letter overlay takes 60px on the right). The paginator uses this to
 *  size the first-chunk body budget per chapter, so titles that wrap to
 *  2/3/4 lines no longer smuggle extra header chrome past a static
 *  budget. */
function measureTitleHeight(
  title: string,
  width: number,
  fontFamily: string,
  fontSize: string,
): number {
  if (!title.trim() || typeof document === 'undefined') return 0
  const el = document.createElement('div')
  el.style.cssText = [
    'position: absolute',
    'top: -10000px',
    'left: 0',
    `width: ${width}px`,
    `font-family: ${fontFamily}`,
    `font-size: ${fontSize}`,
    'font-weight: 700',
    'line-height: 1.2',
    'margin: 0',
    'padding: 0',
    'visibility: hidden',
    'pointer-events: none',
    // Mirror the renderer's wrap behaviour — no special hyphenation or
    // overflow, just plain text wrapping at the given width.
    'word-wrap: break-word',
    'white-space: normal',
  ].join('; ')
  el.textContent = title
  document.body.appendChild(el)
  const h = el.getBoundingClientRect().height
  document.body.removeChild(el)
  return h
}

export function FlipbookViewer({ book, chapters, backMatter, theme, profile, isPublicView = false }: FlipbookViewerProps) {
  // Measured chunks per chapter id. Initially null — the first paint uses
  // the heuristic paginator (paginateText). Once useLayoutEffect runs, we
  // populate this map with pixel-measured splits and re-render with the
  // accurate chunks before the user sees the heuristic version.
  const [measuredChunks, setMeasuredChunks] = useState<Map<string, string[]> | null>(null)

  // Body geometry — width is symmetric (page width minus the wider outer
  // gutter plus narrower spine gutter, 38+24=62). The continuation body
  // budget stays static because the continuation header is a single
  // compact row whose height doesn't vary with title length. The
  // first-chunk budget is computed per chapter inside the layout effect
  // below — we measure the rendered title height with the real heading
  // font/size so a 3-line title doesn't smuggle ~50px of extra header
  // chrome past a static budget.
  const BODY_WIDTH       = PW - 62
  const CONT_BODY_HEIGHT = 415

  // Re-measure whenever chapters, framework data, or the active theme
  // changes. useLayoutEffect runs synchronously after DOM commit but
  // before browser paint, so the user sees the measured chunks on the
  // first visible frame instead of a heuristic-then-measured flash.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return

    const fontFamily =
      theme.vars['--body-font'] ??
      "'Source Serif 4', Georgia, serif"
    const fontSize   = theme.vars['--body-size']   ?? '13px'
    const lineHeight = theme.vars['--line-height'] ?? '1.75'

    const headingFamily =
      theme.vars['--heading-font'] ??
      "'Playfair Display', Georgia, serif"
    const headingSize   = theme.vars['--heading-size'] ?? '20px'

    // Framework letter map — when a chapter maps to a framework step the
    // title gets paddingRight: 60 (room for the 80pt gold letter overlay),
    // which narrows the wrap width and pushes longer titles to extra
    // lines. The title measurer needs to honour the same width.
    const letterByChapterIndex = new Map<number, true>()
    if (book.framework_data?.steps) {
      for (const step of book.framework_data.steps) {
        if (typeof step.chapter_index === 'number' && step.letter) {
          letterByChapterIndex.set(step.chapter_index, true)
        }
      }
    }

    // Page geometry breakdown (PH=550):
    //   - 60px page padding (34 top + 26 bottom)
    //   - 13px label ("Chapter N" small-caps) + 3px margin = 16px above title
    //   - 9px margin after title + 2px accent rule + 16px margin before body = 27px below title
    //   - ~20px page-number footer at the bottom
    // → fixed header/footer chrome around the variable title: 16 + 27 + 20 = 63px
    // → inner content height available for [title + body]: PH - 60 = 490px
    // → firstBody = 490 - 63 - measuredTitleHeight - safety
    const INNER_HEIGHT      = PH - 60
    const FIXED_CHROME      = 63
    const FIRST_PAGE_SAFETY = 20
    const FIRST_PAGE_MIN    = 140  // never less than ~6 lines, even for absurdly long titles

    const map = new Map<string, string[]>()
    for (const ch of chapters) {
      if (!ch.content || !ch.content.trim()) continue

      const hasFrameworkLetter = letterByChapterIndex.has(ch.chapter_index)
      const titleWidth         = BODY_WIDTH - (hasFrameworkLetter ? 60 : 0)
      const titleHeight        = measureTitleHeight(
        ch.chapter_title || '',
        titleWidth,
        headingFamily,
        headingSize,
      )

      const firstPageHeight = Math.max(
        FIRST_PAGE_MIN,
        INNER_HEIGHT - FIXED_CHROME - titleHeight - FIRST_PAGE_SAFETY,
      )

      try {
        const chunks = paginateMeasured(ch.content, {
          bodyWidth:          BODY_WIDTH,
          firstPageHeight,
          continuationHeight: CONT_BODY_HEIGHT,
          fontFamily,
          fontSize,
          lineHeight,
        })
        map.set(ch.id, chunks)
      } catch {
        // Measurement failure → leave the chapter to fall back to paginateText.
      }
    }
    setMeasuredChunks(map)
  }, [chapters, theme, book.framework_data])

  const spreads = useMemo(
    () => buildSpreads(chapters, backMatter, book.framework_data ?? null, measuredChunks),
    [chapters, backMatter, book.framework_data, measuredChunks],
  )

  const [spreadIdx, setSpreadIdx] = useState(0)
  const [flipState, setFlipState] = useState<FlipState | null>(null)
  const [fadeState, setFadeState] = useState<FadeState | null>(null)
  const [fadingOut, setFadingOut] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(1024)

  const flipCardRef  = useRef<HTMLDivElement>(null)
  const touchStartX  = useRef(0)
  const busy = flipState !== null || fadeState !== null

  // Track viewport for responsive scaling
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Mobile: below 480px = single page view; below 848px = scale transform
  const isSinglePage = viewportWidth < 480
  const needsScale = viewportWidth < BW + 40
  const scale = needsScale ? Math.min(1, (viewportWidth - 32) / (isSinglePage ? PW : BW)) : 1

  // Load Google Fonts once
  useEffect(() => {
    const link = document.createElement('link')
    link.rel  = 'stylesheet'
    link.href = theme.googleFontsUrl
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [theme.googleFontsUrl])

  // ── Flip animation ────────────────────────────────────────────────────────
  // When flipState is set, flipCardRef points to the newly mounted flip card.
  // We snap it to 0deg (no transition) then animate to ±180deg.
  // At completion: commit new spreadIdx, clear flipState.
  useEffect(() => {
    if (!flipState) return
    const el = flipCardRef.current
    if (!el) return

    const end = flipState.forward ? -180 : 180

    el.style.transition = 'none'
    el.style.transform  = 'rotateY(0deg)'

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.65s cubic-bezier(0.645,0.045,0.355,1.000)'
        el.style.transform  = `rotateY(${end}deg)`
      })
    })

    const t = setTimeout(() => {
      setSpreadIdx(flipState.toIdx)
      setFlipState(null)
    }, 650)

    return () => clearTimeout(t)
  }, [flipState])

  // ── Fade animation ────────────────────────────────────────────────────────
  // Immediately swap spreadIdx (base renders new content).
  // Overlay renders old content at opacity 1, then fades to 0.
  const startFade = useCallback((fromIdx: number, toIdx: number) => {
    setFadeState({ fromIdx, toIdx })
    setSpreadIdx(toIdx)               // base flips to new spread immediately
    // Two rAFs ensure overlay starts at opacity:1 before we trigger the CSS transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFadingOut(true))
    })
  }, [])

  useEffect(() => {
    if (!fadeState) return
    const t = setTimeout(() => {
      setFadeState(null)
      setFadingOut(false)
    }, 340)
    return () => clearTimeout(t)
  }, [fadeState])

  // ── Navigation ────────────────────────────────────────────────────────────
  const goTo = useCallback((newIdx: number) => {
    if (busy) return
    if (newIdx < 0 || newIdx >= spreads.length) return

    const from = spreads[spreadIdx]
    const to   = spreads[newIdx]

    if (from.transition === 'fade' || to.transition === 'fade') {
      startFade(spreadIdx, newIdx)
    } else {
      setFlipState({ fromIdx: spreadIdx, toIdx: newIdx, forward: newIdx > spreadIdx })
    }
  }, [busy, spreads, spreadIdx, startFade])

  const next = useCallback(() => goTo(spreadIdx + 1), [goTo, spreadIdx])
  const prev = useCallback(() => goTo(spreadIdx - 1), [goTo, spreadIdx])

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown')  { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')    { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [next, prev])

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    if (dx >  60) next()
    if (dx < -60) prev()
  }

  // Chapter dropdown data
  const chapterItems = useMemo(
    () => spreads.flatMap((s, i) => s.chapterNum ? [{ idx: i, num: s.chapterNum, title: s.chapterTitle ?? '' }] : []),
    [spreads],
  )

  // Page helpers
  const pageProps = { book, profile }
  const cur = spreads[spreadIdx]

  const faceStyle: React.CSSProperties = {
    position: 'absolute', inset: 0,
    backfaceVisibility:         'hidden',
    WebkitBackfaceVisibility:   'hidden' as never,
    overflow: 'hidden',
  }

  return (
    // CSS variable injection wrapper — all descendant colours resolve via var(--*)
    <div
      style={{ ...(theme.vars as React.CSSProperties), background: 'var(--canvas-bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="h-11 border-b border-[#2A2A2A] flex items-center justify-between px-5 shrink-0 bg-[var(--canvas-bg)]">
        {isPublicView ? (
          <span className="font-playfair text-sm text-cream/60 truncate max-w-[160px]">{book.title}</span>
        ) : (
          <Link href={`/book/${book.id}/coauthor`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-cream font-inter transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Editor
          </Link>
        )}

        <div className="flex items-center gap-3">
          {chapterItems.length > 0 && (
            <select
              value={spreadIdx}
              onChange={(e) => goTo(Number(e.target.value))}
              disabled={busy}
              className="bg-[#2A2A2A] text-cream/70 text-xs font-inter border border-[#333] rounded px-2 py-1 focus:outline-none focus:border-[#555] disabled:opacity-50"
            >
              <option value={1}>Table of Contents</option>
              {chapterItems.map((c) => (
                <option key={c.idx} value={c.idx}>Ch. {c.num} — {c.title}</option>
              ))}
            </select>
          )}
          {!isPublicView && <span className="font-playfair text-sm text-cream/80 truncate max-w-[180px] hidden sm:block">{book.title}</span>}
        </div>

        {isPublicView ? <div className="w-16" /> : (
          <ExportMenu bookId={book.id} />
        )}
      </header>

      {/* ── Book stage ──────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{ background: 'var(--canvas-bg)', padding: '32px 0' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Responsive wrapper — scales down on narrow viewports */}
        <div style={{
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top center',
          width: isSinglePage ? PW : BW,
          height: PH,
          position: 'relative',
        }}>
        {/* Drop shadow sits behind the 3D perspective container */}
        <div style={{ position: 'relative', width: isSinglePage ? PW : BW, height: PH }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '0 2px 2px 0',
            boxShadow: '0 28px 70px rgba(0,0,0,0.65), 4px 0 16px rgba(0,0,0,0.4)',
            zIndex: -1,
          }} />

          {/*
           * Perspective container — overflow:visible so the flip card can sweep
           * from the right half into the left half (forward) or vice-versa.
           * perspective is set HERE (on the parent), NOT on the animated element.
           */}
          <div style={{ position: 'relative', width: BW, height: PH, perspective: '2000px', overflow: 'visible' }}>

            {/* ── BASE SPREAD — always rendered (z:1) ────────────────── */}
            {isSinglePage ? (
              /* Mobile single-page: show right page first, then left on "back" */
              <div style={{ position: 'absolute', left: 0, top: 0, width: PW, height: PH, overflow: 'hidden', zIndex: 1 }}>
                <Page content={cur.right.type !== 'blank' ? cur.right : cur.left} side="right" {...pageProps} />
              </div>
            ) : (
              <>
                <div style={{ position: 'absolute', left: 0,  top: 0, width: PW, height: PH, overflow: 'hidden', zIndex: 1 }}>
                  <Page content={cur.left} side="left" {...pageProps} />
                </div>
                <div style={{ position: 'absolute', left: PW, top: 0, width: PW, height: PH, overflow: 'hidden', zIndex: 1 }}>
                  <Page content={cur.right} side="right" {...pageProps} />
                </div>
              </>
            )}

            {/* ── FORWARD FLIP (right page pivots from left/spine edge) ── */}
            {flipState?.forward && (() => {
              const from = spreads[flipState.fromIdx]
              const to   = spreads[flipState.toIdx]
              return (
                <>
                  {/* Destination right page underneath the flip card */}
                  <div style={{ position: 'absolute', left: PW, top: 0, width: PW, height: PH, overflow: 'hidden', zIndex: 2 }}>
                    <Page content={to.right} side="right" {...pageProps} />
                  </div>

                  {/* Flip card: starts in right area, sweeps to left area at -180° */}
                  <div
                    ref={flipCardRef}
                    style={{
                      position: 'absolute', left: PW, top: 0, width: PW, height: PH,
                      transformOrigin: 'left center',
                      transformStyle:  'preserve-3d',
                      zIndex: 3,
                    }}
                  >
                    {/* Front — departing right page */}
                    <div style={faceStyle}>
                      <Page content={from.right} side="right" {...pageProps} />
                      <EdgeShadow edge="right" />
                    </div>
                    {/* Back — arriving left page of next spread */}
                    <div style={{ ...faceStyle, transform: 'rotateY(180deg)' }}>
                      <Page content={to.left} side="left" {...pageProps} />
                      <EdgeShadow edge="left" />
                    </div>
                  </div>
                </>
              )
            })()}

            {/* ── BACKWARD FLIP (left page pivots from right/spine edge) ── */}
            {flipState && !flipState.forward && (() => {
              const from = spreads[flipState.fromIdx]
              const to   = spreads[flipState.toIdx]
              return (
                <>
                  {/* Destination left page underneath the flip card */}
                  <div style={{ position: 'absolute', left: 0, top: 0, width: PW, height: PH, overflow: 'hidden', zIndex: 2 }}>
                    <Page content={to.left} side="left" {...pageProps} />
                  </div>

                  {/* Flip card: starts in left area, sweeps to right area at +180° */}
                  <div
                    ref={flipCardRef}
                    style={{
                      position: 'absolute', left: 0, top: 0, width: PW, height: PH,
                      transformOrigin: 'right center',
                      transformStyle:  'preserve-3d',
                      zIndex: 3,
                    }}
                  >
                    {/* Front — departing left page */}
                    <div style={faceStyle}>
                      <Page content={from.left} side="left" {...pageProps} />
                      <EdgeShadow edge="left" />
                    </div>
                    {/* Back — arriving right page of previous spread */}
                    <div style={{ ...faceStyle, transform: 'rotateY(180deg)' }}>
                      <Page content={to.right} side="right" {...pageProps} />
                      <EdgeShadow edge="right" />
                    </div>
                  </div>
                </>
              )
            })()}

            {/* ── FADE OVERLAY (cover / back-cover transitions) ───────── */}
            {fadeState && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 4,
                opacity:    fadingOut ? 0 : 1,
                transition: 'opacity 0.32s ease-in-out',
                pointerEvents: 'none',
              }}>
                <div style={{ position: 'absolute', left: 0,  top: 0, width: PW, height: PH, overflow: 'hidden' }}>
                  <Page content={spreads[fadeState.fromIdx].left} side="left" {...pageProps} />
                </div>
                <div style={{ position: 'absolute', left: PW, top: 0, width: PW, height: PH, overflow: 'hidden' }}>
                  <Page content={spreads[fadeState.fromIdx].right} side="right" {...pageProps} />
                </div>
              </div>
            )}

            {/* ── SPINE — always on top ────────────────────────────────── */}
            {!isSinglePage && <Spine />}
          </div>
        </div>
        </div>{/* close responsive wrapper */}

        {/* ── Progress bar ─────────────────────────────────────────────── */}
        <div style={{ width: BW, marginTop: 6 }}>
          <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: 'var(--accent)',
              opacity: 0.5,
              transition: 'width 0.5s ease',
              width: `${((spreadIdx + 1) / spreads.length) * 100}%`,
            }} />
          </div>
        </div>

        {/* ── Navigation controls ───────────────────────────────────────── */}
        <div className="flex items-center gap-5 mt-5">
          <button
            onClick={prev}
            disabled={spreadIdx === 0 || busy}
            className="w-9 h-9 rounded-full border border-[#2A2A2A] flex items-center justify-center text-cream/50 hover:text-cream hover:border-[#444] transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="font-inter text-xs tabular-nums" style={{ color: 'var(--page-text-muted, #888)' }}>
            {spreadIdx + 1}
            <span className="mx-1 opacity-40">/</span>
            {spreads.length}
          </span>

          <button
            onClick={next}
            disabled={spreadIdx === spreads.length - 1 || busy}
            className="w-9 h-9 rounded-full border border-[#2A2A2A] flex items-center justify-center text-cream/50 hover:text-cream hover:border-[#444] transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[10px] font-inter mt-3 tracking-wide" style={{ color: 'rgba(255,255,255,0.2)' }}>
          ← → arrow keys · swipe to navigate
        </p>
      </div>
    </div>
  )
}
