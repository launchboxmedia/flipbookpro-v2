'use client'

import { useEffect, useState } from 'react'

/** Cycled while no explicit label is provided — they make a few-hundred-ms
 *  wait feel intentional instead of empty. Each message reads as a discrete
 *  step in producing a book so the user catches the metaphor without the
 *  surface having to spell it out. */
const ROTATING_MESSAGES = [
  'Sharpening the quill...',
  'Warming up the press...',
  'Turning the pages...',
  'Setting the type...',
  'Almost there...',
] as const

type Size = 'sm' | 'md' | 'lg'

interface Props {
  /** When provided, the label is static; otherwise the rotating book-themed
   *  messages cycle every 2s. */
  label?: string
  size?: Size
  className?: string
}

const SIZE_MAP: Record<Size, string> = {
  sm: 'w-8 h-10',
  md: 'w-12 h-16',
  lg: 'w-16 h-20',
}

/** Subtle in-app loader. A small closed book with a single tied
 *  scale + opacity breath and a thin cream sliver that nudges from
 *  behind the right edge in time with the breath. Reads as "alive
 *  and waiting" without demanding attention — the elaborate page-
 *  flipping animation lives in SplashScreen where it earns the
 *  spotlight. */
export function BookLoading({ label, size = 'md', className }: Props) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    if (label) return
    const id = window.setInterval(() => {
      setMessageIndex((i) => (i + 1) % ROTATING_MESSAGES.length)
    }, 2000)
    return () => window.clearInterval(id)
  }, [label])

  const wrapper = SIZE_MAP[size]
  const currentMessage = label ?? ROTATING_MESSAGES[messageIndex]

  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ''}`}>
      {/* The book — the breath animation animates the entire wrapper
          (scale + opacity); a thin page sliver behind the right edge
          slides on the same 1.5s clock so the motion reads as a single
          coherent gesture rather than two independent loops. */}
      <div className={`relative ${wrapper} animate-book-breathe`} aria-hidden="true">
        {/* Cover — flat ink-1 fill with the same gold spine as the splash
            so the loaders read as the same artifact at different scales. */}
        <div
          className="absolute inset-0 bg-ink-1 rounded-r-sm"
          style={{ borderLeft: '2px solid rgba(201,168,76,0.7)' }}
        />
        {/* Page sliver — 2px-wide cream sliver behind the right edge.
            Sits inset top/bottom by 2px so it reads as a page peeking
            out, not a full second cover. */}
        <div
          className="absolute right-0 w-0.5 bg-cream-1 rounded-r-sm animate-page-sliver"
          style={{ top: '2px', bottom: '2px' }}
        />
      </div>

      {/* Label — pulses subtly to confirm the loader is alive even if the
          message itself hasn't rotated yet. The aria-live region narrates
          the metaphor instead of staying silent. */}
      <p
        className="text-white/50 text-sm font-inter text-center animate-pulse-subtle transition-opacity duration-500"
        role="status"
        aria-live="polite"
      >
        {currentMessage}
      </p>
    </div>
  )
}

/** Full-page variant — centered on a dark canvas. Use as a Suspense fallback
 *  or while a route-level data fetch is in flight. */
export function FullPageBookLoader({ label }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink-1">
      <BookLoading size="lg" label={label} />
    </div>
  )
}

/** Section-level variant — fits inside a card or content area without
 *  collapsing the surrounding layout. */
export function ContentBookLoader({ label }: { label?: string }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center">
      <BookLoading size="md" label={label} />
    </div>
  )
}
