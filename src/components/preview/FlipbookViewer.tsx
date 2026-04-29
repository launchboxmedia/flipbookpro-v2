'use client'

import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Download, ArrowLeft, FileText, Printer } from 'lucide-react'
import Link from 'next/link'
import type { Book, BookPage, Profile } from '@/types/database'
import type { BookTheme } from '@/lib/bookTheme'
import { paginateText, WORDS_PER_PAGE, FIRST_PAGE_BUDGET } from '@/lib/paginateText'

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
    }
  | { type: 'back-matter';   page: BookPage }
  | { type: 'back-cover' }

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

function buildSpreads(chapters: BookPage[], backMatter: BookPage[]): Spread[] {
  // Pre-paginate every chapter so we know how many spreads each one needs
  // (and so the TOC can compute correct page numbers).
  const chapterChunks = chapters.map((ch) => paginateText(ch.content ?? ''))

  // Compute the right-page printed page number for every chapter's first
  // text page. Page numbers count right pages only (where text lives):
  //   spread 0 = cover            → no number
  //   spread 1 = TOC              → page 3 (right page of spread 1)
  //   spread 2 = ch1 page 1       → page 5
  //   spread 3 = ch1 page 2 (cont)→ page 7   (if chapter 1 has 2 chunks)
  //   spread 4 = ch2 page 1       → page 9
  //   …
  // pageNum for the right page of spread N = N * 2 + 1.
  let spreadIdx = 2 // chapters start at spread index 2 (after cover + TOC)
  const tocEntries: TocEntry[] = chapters.map((ch, i) => {
    const entry: TocEntry = {
      num: i + 1,
      title: ch.chapter_title,
      pageNum: spreadIdx * 2 + 1,
    }
    spreadIdx += chapterChunks[i].length // advance by one spread per chunk
    return entry
  })

  const out: Spread[] = []

  // Cover — single right page, dark canvas on left
  out.push({
    id: 'cover',
    left:  { type: 'blank', dark: true },
    right: { type: 'cover' },
    transition: 'fade',
  })

  // TOC — blank left, toc right
  out.push({
    id: 'toc',
    left:  { type: 'blank' },
    right: { type: 'toc', tocEntries },
    transition: 'flip',
  })

  // Chapters — first chunk is image-left + text-right; subsequent chunks are
  // blank-left + continuation-text-right. Page numbers are computed from the
  // global spread index so they stay sequential across overflow.
  let runningSpreadIdx = 2
  chapters.forEach((ch, i) => {
    const chunks = chapterChunks[i]
    chunks.forEach((chunk, k) => {
      const pageNum = runningSpreadIdx * 2 + 1
      const left: PageContent = k === 0
        ? { type: 'chapter-image', page: ch, num: i + 1 }
        : { type: 'blank' }
      out.push({
        id:           `ch-${ch.id}-p${k}`,
        left,
        right: {
          type:        'chapter-text',
          page:        ch,
          num:         i + 1,
          chunk,
          chunkIndex:  k,
          totalChunks: chunks.length,
          pageNum,
        },
        transition:   'flip',
        chapterNum:   i + 1,
        chapterTitle: ch.chapter_title,
      })
      runningSpreadIdx++
    })
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
// to fill the page below the header. With sentence-aware pagination, the
// rendered body should fit cleanly — but rendering can still leave a thin
// partial line at the bottom because the body height isn't an exact multiple
// of line-height. The fade is now ~0.2em — just enough to soften any ~3-4px
// partial line that ends up at the very bottom, without swallowing real text.
// (Was 0.6em — too aggressive once chunks are sized correctly.)
const bodyFadeMask: React.CSSProperties = {
  WebkitMaskImage: 'linear-gradient(to bottom, #000 0, #000 calc(100% - 0.2em), transparent 100%)',
  maskImage: 'linear-gradient(to bottom, #000 0, #000 calc(100% - 0.2em), transparent 100%)',
}

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

  // With cover image: full-bleed image, title overlaid, bottom band for subtitle + author
  if (book.cover_image_url) {
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

function ChapterImagePage({ page, num }: { page: BookPage; num: number }) {
  return (
    <div style={{ ...pageBase, background: 'var(--canvas-bg)', position: 'relative', overflow: 'hidden' }}>
      {/* Full-bleed image */}
      {page.image_url
        ? <img src={page.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', zIndex: 1 }} />
        : <div style={{ position: 'absolute', inset: 0, background: 'var(--accent-subtle)', zIndex: 1 }} />
      }
      {/* Bottom gradient — z:2 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '42%', background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 100%)', zIndex: 2 }} />
      {/* Chapter info overlaid on gradient — z:3 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 26px 24px', zIndex: 3 }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 7.5, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent)', display: 'block', marginBottom: 5 }}>
          Chapter {num}
        </span>
        <div style={{ width: 20, height: 2, background: 'var(--accent)', marginBottom: 7 }} />
        <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 700, color: '#FFFFFF', margin: 0, lineHeight: 1.2, textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
          {page.chapter_title}
        </h3>
      </div>
    </div>
  )
}

function ChapterTextPage({
  page, num, chunk, chunkIndex, totalChunks, pageNum,
}: {
  page: BookPage
  num: number
  chunk: string
  chunkIndex: number
  totalChunks: number
  pageNum: number
}) {
  const isFirstChunk = chunkIndex === 0
  const paras = chunk.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
  const [first, ...rest] = paras
  const hasContent = chunk.length > 0

  return (
    <div style={{ ...pageBase, ...padRight, background: 'var(--page-bg)' }}>
      {/* Header — full chapter title + accent rule on first page; smaller
          continuation header ("Chapter N · cont.") on overflow pages so the
          reader keeps context without the title eating a third of the page. */}
      {isFirstChunk ? (
        <div style={{ flexShrink: 0, marginBottom: 16 }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 7.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--chapter-num-color)', display: 'block', marginBottom: 3 }}>
            Chapter {num}
          </span>
          <h2 style={{ fontFamily: 'var(--heading-font)', fontSize: 'var(--heading-size)', fontWeight: 700, color: 'var(--page-text)', lineHeight: 1.2, margin: '0 0 9px' }}>
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

      {/* Body. The bottom fade is intentional: even with sentence-aware
          pagination, the rendered line height vs page height can leave a
          partial line. The mask softens that to transparent rather than
          slicing letters. With proper pagination this only ever affects a
          handful of pixels. */}
      <div style={{ flex: 1, overflow: 'hidden', fontFamily: 'var(--body-font)', fontSize: 'var(--body-size)', color: 'var(--page-text)', lineHeight: 'var(--line-height)', ...bodyFadeMask }}>
        {!hasContent ? (
          <p style={{ color: 'var(--page-text-muted)', fontStyle: 'italic', margin: 0 }}>Chapter not yet written.</p>
        ) : isFirstChunk ? (
          <>
            {first && (
              <p style={{ margin: '0 0 0.8em' }}>
                {/* Drop cap — first paragraph of the chapter only */}
                <span style={{ float: 'left', fontFamily: 'var(--heading-font)', fontSize: 'var(--drop-cap-size)', fontWeight: 700, lineHeight: 0.78, marginRight: '0.05em', marginTop: '0.1em', color: 'var(--drop-cap-color)' }}>
                  {first[0]}
                </span>
                {first.slice(1)}
              </p>
            )}
            {rest.map((p, i) => <p key={i} style={{ margin: '0 0 0.8em' }}>{p}</p>)}
          </>
        ) : (
          // Continuation page — no drop cap, paragraphs flow normally.
          paras.map((p, i) => <p key={i} style={{ margin: '0 0 0.8em' }}>{p}</p>)
        )}
      </div>

      {/* Page number */}
      <div style={{ flexShrink: 0, textAlign: 'right', fontFamily: "'Inter', sans-serif", fontSize: 8, color: 'var(--page-text-muted)', paddingTop: 6 }}>
        {pageNum}
      </div>
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
      <div style={{ flex: 1, overflow: 'hidden', fontFamily: 'var(--body-font)', fontSize: 'var(--body-size)', color: 'var(--page-text)', lineHeight: 'var(--line-height)', ...bodyFadeMask }}>
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
    case 'blank':         return <BlankPage dark={content.dark} />
    case 'cover':         return <CoverPage book={book} profile={profile} />
    case 'toc':           return <TocPage entries={content.tocEntries} />
    case 'chapter-image': return <ChapterImagePage page={content.page} num={content.num} />
    case 'chapter-text':  return (
      <ChapterTextPage
        page={content.page}
        num={content.num}
        chunk={content.chunk}
        chunkIndex={content.chunkIndex}
        totalChunks={content.totalChunks}
        pageNum={content.pageNum}
      />
    )
    case 'back-matter':   return <BackMatterPage   page={content.page} side={side} />
    case 'back-cover':    return <BackCoverPage book={book} profile={profile} />
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

export function FlipbookViewer({ book, chapters, backMatter, theme, profile, isPublicView = false }: FlipbookViewerProps) {
  const spreads = useMemo(() => buildSpreads(chapters, backMatter), [chapters, backMatter])

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
