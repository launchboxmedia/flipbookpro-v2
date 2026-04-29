'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, BookOpen, Library, Wrench } from 'lucide-react'
import type { Book } from '@/types/database'
import { BookCard } from './BookCard'

interface Props {
  books: Book[]
  pageCounts: Record<string, number>
}

const SHELF_READY_STATUSES = new Set(['ready', 'published'])

type FilterKey = 'all' | 'ready' | 'in-production'

export function DashboardGrid({ books, pageCounts }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  const { shelfReady, inProduction } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = books.filter((b) => {
      if (!q) return true
      return b.title.toLowerCase().includes(q) || (b.subtitle ?? '').toLowerCase().includes(q)
    })
    return {
      shelfReady:   filtered.filter((b) => SHELF_READY_STATUSES.has(b.status)),
      inProduction: filtered.filter((b) => !SHELF_READY_STATUSES.has(b.status)),
    }
  }, [books, query])

  const showShelfReady   = (filter === 'all' || filter === 'ready')        && shelfReady.length > 0
  const showInProduction = (filter === 'all' || filter === 'in-production') && inProduction.length > 0
  const showEmpty = !showShelfReady && !showInProduction

  return (
    <div className="space-y-10">
      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library…"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-ink-2 border border-ink-3 text-cream placeholder:text-ink-muted font-inter text-sm focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-ink-2 border border-ink-3">
          {([
            { key: 'all',           label: 'All' },
            { key: 'ready',         label: 'Shelf-Ready' },
            { key: 'in-production', label: 'In Production' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-colors whitespace-nowrap ${
                filter === tab.key
                  ? 'bg-gold/15 text-gold'
                  : 'text-ink-subtle hover:text-cream'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state — when search/filter eliminates everything */}
      {showEmpty && (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-ink-3 rounded-2xl bg-ink-2/40">
          <BookOpen className="w-10 h-10 text-ink-muted mb-3" />
          <h3 className="font-playfair text-lg text-cream/70 mb-1">No books match your filters</h3>
          <p className="text-ink-subtle text-sm font-source-serif">Try a different search or clear the filter.</p>
        </div>
      )}

      {/* Shelf-Ready section */}
      {showShelfReady && (
        <BookSection
          title="Shelf-Ready"
          subtitle="Approved books ready to preview, publish, or export"
          icon={<Library className="w-4 h-4" />}
          books={shelfReady}
          pageCounts={pageCounts}
        />
      )}

      {/* In Production section */}
      {showInProduction && (
        <BookSection
          title="In Production"
          subtitle="Drafts in the wizard, in writing, or generating illustrations"
          icon={<Wrench className="w-4 h-4" />}
          books={inProduction}
          pageCounts={pageCounts}
        />
      )}
    </div>
  )
}

interface SectionProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  books: Book[]
  pageCounts: Record<string, number>
}

function BookSection({ title, subtitle, icon, books, pageCounts }: SectionProps) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-4 pb-3 border-b border-ink-3">
        <div className="flex items-center gap-2.5">
          <span className="text-gold/80">{icon}</span>
          <div>
            <h3 className="font-playfair text-lg text-cream font-semibold leading-none">{title}</h3>
            <p className="text-ink-subtle text-xs font-source-serif mt-1">{subtitle}</p>
          </div>
        </div>
        <span className="text-ink-muted text-xs font-inter tracking-wider uppercase shrink-0">
          {books.length} book{books.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {books.map((book, i) => (
          <motion.div
            key={book.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            // Cap the cumulative delay so a 30-book grid doesn't take 1.5s
            // to settle. Anything past index 12 just fades in together.
            transition={{ duration: 0.26, delay: Math.min(i, 12) * 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            <BookCard book={book} chapterCount={pageCounts[book.id] ?? 0} />
          </motion.div>
        ))}
      </div>
    </section>
  )
}
