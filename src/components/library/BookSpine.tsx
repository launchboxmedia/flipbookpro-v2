'use client'

import { type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { deleteBook } from '@/app/dashboard/actions'
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

function spineBackground(book: BookWithMeta): string {
  if (book.isPublished) return 'bg-gradient-to-b from-gold/80 to-gold/40'
  // "Ready" books — all chapters approved but not yet pushed live.
  if (book.approvedCount > 0 && book.approvedCount === book.chapterCount) {
    return 'bg-gradient-to-b from-ink-4 to-ink-3'
  }
  return 'bg-gradient-to-b from-teal-800 to-teal-900/70'
}

function statusLabel(book: BookWithMeta): { text: string; className: string } {
  if (book.isPublished) return { text: 'Live', className: 'text-gold' }
  if (book.approvedCount > 0 && book.approvedCount === book.chapterCount) {
    return { text: 'Ready', className: 'text-ink-1/70 dark:text-white/70' }
  }
  return { text: 'Draft', className: 'text-ink-1/40 dark:text-white/40' }
}

export function BookSpine({ book, index }: Props) {
  const router = useRouter()
  const { w, h } = spineSize(book.chapterCount)
  const bg = spineBackground(book)
  const status = statusLabel(book)

  async function handleDelete(e: MouseEvent) {
    // The spine is wrapped in a <Link>; without these the click also
    // navigates to the editor.
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return
    await deleteBook(book.id)
    router.refresh()
  }

  return (
    <Link
      href={`/book/${book.id}/coauthor`}
      aria-label={`Open ${book.title}`}
      className={`group relative ${w} ${h} cursor-pointer transition-transform duration-200 ease-out hover:-translate-y-3 hover:z-10 animate-slide-up`}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      {/* The spine body — rounded top edge for a real-book silhouette,
          gradient background per status, faded cover image behind. */}
      <div className={`relative h-full w-full rounded-t-sm overflow-hidden ${bg}`}>
        {book.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.cover_image_url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-60"
          />
        )}

        {/* Edge details — a hairline highlight on the left, a deeper
            shadow on the right, and a softer top edge so the spine has
            visual roundness without leaving the flat-fill aesthetic. */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-white/20" aria-hidden="true" />
        <div className="absolute right-0 top-0 bottom-0 w-px bg-black/40" aria-hidden="true" />
        <div className="absolute left-0 right-0 top-0 h-2 bg-gradient-to-r from-white/10 via-white/20 to-white/10 rounded-t-sm" aria-hidden="true" />

        {/* Title — set in writing-mode: vertical-rl + rotate(180deg) so
            it reads bottom-to-top like a real book spine. Truncates with
            ellipsis when the title is too long for the spine height. */}
        <div
          className="absolute inset-0 flex items-center justify-center px-1 py-2"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          <span
            className="font-source-serif text-[11px] text-white dark:text-white font-semibold overflow-hidden text-ellipsis max-h-full"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
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

      {/* Delete — hover-only, top of the spine. preventDefault stops
          the wrapping Link from opening the editor on click. */}
      <button
        type="button"
        onClick={handleDelete}
        aria-label={`Delete ${book.title}`}
        className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20"
      >
        <X className="w-3 h-3" />
      </button>

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
  )
}
