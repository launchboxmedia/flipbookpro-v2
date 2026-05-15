'use client'

import { Search, BookMarked, LayoutGrid, List } from 'lucide-react'

export type ViewMode = 'shelf' | 'grid' | 'list'
export type StatusFilter = 'all' | 'published' | 'ready' | 'in_progress'
export type SortBy = 'updated' | 'leads' | 'title' | 'created'

interface Props {
  search: string
  onSearchChange: (next: string) => void
  status: StatusFilter
  onStatusChange: (next: StatusFilter) => void
  sortBy: SortBy
  onSortChange: (next: SortBy) => void
  viewMode: ViewMode
  onViewModeChange: (next: ViewMode) => void
}

const STATUS_PILLS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all',         label: 'All' },
  { key: 'published',   label: 'Published' },
  { key: 'ready',       label: 'Ready' },
  { key: 'in_progress', label: 'In Progress' },
]

const SORT_OPTIONS: Array<{ key: SortBy; label: string }> = [
  { key: 'updated', label: 'Recently Updated' },
  { key: 'leads',   label: 'Most Leads' },
  { key: 'title',   label: 'Title A–Z' },
  { key: 'created', label: 'Date Created' },
]

const VIEW_MODES: Array<{ key: ViewMode; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'shelf', label: 'Shelf view', Icon: BookMarked },
  { key: 'grid',  label: 'Grid view',  Icon: LayoutGrid },
  { key: 'list',  label: 'List view',  Icon: List },
]

/** Filter + sort + view toggle bar. Pure presentational — all state
 *  flows down from LibraryShell so persistence + filtering logic stay
 *  in one place. */
export function LibraryFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}: Props) {
  return (
    <div className="bg-ink-2 rounded-xl p-3 mb-8 flex items-center gap-3 flex-wrap border border-ink-4">
      {/* Search — flex-1 so it eats whatever space the pills + selects
          don't claim, with a min-w so it doesn't collapse on small
          viewports. */}
      <div className="relative flex-1 min-w-[12rem]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search books..."
          aria-label="Search books"
          className="w-full bg-ink-3 border border-ink-4 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-gold/50 transition-colors"
        />
      </div>

      {/* Status pill row — radio-style mutually-exclusive group. */}
      <div className="flex gap-2" role="radiogroup" aria-label="Status filter">
        {STATUS_PILLS.map((pill) => {
          const active = status === pill.key
          return (
            <button
              key={pill.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onStatusChange(pill.key)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                active
                  ? 'bg-gold text-ink-1 font-semibold'
                  : 'bg-ink-3 text-white/50 hover:text-white'
              }`}
            >
              {pill.label}
            </button>
          )
        })}
      </div>

      {/* Sort — native select keeps it accessible without a popover
          library. ml-auto pushes it + the view toggle to the right. */}
      <label className="ml-auto sr-only" htmlFor="library-sort">Sort books</label>
      <select
        id="library-sort"
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortBy)}
        className="bg-ink-3 border border-ink-4 rounded-lg text-white/60 text-xs px-3 py-2 focus:outline-none focus:border-gold/50 transition-colors"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key} className="bg-ink-2 text-white">
            {opt.label}
          </option>
        ))}
      </select>

      {/* View mode toggle — three icon buttons. Active state lit gold. */}
      <div className="flex gap-1" role="radiogroup" aria-label="View mode">
        {VIEW_MODES.map(({ key, label, Icon }) => {
          const active = viewMode === key
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              onClick={() => onViewModeChange(key)}
              className={`p-2 rounded-lg transition-colors ${
                active
                  ? 'text-gold bg-ink-3'
                  : 'text-white/30 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
