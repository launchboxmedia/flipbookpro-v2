'use client'

import Link from 'next/link'
import { BookContextMenu } from './BookContextMenu'
import type { BookWithMeta } from './types'

interface Props {
  book: BookWithMeta
  index: number
}

// Rich spine palette for non-published books — looks like real cloth/leather
// book spines. Chosen deterministically per book so a shelf reads as a
// varied collection, and the same book always keeps its colour.
const SPINE_COLORS = [
  'from-[#8B2020] to-[#5C1515]', // deep red
  'from-[#1B3A6B] to-[#0F2244]', // navy
  'from-[#1B5E3B] to-[#0F3D26]', // forest green
  'from-[#6B3A8B] to-[#3D1F57]', // purple
  'from-[#8B5E1A] to-[#5C3D0F]', // brown
  'from-[#2C5F6B] to-[#1A3D44]', // teal
  'from-[#8B3A1A] to-[#5C2410]', // rust
  'from-[#3A3A6B] to-[#1F1F44]', // indigo
]

function charSum(id: string): number {
  let s = 0
  for (let i = 0; i < id.length; i++) s += id.charCodeAt(i)
  return s
}

/** Width bucket — thin / normal / wide, deterministic per book id so the
 *  shelf has natural variety but never reshuffles. */
function widthClass(id: string): string {
  return ['w-8', 'w-10', 'w-12'][charSum(id) % 3]!
}

/** Height in px — base from chapter count, plus a per-book offset so the
 *  top line of the shelf is organically uneven (never a flat row). Capped
 *  to stay inside the shelf's min-h-[200px] standing area. */
function spineHeight(book: BookWithMeta): number {
  const ch = book.chapterCount
  const base = ch >= 9 ? 188 : ch >= 5 ? 156 : 128
  const idOffset = (book.id.charCodeAt(0) % 5) * 4 // 0,4,8,12,16
  const chapterNudge = Math.min(ch, 6) * 3
  return Math.min(base + idOffset + chapterNudge, 208)
}

type SpineLook = { gradient: string; muted: boolean }

function spineLook(book: BookWithMeta): SpineLook {
  if (book.isPublished) {
    return { gradient: 'from-[#C9A84C] to-[#8B6914]', muted: false }
  }
  const gradient = SPINE_COLORS[charSum(book.id) % SPINE_COLORS.length]!
  const ready = book.approvedCount > 0 && book.approvedCount === book.chapterCount
  // In-progress books use the same palette but muted (a dark wash) so the
  // shelf still reads "this one isn't finished" without a flat grey block.
  return { gradient, muted: !ready }
}

function statusLabel(book: BookWithMeta): { text: string; className: string } {
  if (book.isPublished) return { text: 'Live', className: 'text-gold' }
  if (book.approvedCount > 0 && book.approvedCount === book.chapterCount) {
    return { text: 'Ready', className: 'text-ink-1/70 dark:text-white/70' }
  }
  return { text: 'Draft', className: 'text-ink-1/40 dark:text-white/40' }
}

export function BookSpine({ book, index }: Props) {
  const w = widthClass(book.id)
  const height = spineHeight(book)
  const look = spineLook(book)
  const status = statusLabel(book)
  const twoBands = charSum(book.id) % 2 === 0

  return (
    <BookContextMenu book={book}>
      <Link
        href={`/book/${book.id}/coauthor`}
        aria-label={`Open ${book.title}`}
        className={`group relative ${w} shrink-0 cursor-pointer transition-transform duration-200 ease-out hover:-translate-y-2 hover:z-10 animate-slide-up`}
        style={{ height: `${height}px`, animationDelay: `${index * 0.04}s` }}
      >
        {/* Page edges visible from above — cream slivers at the very top */}
        <div
          className="absolute -top-1 left-0 right-0 h-1 bg-gradient-to-r from-[#F5F0E8]/80 via-[#E8E0D0]/60 to-[#F5F0E8]/80"
          aria-hidden="true"
        />

        {/* Spine body */}
        <div className={`relative h-full w-full rounded-t-sm overflow-hidden bg-gradient-to-b ${look.gradient}`}>
          {/* Muted wash for in-progress books */}
          {look.muted && <div className="absolute inset-0 bg-black/35" aria-hidden="true" />}

          {/* Decorative top band(s) */}
          <div className="absolute top-3 left-0 right-0 h-1.5 bg-[#C9A84C]/30" aria-hidden="true" />
          {twoBands && <div className="absolute top-5 left-0 right-0 h-1 bg-[#C9A84C]/20" aria-hidden="true" />}

          {/* Title — reads bottom-to-top like a real spine */}
          <div
            className="absolute inset-0 flex items-center justify-center px-1 py-3"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            <span
              className="font-source-serif text-[10px] text-white/90 font-semibold overflow-hidden text-ellipsis max-h-full"
              style={{ letterSpacing: '0.05em', textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}
            >
              {book.title}
            </span>
          </div>

          {/* Bottom detail line */}
          <div className="absolute bottom-2 left-0 right-0 h-px bg-white/10" aria-hidden="true" />

          {/* Light source from the left: bright left edge, shadowed right */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-white/25" aria-hidden="true" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-black/40" aria-hidden="true" />

          {/* Lead indicator — published books with real readers */}
          {book.isPublished && book.leadCount > 0 && (
            <span
              className="absolute bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-gold animate-pulse-subtle"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Hover tooltip */}
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap"
          role="tooltip"
        >
          <div className="bg-cream-1 dark:bg-ink-1 border border-cream-3 dark:border-ink-3 rounded-lg px-3 py-2 shadow-xl">
            <p className="font-playfair text-ink-1 dark:text-white text-xs font-semibold">{book.title}</p>
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
