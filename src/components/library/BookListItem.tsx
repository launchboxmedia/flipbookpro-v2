'use client'

import { type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, Trash2 } from 'lucide-react'
import { deleteBook } from '@/app/dashboard/actions'
import type { BookWithMeta } from './types'

interface Props {
  book: BookWithMeta
}

function statusPill(book: BookWithMeta): { label: string; className: string } {
  if (book.isPublished) return { label: 'Published', className: 'border-gold/30 text-gold' }
  if (book.approvedCount > 0 && book.approvedCount === book.chapterCount) {
    return { label: 'Ready', className: 'border-ink-1/20 dark:border-white/20 text-ink-1/50 dark:text-white/50' }
  }
  return { label: 'Draft', className: 'border-ink-1/10 dark:border-white/10 text-ink-1/30 dark:text-white/30' }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

/** List-mode row. Densest of the three views — useful when a user has
 *  enough books that scanning a grid would take real effort. */
export function BookListItem({ book }: Props) {
  const pill = statusPill(book)
  const router = useRouter()

  async function handleDelete(e: MouseEvent) {
    // Row is wrapped in a <Link>; stop the click from also opening it.
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
      className="flex items-center gap-4 p-4 bg-cream-2 dark:bg-ink-2 rounded-xl mb-2 border border-[#E8E0D0] dark:border-ink-4 hover:border-cream-3 dark:hover:border-ink-3 transition-colors duration-200"
    >
      {/* Thumbnail */}
      {book.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={book.cover_image_url}
          alt=""
          aria-hidden="true"
          className="w-10 h-14 rounded object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-14 rounded bg-cream-3 dark:bg-ink-3 flex items-center justify-center shrink-0" aria-hidden="true">
          <BookOpen className="w-4 h-4 text-gold" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-ink-1 dark:text-white font-semibold text-sm truncate">{book.title}</p>
        <p className="text-ink-1/40 dark:text-white/40 text-xs mt-0.5">
          {book.chapterCount} chapter{book.chapterCount === 1 ? '' : 's'} · Updated {timeAgo(book.updated_at)}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {book.isPublished && book.leadCount > 0 && (
          <span className="text-gold text-xs">
            {book.leadCount} reader{book.leadCount === 1 ? '' : 's'}
          </span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full border ${pill.className}`}>
          {pill.label}
        </span>
        <span className="text-ink-1/30 dark:text-white/30 text-sm">Open →</span>
        <button
          type="button"
          onClick={handleDelete}
          aria-label={`Delete ${book.title}`}
          className="text-white/20 hover:text-red-400 transition-colors duration-200 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </Link>
  )
}
