'use client'

import type { BookWithMeta, ShelfKey } from './types'
import { BookSpine } from './BookSpine'

interface Props {
  shelfKey: ShelfKey
  label: string
  books: BookWithMeta[]
}

const LABEL_COLOR: Record<ShelfKey, string> = {
  published:  'text-gold',
  ready:      'text-ink-1/60 dark:text-white/60',
  inProgress: 'text-ink-1/30 dark:text-white/30',
}

/** A single bookshelf — three of these stack inside the Library shell.
 *  Hides itself when its group is empty so the page doesn't render a
 *  parade of "no books" placeholders. */
export function Bookshelf({ shelfKey, label, books }: Props) {
  if (books.length === 0) return null

  const labelColor = LABEL_COLOR[shelfKey]

  return (
    <section className="mb-8" aria-label={`${label} shelf`}>
      {/* Shelf label row — small overline + count + a hairline rule that
          carries the eye across to the next shelf, separating groups
          without a heavy divider. */}
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-xs uppercase tracking-widest font-semibold ${labelColor}`}>
          {label}
        </span>
        <span className="text-ink-1/20 dark:text-white/20 text-xs">({books.length})</span>
        <div className="flex-1 h-px bg-cream-3 dark:bg-ink-3/50" />
      </div>

      {/* Shelf container — the back wall + a wood-toned bottom strip
          + a soft shadow under the shelf. The books stand on the wood
          strip; rounded corners on the container give the bookshelf
          its silhouette without a heavy frame. */}
      <div className="bg-cream-2 dark:bg-ink-2/40 rounded-2xl border border-cream-3 dark:border-ink-3 overflow-hidden">
        {/* Books — flex items-end so books of varying heights all stand
            on the same baseline. flex-wrap so a shelf with 30 books
            wraps onto a second row gracefully. */}
        <div className="flex items-end gap-1.5 flex-wrap px-6 pt-8 pb-0 min-h-[160px]">
          {books.map((book, i) => (
            <BookSpine key={book.id} book={book} index={i} />
          ))}
        </div>

        {/* The shelf surface — horizontal wood strip the books stand on.
            Gradient from ink-4 to ink-3 to ink-4 gives the strip a
            warmer, slightly polished feel against the cooler back wall. */}
        <div className="h-4 w-full bg-[#D4C5A9] dark:bg-gradient-to-r dark:from-ink-4 dark:via-ink-3 dark:to-ink-4 border-t border-[#E8E0D0] dark:border-ink-4/80" aria-hidden="true" />
        {/* Shadow below the shelf — the underside of the wood catching
            ambient light. Sells the volume. */}
        <div className="h-2 w-full bg-gradient-to-b from-black/30 to-transparent" aria-hidden="true" />
      </div>
    </section>
  )
}
