'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Wrench, Sparkles, FileText } from 'lucide-react'
import type { Book } from '@/types/database'

interface Props {
  book: Book
  chapterCount: number
}

const STATUS_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tint: string; tone: string }> = {
  draft:      { label: 'Draft in progress',     icon: FileText,  tint: 'bg-cream/10 text-cream/70',  tone: 'Pick up where you left off.' },
  generating: { label: 'Illustrations queued',  icon: Sparkles,  tint: 'bg-gold/10 text-gold',       tone: 'Images generating in the background.' },
  ready:      { label: 'Ready to publish',      icon: Wrench,    tint: 'bg-accent/10 text-accent',   tone: 'Run a final readthrough or publish.' },
}

export function ContinueWorking({ book, chapterCount }: Props) {
  const meta = STATUS_META[book.status] ?? STATUS_META.draft
  const Icon = meta.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-ink-3 bg-gradient-to-br from-ink-2 via-ink-2 to-ink-1 hover-lift"
    >
      {/* Subtle gold corner glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gold/8 blur-3xl" aria-hidden="true" />

      <div className="relative flex flex-col sm:flex-row gap-5 p-5 sm:p-6">
        {/* Cover thumbnail */}
        <div className="shrink-0 w-24 h-32 sm:w-28 sm:h-36 rounded-lg overflow-hidden bg-ink-3 border border-ink-4 relative">
          {book.cover_image_url ? (
            <Image src={book.cover_image_url} alt={book.title} fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-ink-muted">
              <FileText className="w-6 h-6" />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-inter font-semibold text-gold/80 uppercase tracking-[0.18em]">
              Continue working
            </p>
            <h2 className="font-playfair text-2xl text-cream font-semibold leading-tight truncate">
              {book.title}
            </h2>
            {book.subtitle && (
              <p className="text-ink-subtle text-sm font-source-serif italic line-clamp-1">
                {book.subtitle}
              </p>
            )}
            <div className="flex items-center gap-3 pt-1 text-xs font-inter">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${meta.tint}`}>
                <Icon className="w-3 h-3" /> {meta.label}
              </span>
              <span className="text-ink-muted">
                {chapterCount} chapter{chapterCount !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-ink-subtle text-xs font-source-serif">{meta.tone}</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              // Wizard hasn't finalised setup until visual_style is set
              // (the /setup route gates on it). Until then, Resume goes
              // back to the wizard so the user can finish — otherwise
              // we'd land them on the coauthor view of an empty book.
              href={book.visual_style
                ? `/book/${book.id}/coauthor`
                : `/book/${book.id}/wizard`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter text-sm font-semibold rounded-lg shadow-[0_4px_18px_-6px_rgba(201,168,76,0.5)] transition-colors press-scale"
            >
              Resume
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href={`/book/${book.id}/preview`}
              className="inline-flex items-center px-3.5 py-2.5 border border-ink-3 hover:border-gold/40 text-ink-subtle hover:text-cream font-inter text-sm rounded-lg transition-colors press-scale"
            >
              Preview
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
