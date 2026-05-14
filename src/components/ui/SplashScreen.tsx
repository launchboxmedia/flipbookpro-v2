'use client'

import { useEffect, useState } from 'react'

interface Props {
  onComplete: () => void
}

/** Phase timeline:
 *    0   – book sits closed and floating
 *    1   – cover starts opening (500ms after mount, 1.2s rotation)
 *    2   – pages begin their cascade flip (at 1700ms)
 *    3   – min display reached (3000ms), check if app is ready
 *    4   – ready confirmed, gold glow flash holds for 300ms
 *    5   – screen fades over 400ms then onComplete fires */
type Phase = 0 | 1 | 2 | 3 | 4 | 5

const PHASE_1_AT_MS = 500
const PHASE_2_AT_MS = 1700
const PHASE_3_AT_MS = 3000
const READY_POLL_MS = 100
/** Cap the splash's life even if document.readyState somehow never reports
 *  'complete'. The user should never be stuck on a splash. */
const READY_MAX_WAIT_MS = 5000
const GLOW_HOLD_MS = 300
const FADE_OUT_MS = 400

/** Messages cycle every 600ms during Act 2. Last message is gold-toned so
 *  the colour shift telegraphs the imminent exit. */
const MESSAGES: Array<{ text: string; tone: 'info' | 'gold' }> = [
  { text: 'Gathering your manuscripts...', tone: 'info' },
  { text: 'Inking the illustrations...',   tone: 'info' },
  { text: 'Binding the pages...',          tone: 'info' },
  { text: 'Opening the cover...',          tone: 'gold' },
]
const MESSAGE_TICK_MS = 600

/** Each phase's target width for the progress hairline. Tailwind's
 *  transition-[width] duration smooths the jumps between targets. */
const PROGRESS_BY_PHASE: Record<Phase, number> = {
  0: 0,
  1: 25,
  2: 60,
  3: 90,
  4: 100,
  5: 100,
}

const PAGE_LAYERS = [0, 1, 2, 3, 4]
const PAGE_LINES = [88, 72, 80, 65, 78] // % of page width

/** "The Book Opens" splash — a two-act animation that runs for at least
 *  three seconds regardless of how fast the app finishes loading. The
 *  splash earns its place by completing its full arc; cutting it short
 *  would feel broken. */
