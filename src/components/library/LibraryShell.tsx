'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { NewBookButton } from '@/components/dashboard/NewBookButton'
import { Bookshelf } from './Bookshelf'
import { BookCard3D } from './BookCard3D'
import { BookListItem } from './BookListItem'
import { LibraryFilters, type SortBy, type StatusFilter, type ViewMode } from './LibraryFilters'
import type { BookWithMeta, ShelfKey } from './types'

interface Props {
  published: BookWithMeta[]
  ready: BookWithMeta[]
  inProgress: BookWithMeta[]
}

const VIEW_MODE_STORAGE_KEY = 'library-view-mode'

function sortBooks(books: BookWithMeta[], sortBy: SortBy): BookWithMeta[] {
  // Spread before sort so we don't mutate the prop array.
  const sorted = [...books]
  switch (sortBy) {
    case 'updated':
      return sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    case 'created':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'leads':
      return sorted.sort((a, b) => b.leadCount - a.leadCount)
  }
}

function filterByTitle(books: BookWithMeta[], q: string): BookWithMeta[] {
  if (!q.trim()) return books
  const needle = q.trim().toLowerCase()
  return books.filter((b) => b.title.toLowerCase().includes(needle))
}

/** Library shell — owns the view-mode + search + filter + sort state,
 *  applies it to the three book groups, and dispatches rendering to
 *  the shelf / grid / list view. */
export function LibraryShell({ published, ready, inProgress }: Props) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('updated')
  // Start in shelf mode so SSR and the first client render match. The
  // localStorage-persisted preference flips this in an effect once the
  // client has mounted.
  const [viewMode, setViewMode] = useState<ViewMode>('shelf')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)
      if (saved === 'shelf' || saved === 'grid' || saved === 'list') {
        setViewMode(saved)
      }
    } catch {
      // localStorage unavailable in some sandboxed contexts — ignore
    }
  }, [])

  function handleViewModeChange(next: ViewMode) {
    setViewMode(next)
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  // Apply search → status → sort to each group. useMemo because spine
  // rendering can be ~30+ DOM nodes per book; recomputing on every
  // keystroke is fine but skipping when nothing changed is cheaper.
  const groups = useMemo(() => {
    function process(books: BookWithMeta[]): BookWithMeta[] {
      return sortBooks(filterByTitle(books, search), sortBy)
    }
    return {
      published:  status === 'all' || status === 'published'   ? process(published)  : [],
      ready:      status === 'all' || status === 'ready'       ? process(ready)      : [],
      inProgress: status === 'all' || status === 'in_progress' ? process(inProgress) : [],
    }
  }, [published, ready, inProgress, search, status, sortBy])

  const totalShown = groups.published.length + groups.ready.length + groups.inProgress.length
  const totalAll = published.length + ready.length + inProgress.length
  const isLibraryEmpty = totalAll === 0
  const noMatches = totalAll > 0 && totalShown === 0

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header row — title + subtitle + primary CTA. */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-playfair text-3xl text-ink-1 dark:text-white">Library</h1>
          <p className="text-ink-1/40 dark:text-white/40 text-sm mt-1">Your books</p>
        </div>
        <div className="shrink-0">
          <NewBookButton />
        </div>
      </header>

      {/* Library-is-truly-empty state — bypasses the filter bar entirely.
          Showing filters above an empty state would imply the user just
          needs to change a filter, which is misleading. */}
      {isLibraryEmpty ? (
        <div className="flex flex-col items-center justify-center text-center py-32">
          <BookOpen className="w-16 h-16 text-gold mb-6" />
          <h2 className="font-playfair text-2xl text-ink-1 dark:text-white mb-3">Your library is empty</h2>
          <p className="text-ink-1/50 dark:text-white/50 font-source-serif mb-8 max-w-md">
            Create your first book to fill the shelf.
          </p>
          <NewBookButton />
        </div>
      ) : (
        <>
          <LibraryFilters
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            sortBy={sortBy}
            onSortChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />

          {noMatches ? (
            // Filters reduced the visible set to zero — different framing
            // from a genuinely empty library.
            <div className="flex flex-col items-center justify-center text-center py-24 border border-dashed border-cream-3 dark:border-ink-3 rounded-2xl bg-cream-2 dark:bg-ink-2/30">
              <p className="font-playfair text-lg text-ink-1/70 dark:text-white/70 mb-1">No books match your filters</p>
              <p className="text-ink-1/40 dark:text-white/40 text-sm font-source-serif">Try a different search or clear the filter.</p>
            </div>
          ) : (
            <div className="animate-fade-in">
              {viewMode === 'shelf' && <ShelfView groups={groups} />}
              {viewMode === 'grid'  && <GridView  groups={groups} />}
              {viewMode === 'list'  && <ListView  groups={groups} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface GroupsView {
  groups: Record<ShelfKey, BookWithMeta[]>
}

function ShelfView({ groups }: GroupsView) {
  return (
    <>
      <Bookshelf shelfKey="published"  label="Published"   books={groups.published} />
      <Bookshelf shelfKey="ready"      label="Ready"       books={groups.ready} />
      <Bookshelf shelfKey="inProgress" label="In Progress" books={groups.inProgress} />
    </>
  )
}

function GroupHeader({ label, count, accent }: { label: string; count: number; accent: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className={`text-xs uppercase tracking-widest font-semibold ${accent}`}>{label}</span>
      <span className="text-ink-1/20 dark:text-white/20 text-xs">({count})</span>
      <div className="flex-1 h-px bg-cream-3 dark:bg-ink-3/50" />
    </div>
  )
}

function GridView({ groups }: GroupsView) {
  const sections: Array<{ key: ShelfKey; label: string; accent: string; books: BookWithMeta[] }> = [
    { key: 'published',  label: 'Published',   accent: 'text-gold',       books: groups.published },
    { key: 'ready',      label: 'Ready',       accent: 'text-ink-1/60 dark:text-white/60',   books: groups.ready },
    { key: 'inProgress', label: 'In Progress', accent: 'text-ink-1/30 dark:text-white/30',   books: groups.inProgress },
  ]
  return (
    <>
      {sections.map((sec) =>
        sec.books.length === 0 ? null : (
          <section key={sec.key} className="mb-10" aria-label={`${sec.label} grid`}>
            <GroupHeader label={sec.label} count={sec.books.length} accent={sec.accent} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {sec.books.map((book, i) => (
                <BookCard3D key={book.id} book={book} index={i} />
              ))}
            </div>
          </section>
        ),
      )}
    </>
  )
}

function ListView({ groups }: GroupsView) {
  const sections: Array<{ key: ShelfKey; label: string; accent: string; books: BookWithMeta[] }> = [
    { key: 'published',  label: 'Published',   accent: 'text-gold',       books: groups.published },
    { key: 'ready',      label: 'Ready',       accent: 'text-ink-1/60 dark:text-white/60',   books: groups.ready },
    { key: 'inProgress', label: 'In Progress', accent: 'text-ink-1/30 dark:text-white/30',   books: groups.inProgress },
  ]
  return (
    <>
      {sections.map((sec) =>
        sec.books.length === 0 ? null : (
          <section key={sec.key} className="mb-8" aria-label={`${sec.label} list`}>
            <GroupHeader label={sec.label} count={sec.books.length} accent={sec.accent} />
            {sec.books.map((book) => (
              <BookListItem key={book.id} book={book} />
            ))}
          </section>
        ),
      )}
    </>
  )
}
