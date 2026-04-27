'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, Edit2, Globe, Trash2, FileText, Eye } from 'lucide-react'
import { deleteBook } from '@/app/dashboard/actions'
import type { Book } from '@/types/database'

const STATUS_LABELS: Record<string, { label: string; dot: string; bg: string }> = {
  draft:      { label: 'Draft',      dot: 'bg-cream/40', bg: 'bg-[#2A2A2A] text-cream/60' },
  generating: { label: 'Generating', dot: 'bg-gold animate-pulse', bg: 'bg-gold/10 text-gold' },
  ready:      { label: 'Ready',      dot: 'bg-accent', bg: 'bg-accent/10 text-accent' },
  published:  { label: 'Published',  dot: 'bg-green-400', bg: 'bg-green-400/10 text-green-400' },
}

export function BookCard({ book, chapterCount }: { book: Book; chapterCount: number }) {
  const [deleting, setDeleting] = useState(false)
  const [hovered, setHovered] = useState(false)
  const status = STATUS_LABELS[book.status] ?? STATUS_LABELS.draft

  async function handleDelete() {
    if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return
    setDeleting(true)
    await deleteBook(book.id)
  }

  return (
    <div
      className="group relative bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl overflow-hidden transition-all duration-300 hover:border-[#3A3A3A] hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)] hover:-translate-y-0.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Cover image area */}
      <div className="relative aspect-[3/4] bg-gradient-to-b from-[#1A1A1A] to-[#151515] overflow-hidden">
        {book.cover_image_url ? (
          <>
            <Image
              src={book.cover_image_url}
              alt={book.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            {/* Gradient overlay on hover */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`} />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-6">
              <div className="w-14 h-14 rounded-full bg-[#2A2A2A] flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-cream/20" />
              </div>
              <p className="font-playfair text-cream/30 text-sm leading-tight">{book.title}</p>
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-3 right-3 z-10">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-inter font-medium px-2.5 py-1 rounded-full backdrop-blur-sm ${status.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        {/* Quick actions on hover */}
        <div className={`absolute bottom-3 left-3 right-3 z-10 flex gap-2 transition-all duration-300 ${hovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <Link
            href={`/book/${book.id}/coauthor`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-accent/90 hover:bg-accent text-white text-xs font-inter font-medium rounded-lg backdrop-blur-sm transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Open
          </Link>
          <Link
            href={`/book/${book.id}/preview`}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-inter font-medium rounded-lg backdrop-blur-sm transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Info area */}
      <div className="p-4">
        <h3 className="font-playfair text-cream text-[15px] font-semibold leading-snug mb-0.5 truncate">
          {book.title}
        </h3>
        {book.subtitle && (
          <p className="text-cream/40 text-[11px] font-source-serif italic mb-2 truncate">
            {book.subtitle}
          </p>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#2A2A2A]">
          <span className="text-cream/30 text-[10px] font-inter tracking-wide uppercase">
            {chapterCount} chapter{chapterCount !== 1 ? 's' : ''}
          </span>

          <div className="flex items-center gap-1.5">
            <Link
              href={`/book/${book.id}/wizard`}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-[#2A2A2A] hover:bg-[#333] text-cream/40 hover:text-cream transition-colors"
              title="Edit settings"
            >
              <Edit2 className="w-3 h-3" />
            </Link>
            {(book.status === 'ready' || book.slug) && (
              <Link
                href={book.slug ? `/read/${book.slug}` : `/book/${book.id}/publish`}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-gold/10 hover:bg-gold/20 text-gold/60 hover:text-gold transition-colors"
                title={book.slug ? 'View published' : 'Publish'}
              >
                <Globe className="w-3 h-3" />
              </Link>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-[#2A2A2A] hover:bg-red-900/30 text-cream/20 hover:text-red-400 transition-colors disabled:opacity-50"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