export function SplashScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>(0)
  const [msgIdx, setMsgIdx] = useState(0)

  // Act 1 + 2 timeline. Each phase advances at a fixed offset from mount;
  // phases 3+ are gated on readiness so the timeline branches into a poll.
  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase(1), PHASE_1_AT_MS)
    const t2 = window.setTimeout(() => setPhase(2), PHASE_2_AT_MS)
    const t3 = window.setTimeout(() => setPhase(3), PHASE_3_AT_MS)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [])

  // Phase 3 → phase 4: poll document.readyState. The page may already be
  // 'complete' the moment phase 3 lands, in which case we advance on the
  // first tick; if the load is still in flight, pages keep flipping until
  // it settles (or until the safety cap fires).
  useEffect(() => {
    if (phase !== 3) return
    if (typeof document === 'undefined') {
      setPhase(4)
      return
    }
    function check() {
      if (document.readyState === 'complete') setPhase(4)
    }
    check()
    const poll = window.setInterval(check, READY_POLL_MS)
    const safety = window.setTimeout(() => setPhase(4), READY_MAX_WAIT_MS)
    return () => {
      window.clearInterval(poll)
      window.clearTimeout(safety)
    }
  }, [phase])

  // Phase 4 → phase 5 → onComplete. Glow holds for 300ms, then a 400ms
  // fade carries us out and we hand back to AppBootWrapper.
  useEffect(() => {
    if (phase !== 4) return
    const toFade = window.setTimeout(() => setPhase(5), GLOW_HOLD_MS)
    const toDone = window.setTimeout(onComplete, GLOW_HOLD_MS + FADE_OUT_MS)
    return () => {
      window.clearTimeout(toFade)
      window.clearTimeout(toDone)
    }
  }, [phase, onComplete])

  // Message cycle only runs during Act 2 (phase >= 2). Each tick wraps so
  // a slow ready-check keeps cycling rather than stalling on one message.
  useEffect(() => {
    if (phase < 2) return
    setMsgIdx(0)
    const id = window.setInterval(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length)
    }, MESSAGE_TICK_MS)
    return () => window.clearInterval(id)
  }, [phase])

  const opening = phase >= 1
  const flipping = phase >= 2
  const glowing = phase >= 4
  const fadingOut = phase === 5
  const showWordmark = phase < 2
  const activeMessage = MESSAGES[msgIdx]

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-ink-1 flex flex-col items-center justify-center transition-opacity ease-out ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_OUT_MS}ms` }}
      aria-hidden={fadingOut}
      role="status"
      aria-live="polite"
      aria-label="Loading FlipBookPro"
    >
      {/* Outer wrapper sets the 3D perspective; the inner book gets the
          floating bob and the gold-glow flash so the perspective context
          stays clean. */}
      <div className="relative" style={{ perspective: '1200px' }}>
        <div
          className="relative w-40 h-56 animate-book-float rounded-r-xl"
          style={{
            boxShadow: glowing
              ? '0 32px 64px rgba(0,0,0,0.5), 0 0 40px rgba(201,168,76,0.4)'
              : '0 32px 64px rgba(0,0,0,0.5)',
            transition: 'box-shadow 300ms ease-out',
          }}
        >
          {/* Page stack — 5 cream layers, each lightly offset so the closed
              edge fans. Pages stay static during Acts 0–1 and only start
              flipping when `flipping` flips. Inline animation lets us tune
              the duration shorter (0.8s vs BookLoading's 1.2s) so the
              splash feels energetic. */}
          {PAGE_LAYERS.map((i) => (
            <div
              key={i}
              className="absolute bg-cream-1 rounded-r-lg overflow-hidden"
              style={{
                top: `${i}px`,
                right: `${i}px`,
                bottom: `${i}px`,
                left: `${i * 1.5}px`,
                transformStyle: 'preserve-3d',
                transformOrigin: 'left center',
                backfaceVisibility: 'hidden',
                animation: flipping
                  ? `pageFlip 0.8s ease-in-out ${i * 0.16}s infinite`
                  : 'none',
              }}
            >
              <div className="absolute inset-0 px-4 py-5 flex flex-col gap-2">
                {PAGE_LINES.map((w, j) => (
                  <div
                    key={j}
                    className="h-px bg-cream-line/70 rounded-full"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Cover — closed at phase 0, rotates -140deg into the open
              position when `opening` flips. The cover overlays the page
              stack until it rotates out of the way. */}
          <div
            className="absolute inset-0 rounded-r-xl shadow-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0F1623 0%, #1C2333 100%)',
              borderLeft: '5px solid rgba(201,168,76,0.8)',
              transformStyle: 'preserve-3d',
              transformOrigin: 'left center',
              transition: 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: opening ? 'rotateY(-140deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Single-letter monogram on the cover — classic book treatment.
                The cover's rotation carries this out of view in Act 1. */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-gold font-playfair text-4xl leading-none">B</span>
            </div>
            {/* Diagonal shimmer that breathes through the loop. */}
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
      </div>

      {/* Caption stack — same vertical slot, Act 1 holds the wordmark,
          Act 2+ swaps in cycling mono messages. Fixed-height row keeps
          the layout from jittering. */}
      <div className="mt-10 h-12 flex flex-col items-center justify-start gap-3">
        {showWordmark ? (
          <p className="font-playfair text-2xl text-white/80 animate-pulse-logo">
            BookBuilderPro
          </p>
        ) : (
          <div className="h-5 text-center">
            <p
              className={`font-mono text-xs tracking-widest transition-colors duration-300 ${
                activeMessage.tone === 'gold' ? 'text-gold/70' : 'text-blue-400/60'
              }`}
            >
              {activeMessage.text}
            </p>
          </div>
        )}
      </div>

      {/* Progress hairline — width snaps to each phase's target; the
          400ms transition smooths the jumps. Sits at the very bottom of
          the viewport so it stays out of the book's space. */}
      <div className="fixed bottom-0 left-0 right-0 h-0.5 bg-ink-3">
        <div
          className="h-full bg-gold transition-[width] ease-out"
          style={{
            width: `${PROGRESS_BY_PHASE[phase]}%`,
            transitionDuration: '400ms',
          }}
        />
      </div>
    </div>
  )
}
