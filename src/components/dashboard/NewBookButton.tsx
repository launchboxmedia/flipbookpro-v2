'use client'

import { useEffect, useState } from 'react'
import { Plus, X, ArrowRight, Sparkles, Upload } from 'lucide-react'
import Link from 'next/link'
import { createBook } from '@/app/dashboard/actions'

type StartMode = 'scratch' | 'upload'

export function NewBookButton() {
  const [loading, setLoading]   = useState(false)
  const [showGate, setShowGate] = useState(false)
  const [showChoice, setShowChoice] = useState(false)
  const [creating, setCreating] = useState<StartMode | null>(null)
  const [gateInfo, setGateInfo] = useState<{ plan: string; used: number; limit: number } | null>(null)

  // Plan-limit check is the gate before the choice modal — a user at their
  // monthly book cap should see the upgrade prompt, not be invited to pick a
  // creation mode they can't actually use.
  async function handleClick() {
    setLoading(true)
    try {
      const res  = await fetch('/api/books/check-limit')
      const data = await res.json()
      if (!data.allowed) {
        setGateInfo({ plan: data.plan, used: data.used, limit: data.limit })
        setShowGate(true)
        return
      }
      setShowChoice(true)
    } finally {
      setLoading(false)
    }
  }

  async function pickMode(mode: StartMode) {
    if (creating) return
    setCreating(mode)
    // eslint-disable-next-line no-console
    console.log('[NewBookButton] navigating with mode:', mode)
    if (mode === 'upload') {
      // Wired but not built — let users discover it without blocking, and
      // leave a console hint for whoever's wiring up the upload UI next.
      // eslint-disable-next-line no-console
      console.warn('Upload flow not yet built')
    }
    await createBook(mode)
    // createBook redirects server-side; if we somehow get here, fall back.
    setCreating(null)
  }

  // Escape closes whichever modal is open. Two listeners would race, so we
  // guard on whichever modal is actually visible.
  useEffect(() => {
    if (!showChoice && !showGate) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (showChoice) setShowChoice(false)
      else if (showGate) setShowGate(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showChoice, showGate])

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter text-sm font-semibold rounded-lg shadow-[0_4px_18px_-6px_rgba(201,168,76,0.5)] transition-colors disabled:opacity-60"
      >
        <Plus className="w-4 h-4" />
        {loading ? 'Checking…' : 'New Book'}
      </button>

      {/* Choice modal — two-card "how to start" */}
      {showChoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-1/85 backdrop-blur-sm p-4"
          onClick={() => setShowChoice(false)}
        >
          <div
            className="bg-ink-2 border border-ink-3 rounded-2xl p-8 max-w-2xl w-full relative shadow-[0_28px_60px_-24px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-book-modal-title"
          >
            <button
              onClick={() => setShowChoice(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-cream-1/50 hover:text-cream-1 hover:bg-ink-3 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-7">
              <h2
                id="new-book-modal-title"
                className="font-playfair text-2xl text-cream-1 mb-1.5"
              >
                How would you like to start?
              </h2>
              <p className="font-inter text-sm text-cream-1/60">
                Choose the option that fits your situation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => pickMode('scratch')}
                disabled={creating !== null}
                className="group text-left p-6 rounded-xl bg-ink-3 border border-ink-4 hover:border-gold/60 hover:shadow-[0_0_0_1px_rgba(201,168,76,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-gold/15 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-gold" />
                  </div>
                  <h3 className="font-playfair text-base text-cream-1 font-semibold">
                    Build from scratch
                  </h3>
                </div>
                <p className="font-inter text-xs text-cream-1/65 leading-relaxed mb-5">
                  Describe your idea and AI writes, illustrates, and formats a
                  complete flipbook for you.
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter text-xs font-semibold rounded-md transition-colors">
                  {creating === 'scratch' ? 'Creating…' : 'Get Started'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => pickMode('upload')}
                disabled={creating !== null}
                className="group text-left p-6 rounded-xl bg-ink-3 border border-ink-4 hover:border-gold/60 hover:shadow-[0_0_0_1px_rgba(201,168,76,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-gold/15 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-gold" />
                  </div>
                  <h3 className="font-playfair text-base text-cream-1 font-semibold">
                    Upload existing content
                  </h3>
                </div>
                <p className="font-inter text-xs text-cream-1/65 leading-relaxed mb-5">
                  Paste your manuscript or upload a PDF. AI formats it into a
                  flipbook and generates illustrations for each chapter.
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter text-xs font-semibold rounded-md transition-colors">
                  {creating === 'upload' ? 'Creating…' : 'Upload Content'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan limit gate */}
      {showGate && gateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-8 max-w-sm w-full mx-4 relative">
            <button
              onClick={() => setShowGate(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-cream transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-5">
              <p className="text-xs font-inter text-muted-foreground uppercase tracking-widest mb-2">Book limit reached</p>
              <h2 className="font-playfair text-xl text-cream">
                You&apos;ve used {gateInfo.used} of {gateInfo.limit} book{gateInfo.limit !== 1 ? 's' : ''} this month
              </h2>
              <p className="text-sm font-source-serif text-muted-foreground mt-2">
                Your <span className="text-cream capitalize">{gateInfo.plan}</span> plan allows {gateInfo.limit} book{gateInfo.limit !== 1 ? 's' : ''} per month. Upgrade to create more.
              </p>
            </div>

            <div className="space-y-2">
              <Link
                href="/settings/billing"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-semibold rounded-lg transition-colors"
              >
                Upgrade Plan
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setShowGate(false)}
                className="w-full py-2.5 text-muted-foreground font-inter text-sm hover:text-cream transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
