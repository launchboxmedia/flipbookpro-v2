'use client'

import Link from 'next/link'
import { BookContextMenu } from './BookContextMenu'
import type { BookWithMeta } from './types'

interface Props {
  book: BookWithMeta
  index: number
}

/** Spine width + height scale with chapter count so a 12-chapter book
 *  visibly stands taller than a 3-chapter book on the same shelf — the
 *  variation is what makes a shelf read as books rather than tiles. */
function spineSize(chapters: number): { w: string; h: string } {
  if (chapters >= 9) return { w: 'w-12', h: 'h-48' }
  if (chapters >= 5) return { w: 'w-10', h: 'h-40' }
  // w-9 = 36px — the legibility floor; never narrower regardless of
  // chapter count so short-chapter books still show a readable title.
  return { w: 'w-9', h: 'h-32' }
}

/** Solid status color + matching title color. Flat fill (no gradient,
 *  no cover image) keeps the vertical title highly legible. Published
 *  gold uses dark text and needs no text-shadow; the dark spines keep
 *  the shadow for contrast over the solid fill. */
function spineStyle(book: BookWithMeta): { bg: string; title: string; shadow?: string } {
  if (book.isPublished) return { bg: 'bg-gold', title: 'text-ink-1' }
  // "Ready" books — all chapters approved but not yet pushed live.
  if (book.approvedCount > 0 && book.approvedCount === book.chapterCount) {
    return { bg: 'bg-ink-3', title: 'text-white', shadow: '0 1px 3px rgba(0,0,0,0.5)' }
  }
  return { bg: 'bg-teal-800', title: 'text-white', shadow: '0 1px 3px rgba(0,0,0,0.5)' }
}

function statusLabel(book: BookWithMeta): { text: string; className: string } {
  if (book.isPublished) return { text: 'Live', className: 'text-gold' }
  if (book.approvedCount > 0 && book.approvedCount === book.chapterCount) {
    return { text: 'Ready', className: 'text-ink-1/70 dark:text-white/70' }
  }
  return { text: 'Draft', className: 'text-ink-1/40 dark:text-white/40' }
}

export function BookSpine({ book, index }: Props) {
  const { w, h } = spineSize(book.chapterCount)
  const spine = spineStyle(book)
  const status = statusLabel(book)

  return (
    <BookContextMenu book={book}>
    <Link
      href={`/book/${book.id}/coauthor`}
      aria-label={`Open ${book.title}`}
      className={`group relative ${w} ${h} cursor-pointer transition-transform duration-200 ease-out hover:-translate-y-3 hover:z-10 animate-slide-up`}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      {/* The spine body — solid status color with a rounded top edge for
          a real-book silhouette. No cover image or gradient overlay so
          the vertical title stays highly legible. */}
      <div className={`relative h-full w-full rounded-t-sm overflow-hidden ${spine.bg}`}>
        {/* Edge details — a hairline highlight on the left and a deeper
            shadow on the right give the spine subtle roundness without
            any gradient overlay. */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-white/20" aria-hidden="true" />
        <div className="absolute right-0 top-0 bottom-0 w-px bg-black/40" aria-hidden="true" />

        {/* Title — set in writing-mode: vertical-rl + rotate(180deg) so
            it reads bottom-to-top like a real book spine. Truncates with
            ellipsis when the title is too long for the spine height. */}
        <div
          className="absolute inset-0 flex items-center justify-center px-1 py-2"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          <span
            className={`font-source-serif text-[11px] ${spine.title} font-semibold overflow-hidden text-ellipsis max-h-full`}
            style={spine.shadow ? { textShadow: spine.shadow } : undefined}
          >
            {book.title}
          </span>
        </div>

        {/* Lead dot — single gold pulse anchors the spine to the
            published-with-readers state. Only renders when the count
            is non-zero so empty drafts don't get a false signal. */}
        {book.leadCount > 0 && (
          <span
            className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gold animate-pulse-subtle"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Tooltip — only appears on hover (group-hover from the Link
          wrapper), absolutely positioned above the spine, fades in. */}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap"
        role="tooltip"
      >
        <div className="bg-cream-1 dark:bg-ink-1 border border-cream-3 dark:border-ink-3 rounded-lg px-3 py-2 shadow-xl">
          <p className="text-ink-1 dark:text-white text-xs font-semibold">{book.title}</p>
          <p className="text-ink-1/40 dark:text-white/40 text-xs">
            {book.chapterCount} chapter{book.chapterCount === 1 ? '' : 's'}
          </p>
          {book.isPublished && book.leadCount > 0 && (
            <p className="text-gold text-xs">
              {book.leadCount} reader{book.leadCount === 1 ? '' : 's'}
            </p>
          )}
          <p className={`text-xs ${status.className}`}>{status.text}</p>
        </div>
      </div>
    </Link>
    </BookContextMenu>
  )
}
