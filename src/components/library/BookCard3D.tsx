'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import type { BookWithMeta } from './types'

interface Props {
  book: BookWithMeta
  index: number
}

function statusBadge(book: BookWithMeta): { label: string; className: string } {
  if (book.isPublished) return { label: 'Live', className: 'bg-gold text-ink-1' }
  if (book.approvedCount > 0 && book.approvedCount === book.chapterCount) {
    return { label: 'Ready', className: 'bg-white/20 text-white' }
  }
  return { label: 'Draft', className: 'bg-ink-3 text-white/60' }
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return 'today'
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Grid-mode card. The hover state uses inline transforms (rotateY +
 *  translateZ) since Tailwind doesn't ship rotate-y utilities — kept
 *  in onMouseEnter/Leave React state so the animation is purely CSS
 *  driven by a class swap, no JS animation library needed. */
export function BookCard3D({ book, index }: Props) {
  const [hovered, setHovered] = useState(false)
  const badge = statusBadge(book)

  return (
    <Link
      href={`/book/${book.id}/coauthor`}
      aria-label={`Open ${book.title}`}
      className="group block animate-slide-up"
      style={{ perspective: '1000px', animationDelay: `${index * 0.04}s` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* The book face — the 3D rotation lives here so the spine + page
          edge effects rotate as one unit. Tilts inward when hovered to
          suggest the book is being pulled off the shelf. */}
      <div
        className="relative aspect-[2/3] rounded-r-sm overflow-hidden shadow-lg group-hover:shadow-2xl transition-shadow duration-300"
        style={{
          transition: 'transform 300ms ease-out',
          transform: hovered ? 'rotateY(-8deg) translateZ(10px)' : 'none',
        }}
      >
        {book.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.cover_image_url}
            alt={`${book.title} cover`}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cream-2 to-cream-3 dark:from-ink-2 dark:to-ink-3 flex items-center justify-center" aria-hidden="true">
            <BookOpen className="w-10 h-10 text-gold" strokeWidth={1.5} />
          </div>
        )}

        {/* Bottom gradient — always present so the title remains
            readable regardless of the underlying cover image. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" aria-hidden="true" />

        {/* Status pill, top-right. */}
        <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full ${badge.className}`}>
          {badge.label}
        </span>

        {/* Lead count, top-left — only when there are real readers. */}
        {book.isPublished && book.leadCount > 0 && (
          <span className="absolute top-2 left-2 bg-black/60 text-gold text-xs px-2 py-0.5 rounded-full">
            {book.leadCount} reader{book.leadCount === 1 ? '' : 's'}
          </span>
        )}

        {/* Title, bottom. text-shadow keeps it legible over a busy cover. */}
        <p
          className="absolute bottom-0 left-0 right-0 p-3 font-playfair text-white text-sm font-semibold leading-tight"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
        >
          {book.title}
        </p>

        {/* Hover overlay — surfaces an explicit "Open" CTA when the
            user dwells on a card. The whole card is already a Link, so
            this is reinforcement, not the only affordance. */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <span className="bg-gold text-ink-1 text-xs font-semibold px-4 py-2 rounded-lg">
            Open →
          </span>
        </div>

        {/* Spine highlight — a thin gold strip on the left edge that
            fades in on hover. Reinforces the "book being tilted" feel. */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-gold/60 to-gold/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          aria-hidden="true"
        />

        {/* Page edges — four faint cream slivers on the right edge
            that suggest stacked pages becoming visible as the book
            tilts. Decreasing opacity per layer for depth. */}
        {[
          { right: '-2px', opacity: 0.4 },
          { right: '-4px', opacity: 0.3 },
          { right: '-6px', opacity: 0.2 },
          { right: '-8px', opacity: 0.1 },
        ].map((p, i) => (
          <div
            key={i}
            className="absolute top-1 bottom-1 w-px bg-cream-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ right: p.right, opacity: hovered ? p.opacity : 0 }}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Footer caption — title + last-updated timestamp. Sits below
          the 3D card so it doesn't tilt with the hover. */}
      <div className="mt-2">
        <p className="text-ink-1/70 dark:text-white/70 text-xs truncate">{book.title}</p>
        <p className="text-ink-1/30 dark:text-white/30 text-xs">Updated {formatDate(book.updated_at)}</p>
      </div>
    </Link>
  )
}
