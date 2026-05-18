'use client'

import type { BookWithMeta, ShelfKey } from './types'
import { BookSpine } from './BookSpine'

interface Props {
  shelfKey: ShelfKey
  label: string
  books: BookWithMeta[]
}

const GRAIN_BACKWALL =
  'repeating-linear-gradient(90deg, transparent, transparent 80px, rgba(255,255,255,0.02) 80px, rgba(255,255,255,0.02) 82px)'

const GRAIN_SHELF =
  'repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(0,0,0,0.15) 30px, rgba(0,0,0,0.15) 31px, transparent 31px, transparent 55px, rgba(255,255,255,0.04) 55px, rgba(255,255,255,0.04) 56px)'

const ROOM_LIGHT =
  'radial-gradient(ellipse 120% 60% at 50% 100%, rgba(201,168,76,0.05) 0%, transparent 70%)'

/** A single bookshelf — a real wooden bookcase. Three stack inside the
 *  Library shell. Hides itself when its group is empty. Light mode reads
 *  as warm oak; dark mode as deep mahogany. */
export function Bookshelf({ label, books }: Props) {
  if (books.length === 0) return null

  return (
    <section className="mb-10" aria-label={`${label} shelf`}>
      {/* Room lighting — a soft warm pool behind the case so it reads as
          furniture in a room, not a card on a canvas. */}
      <div className="relative" style={{ background: ROOM_LIGHT }}>
        {/* Bookcase frame */}
        <div className="relative rounded-2xl overflow-hidden border-4 border-[#3D2512] bg-[#6B3D1A] dark:bg-[#2C1A0E] shadow-2xl shadow-black/60">
          {/* Top cornice */}
          <div
            className="h-6 w-full bg-gradient-to-b from-[#3D2512] to-[#2C1A0E] border-b-2 border-[#1A0E06]"
            aria-hidden="true"
          />

          {/* Back wall + interior */}
          <div
            className="relative bg-[#4A2810] dark:bg-[#1A0E06]"
            style={{ backgroundImage: GRAIN_BACKWALL }}
          >
            {/* Bookcase side panels */}
            <div
              className="absolute left-0 top-0 bottom-0 w-4 z-20 bg-gradient-to-r from-[#1A0E06] to-[#2C1A0E]"
              aria-hidden="true"
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-4 z-20 bg-gradient-to-l from-[#1A0E06] to-[#2C1A0E]"
              aria-hidden="true"
            />

            {/* Library section label — engraved on the shelf, inside the case */}
            <p className="px-6 pt-3 pb-1 text-[10px] uppercase tracking-widest font-medium text-[#C9A84C]/60">
              {label} · {books.length}
            </p>

            {/* Books standing area — packed tightly, varying heights all
                resting on the shelf baseline. */}
            <div className="relative z-0 px-6 pt-4 pb-0 min-h-[200px] flex items-end gap-[2px] flex-wrap">
              {books.map((book, i) => (
                <BookSpine key={book.id} book={book} index={i} />
              ))}
            </div>

            {/* Shelf surface — the thick wood the books stand on */}
            <div className="relative h-6 w-full bg-gradient-to-b from-[#A07030] via-[#8B5E1A] to-[#7A5015] dark:from-[#8B5E1A] dark:via-[#7A5015] dark:to-[#6B4410]">
              <div className="absolute inset-0" style={{ backgroundImage: GRAIN_SHELF }} aria-hidden="true" />
              {/* Front edge highlight */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-[#C9A84C]/20" aria-hidden="true" />
              {/* Shelf brackets, left + right */}
              <div
                className="absolute bottom-0 left-4 w-4 h-10 bg-gradient-to-b from-[#4A2E10] to-[#2C1A0E]"
                style={{ borderRadius: '2px 2px 0 0' }}
                aria-hidden="true"
              />
              <div
                className="absolute bottom-0 right-4 w-4 h-10 bg-gradient-to-b from-[#4A2E10] to-[#2C1A0E]"
                style={{ borderRadius: '2px 2px 0 0' }}
                aria-hidden="true"
              />
            </div>

            {/* Shelf drop shadow — the underside catching ambient light */}
            <div className="h-4 w-full bg-gradient-to-b from-black/50 to-transparent" aria-hidden="true" />
          </div>

          {/* Bottom plinth */}
          <div
            className="h-5 w-full bg-gradient-to-b from-[#2C1A0E] to-[#1A0E06] border-t-2 border-[#1A0E06]"
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  )
}
