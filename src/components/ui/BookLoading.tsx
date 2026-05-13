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

const SIZE_MAP: Record<Size, { wrapper: string; cover: string; perspective: string }> = {
  sm: { wrapper: 'w-8 h-10',   cover: 'w-8 h-10',   perspective: '300px' },
  md: { wrapper: 'w-12 h-16',  cover: 'w-12 h-16',  perspective: '400px' },
  lg: { wrapper: 'w-20 h-28',  cover: 'w-20 h-28',  perspective: '600px' },
}

const PAGES = [0, 1, 2, 3]
const LINE_WIDTHS = [70, 88, 60] // % of page width

export function BookLoading({ label, size = 'md', className }: Props) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    if (label) return
    const id = window.setInterval(() => {
      setMessageIndex((i) => (i + 1) % ROTATING_MESSAGES.length)
    }, 2000)
    return () => window.clearInterval(id)
  }, [label])

  const { wrapper, perspective } = SIZE_MAP[size]
  const currentMessage = label ?? ROTATING_MESSAGES[messageIndex]

  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ''}`}>
      <div className={`relative ${wrapper}`} style={{ perspective }} aria-hidden="true">
        <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
          {/* Spine + cover. Linear gradient + gold left border reads as a
              bound edge; the inset shimmer adds the "well-loved leather"
              highlight that breathes through the loop. */}
          <div
            className="absolute inset-0 rounded-r-sm shadow-xl overflow-hidden"
            style={{
              borderLeft: '3px solid rgba(201,168,76,0.7)',
              background: 'linear-gradient(135deg, #0F1623 0%, #1C2333 100%)',
            }}
          >
            <div
              className="absolute inset-0 animate-shimmer"
              style={{
                background:
                  'linear-gradient(135deg, transparent 30%, rgba(201,168,76,0.08) 50%, transparent 70%)',
                backgroundSize: '200% 200%',
              }}
            />
          </div>

          {/* Page stack. Each page is offset by a couple px so the closed
              edge fans out, then flips on a staggered animation-delay so
              the loop reads as a continuous wave rather than four pages
              snapping in sync. */}
          {PAGES.map((i) => (
            <div
              key={i}
              className="absolute bg-cream-1 rounded-r-sm overflow-hidden"
              style={{
                top: `${2 + i}px`,
                right: `${2 + i}px`,
                bottom: `${2 + i}px`,
                left: `${4 + i * 2}px`,
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden',
                transformOrigin: 'left center',
                animation: `pageFlip 1.2s ease-in-out ${i * 0.15}s infinite`,
              }}
            >
              {LINE_WIDTHS.map((w, j) => (
                <div
                  key={j}
                  className="bg-ink-4/30 rounded-full"
                  style={{
                    height: '1px',
                    width: `${w}%`,
                    margin: j === 0 ? '20% 8% 0' : '8% 8% 0',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
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
