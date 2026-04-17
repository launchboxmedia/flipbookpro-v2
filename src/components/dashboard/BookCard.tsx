'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, Edit2, Globe, Trash2, FileText } from 'lucide-react'
import { deleteBook } from '@/app/dashboard/actions'
import type { Book } from '@/types/database'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-muted-foreground bg-[#2A2A2A]' },
  generating: { label: 'Generating', color: 'text-gold bg-gold/10' },
  ready: { label: 'Ready', color: 'text-accent bg-accent/10' },
  published: { label: 'Published', color: 'text-green-400 bg-green-400/10' },
}

export function BookCard({ book, chapterCount }: { book: Book; chapterCount: number }) {
  const [deleting, setDeleting] = useState(false)
  const status = STATUS_LABELS[book.status] ?? STATUS_LABELS.draft

  async function handleDelete() {
    if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return
    setDeleting(true)
    await deleteBook(book.id)
  }

  return (
    <div className="group bg-[#222] border border-[#333] rounded-xl overflow-hidden hover:border-[#444] transition-colors">
      <div className="relative aspect-[3/4] bg-[#1A1A1A] overflow-hidden">
        {book.cover_image_url ? (
          <Image
            src={book.cover_image_url}
            alt={book.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-4">
              <FileText className="w-10 h-10 text-[#444] mx-auto mb-3" />
              <p className="font-playfair text-cream/40 text-sm leading-tight">{book.title}</p>
            </div>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className={`text-xs font-inter font-medium px-2 py-1 rounded-full ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-playfair text-cream text-lg leading-tight mb-1 truncate">
          {book.title}
        </h3>
        {book.subtitle && (
          <p className="text-muted-foreground text-xs font-source-serif mb-2 truncate">
            {book.subtitle}
          </p>
        )}
        <p className="text-muted-foreground text-xs font-inter mb-4">
          {chapterCount} chapter{chapterCount !== 1 ? 's' : ''}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/book/${book.id}/coauthor`}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent/90 text-cream text-xs font-inter font-medium rounded-md transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Open
          </Link>
          <Link
            href={`/book/${book.id}/wizard`}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#2A2A2A] hover:bg-[#333] text-cream text-xs font-inter font-medium rounded-md transition-colors border border-[#333]"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </Link>
          {book.status === 'ready' && (
            <Link
              href={`/book/${book.id}/publish`}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gold/10 hover:bg-gold/20 text-gold text-xs font-inter font-medium rounded-md transition-colors border border-gold/20"
            >
              <Globe className="w-3.5 h-3.5" />
              Publish
            </Link>
          )}
          {book.slug && (
            <Link
              href={`/read/${book.slug}`}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gold/10 hover:bg-gold/20 text-gold text-xs font-inter font-medium rounded-md transition-colors border border-gold/20"
            >
              <Globe className="w-3.5 h-3.5" />
              View
            </Link>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#2A2A2A] hover:bg-red-900/30 text-muted-foreground hover:text-red-400 text-xs font-inter font-medium rounded-md transition-colors border border-[#333] disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? '...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
