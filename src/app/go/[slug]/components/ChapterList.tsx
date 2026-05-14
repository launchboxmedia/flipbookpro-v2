'use client'

import { useEffect, useRef } from 'react'

interface Chapter {
  chapter_index: number
  chapter_title: string
}

interface Props {
  chapters: Chapter[]
  /** Total chapter count — drives the "+ N more chapters" overflow line.
   *  Separate from chapters.length because the parent has already
   *  computed it for the section heading and we want to stay consistent. */
  totalCount: number
  /** Drives the gold "N Downloadable Resources Included" card below the
   *  chapter list. 0 = card hidden entirely. */
  resourceCount: number
}

const VISIBLE_LIMIT = 6

/** Scroll-reveal chapter list. Each row sits at opacity-0 + translate-y-3
 *  until its first intersection with the viewport, then transitions in
 *  with a staggered delay (i * 80ms). Honours prefers-reduced-motion by
 *  flipping every row to "visible" on mount without setting up an
 *  observer. */
export function ChapterList({ chapters, totalCount, resourceCount }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const items = containerRef.current?.querySelectorAll<HTMLElement>('[data-chapter-reveal]')
    if (!items || items.length === 0) return

    // Reduced-motion users get the final state immediately — no
    // observer, no delay, no transition. globals.css also collapses the
    // transition duration to 1ms under the same media query, so this is
    // belt-and-suspenders.
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => el.classList.add('chapter-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('chapter-visible')
            // One-shot — once an item has revealed, stop observing it
            // so scrolling away and back doesn't re-trigger.
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.1 },
    )
    items.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [chapters])

  const visibleChapters = chapters.slice(0, VISIBLE_LIMIT)
  const overflowCount = totalCount > VISIBLE_LIMIT ? totalCount - VISIBLE_LIMIT : 0

  return (
    <div ref={containerRef}>
      <ol className="space-y-6">
        {visibleChapters.map((ch, i) => (
          <li
            key={ch.chapter_index}
            data-chapter-reveal
            // Initial state: opacity-0 + translate-y-3. The
            // arbitrary-selector pair flips to opacity-1 + translate-y-0
            // once `chapter-visible` is added by the observer. The
            // staggered transitionDelay is inline so each row's delay is
            // unique without a class explosion.
            className="flex items-start gap-5 opacity-0 translate-y-3 transition-all duration-[400ms] ease-out [&.chapter-visible]:opacity-100 [&.chapter-visible]:translate-y-0"
            style={{ transitionDelay: `${i * 0.08}s` }}
          >
            <span className="font-playfair text-3xl font-bold text-gold/40 w-10 flex-shrink-0 leading-none">
              {i + 1}
            </span>
            <span className="font-source-serif text-white text-lg leading-snug">
              {ch.chapter_title}
            </span>
          </li>
        ))}
      </ol>

      {overflowCount > 0 && (
        <p className="text-white/30 text-sm mt-8 text-center">
          + {overflowCount} more chapter{overflowCount === 1 ? '' : 's'}
        </p>
      )}

      {resourceCount > 0 && (
        <div className="mt-16 border border-gold/20 bg-gold/5 rounded-2xl p-8 flex items-start gap-4">
          <span className="text-2xl shrink-0" aria-hidden="true">📎</span>
          <div>
            <p className="font-playfair text-gold text-xl mb-2">
              {resourceCount} Downloadable {resourceCount === 1 ? 'Resource' : 'Resources'} Included
            </p>
            <p className="font-source-serif text-white/50 text-base leading-relaxed">
              Checklists, templates, scripts, and frameworks — practical tools you keep and use beyond the book.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
