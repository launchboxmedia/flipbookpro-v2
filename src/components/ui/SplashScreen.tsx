'use client'

import { useEffect, useState } from 'react'

interface Props {
  onComplete: () => void
}

/** Sequence: each tier holds until its progress threshold lands, then the
 *  message advances. The final "Opening the cover..." is timed to the cover
 *  rotation so the copy and the visual settle together. */
const MESSAGES: Array<{ text: string; minProgress: number; tone: 'info' | 'gold' }> = [
  { text: 'Gathering your manuscripts...', minProgress:  0, tone: 'info' },
  { text: 'Inking the illustrations...',   minProgress: 33, tone: 'info' },
  { text: 'Binding the pages...',          minProgress: 66, tone: 'info' },
  { text: 'Opening the cover...',          minProgress: 95, tone: 'gold' },
]

const PROGRESS_TICK_MS = 25     // 1% per tick → ~2.5s to 100%
const HOLD_AFTER_FULL_MS = 800  // dwell on the open-cover frame
const FADE_OUT_MS = 300         // crossfade to the app underneath

/** "The Book Opens" splash. Pure CSS animations — a closed book sits on the
 *  canvas while progress fills along the bottom. When progress lands at 100,
 *  the cover hinge animates open to reveal cream pages, the screen fades,
 *  and the parent's `onComplete` swaps the splash off. */
export function SplashScreen({ onComplete }: Props) {
  const [progress, setProgress] = useState(0)
  const [opening, setOpening] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)

  // Progress fill — single interval that increments and clears itself once
  // it hits 100. Kept as a setInterval rather than a CSS-only width
  // transition so the message tiers stay in sync with the actual progress
  // value (the final message gating is value-driven).
  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          window.clearInterval(id)
          return 100
        }
        return p + 1
      })
    }, PROGRESS_TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  // Drive the exit sequence off the progress value so the visual stays in
  // lockstep with the count — no separate timer that could drift.
  useEffect(() => {
    if (progress < 100) return
    setOpening(true)
    const fadeAt = window.setTimeout(() => setFadingOut(true), HOLD_AFTER_FULL_MS)
    const doneAt = window.setTimeout(onComplete, HOLD_AFTER_FULL_MS + FADE_OUT_MS)
    return () => {
      window.clearTimeout(fadeAt)
      window.clearTimeout(doneAt)
    }
  }, [progress, onComplete])

  const active = MESSAGES.reduce((best, m) => (progress >= m.minProgress ? m : best), MESSAGES[0])

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-ink-1 flex flex-col items-center justify-center transition-opacity duration-300 ease-out ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-hidden={fadingOut}
      role="status"
      aria-live="polite"
      aria-label="Loading FlipBookPro"
    >
      {/* The book — wrapper sets the 3D perspective so the cover hinge
          actually folds back instead of flattening. */}
      <div className="relative" style={{ perspective: '1000px' }}>
        {/* Inner pages — cream surface with faint horizontal lines. Sits
            behind the cover so the cover rotation reveals it. */}
        <div className="absolute inset-0 w-32 h-44 bg-cream-1 rounded-r-lg overflow-hidden shadow-inner">
          <div className="absolute inset-0 px-4 py-6 flex flex-col gap-2">
            {[80, 92, 70, 88, 60, 78, 65].map((w, i) => (
              <div key={i} className="h-px bg-cream-line rounded-full" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>

        {/* The cover — pivots on the left edge. Closed at first, opens to
            -140deg when `opening` flips, controlled by a CSS transition
            so the spec's curve (cubic-bezier(0.4,0,0.2,1) 1.5s) drives it. */}
        <div
          className="relative w-32 h-44 rounded-r-lg shadow-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0F1623 0%, #1C2333 100%)',
            borderLeft: '4px solid #C9A84C',
            transformStyle: 'preserve-3d',
            transformOrigin: 'left center',
            transition: 'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: opening ? 'rotateY(-140deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Cover title — sits on the front face; the rotation carries it
              out of view as the cover opens. */}
          <div className="absolute inset-0 flex items-center justify-center px-3">
            <span className="text-gold font-playfair text-sm tracking-wide text-center leading-tight">
              BookBuilderPro
            </span>
          </div>
          {/* Cover shimmer — diagonal highlight that breathes. */}
          <div
            className="absolute inset-0 animate-shimmer pointer-events-none"
            style={{
              background:
                'linear-gradient(135deg, transparent 30%, rgba(201,168,76,0.1) 50%, transparent 70%)',
              backgroundSize: '200% 200%',
            }}
          />
        </div>
      </div>

      {/* Wordmark — settles below the book once the metaphor is established. */}
      <p className="font-playfair text-2xl text-white mt-8 animate-pulse-logo">
        BookBuilderPro
      </p>

      {/* Loading tier message — fixed-height row so the layout doesn't jitter
          when copy changes length. */}
      <div className="h-5 mt-4 text-center">
        <p
          className={`font-mono text-xs tracking-widest transition-colors duration-300 ${
            active.tone === 'gold' ? 'text-gold/80' : 'text-blue-400/70'
          }`}
        >
          {active.text}
        </p>
      </div>

      {/* Progress bar — single-pixel hairline at the bottom of the viewport. */}
      <div className="fixed bottom-0 left-0 right-0 h-0.5 bg-ink-3">
        <div
          className="h-full bg-gold transition-[width] duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
