'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Step1Radar } from './Step1Radar'
import { Step2Persona } from './Step2Persona'
import { Step2Meta } from './Step2Meta'
import { Step4ToneReader } from './Step4ToneReader'
import { Step5StyleCover } from './Step5StyleCover'
import { Step6Typography } from './Step6Typography'
import { Check } from 'lucide-react'
import type { RadarResult, CreatorRadarResult } from '@/types/database'

// Step order — 6 steps. Radar runs first, then persona triggers the
// per-book deep radar in the background, then title / tone / look-and-
// feel / typography. Setup runs at the end of typography. Chapters
// aren't collected here anymore — the OutlineStage in coauthor auto-
// generates them from radar context after the wizard completes.
const STEPS = [
  'Radar',
  'Persona',
  'Details',
  'Tone',
  'Style',
  'Typography',
]

export interface WizardData {
  outline: string
  chapters: Array<{ title: string; brief: string }>
  title: string
  subtitle: string
  authorName: string
  persona: string
  // Creator Radar inputs collected on the Audience step. All three are
  // optional — radar gracefully degrades when they're missing.
  targetAudience: string
  /** Only relevant for the `business` persona — used by Firecrawl. */
  websiteUrl: string
  /** Only relevant for the `storyteller` persona — drives genre-specific
   *  comp-title research in the Perplexity prompt. */
  genre: string
  // Business-persona-only context. Fed into Creator Radar (sharpens
  // positioning + monetization advice) and the chapter draft prompt
  // (informs a persona-appropriate close + lets the model weave proof).
  /** What the author sells: coaching / course / service / product / consulting / other. */
  offerType: string
  /** What they want readers to do after finishing — short free-form. */
  ctaIntent: string
  /** Pasted testimonials / social proof. Free-form, capped server-side. */
  testimonials: string
  vibe: string
  writingTone: string
  readerLevel: number
  humanScore: boolean
  visualStyle: string
  palette: string
  coverDirection: string
  typography: string
  // ── Step 1 radar context (wizard-session only, NOT persisted) ───────────
  // The wizard-progress route drops unknown fields, so these never round-
  // trip to the books row. They live in client memory for the duration of
  // the wizard so later steps can pre-fill / decorate from the discovery
  // scan the user just ran.
  /** Niche / topic the user typed into the Step 1 search field. */
  niche?: string
  /** A radar result the user clicked. Free-form string — could be a hot
   *  signal topic, an evergreen winner, or a hidden gold niche. */
  radarTopic?: string
  /** Full shared-discovery radar payload — feeds Step 3 title generation
   *  and Step 4 audience pre-fill. */
  radarResults?: CreatorRadarResult
  /** Step 1 textarea — the user's own description of the book idea.
   *  Optional companion to / alternative to the radar pick. When set,
   *  takes priority as the topic that flows into title generation and
   *  chapter generation; the radar still supplements with market signals. */
  ideaDescription?: string
  /** True once the per-book deep Creator Radar has been fired in the
   *  background by the Audience→Outline transition. Step 4 reads this
   *  to decide whether to poll for radar results before generating
   *  chapters. Wizard-session only; never persisted. */
  deepRadarFired?: boolean
}

interface WizardShellProps {
  bookId: string
  initialData?: Partial<WizardData>
  maxChapters?: number
  initialStep?: number
  /** Step 1 entry mode. 'scratch' = user describes idea, AI proposes a
   *  chapter structure; 'upload' (default) = user pastes an outline / TOC,
   *  AI parses it. Subsequent steps don't depend on mode. */
  mode?: 'scratch' | 'upload'
  /** Radar fields from the book row, hydrated by the wizard page. The
   *  Radar step uses these to decide between auto-firing (first run) and
   *  hydrating an existing result on re-entry. */
  initialRadar?: {
    ranAt:     string | null
    data:      RadarResult | null
    appliedAt: string | null
  }
  /** Plan tier as Creator Radar sees it. Admin collapses to 'pro' upstream
   *  in the wizard page so the panel only ever has to handle 3 buckets. */
  radarPlan?: 'free' | 'standard' | 'pro'
}

export function WizardShell({
  bookId, initialData, maxChapters = 6, initialStep = 0, mode = 'upload',
  initialRadar = { ranAt: null, data: null, appliedAt: null },
  radarPlan = 'free',
}: WizardShellProps) {
  // eslint-disable-next-line no-console
  console.log('[WizardShell] mode:', mode)
  const isEditing = (initialData?.chapters?.length ?? 0) > 0
  const clampedInitial = Math.max(0, Math.min(STEPS.length - 1, initialStep))
  const [step, setStep] = useState(isEditing ? clampedInitial : 0)
  const [data, setData] = useState<WizardData>({
    outline: '',
    chapters: [],
    title: '',
    subtitle: '',
    authorName: '',
    persona: '',
    targetAudience: '',
    websiteUrl: '',
    genre: '',
    offerType: '',
    ctaIntent: '',
    testimonials: '',
    vibe: '',
    writingTone: '',
    readerLevel: 5,
    humanScore: false,
    visualStyle: '',
    palette: '',
    coverDirection: '',
    typography: '',
    ...initialData,
  })

  async function next(patch: Partial<WizardData>) {
    const merged: WizardData = { ...data, ...patch }

    // Details (index 2) → Tone (index 3) is the special case: by this
    // transition the user has typed the niche (Step 1), persona +
    // offerType (Step 2), and title + subtitle (Step 3). All of these
    // feed the Creator Radar's intelligence_cache key, so firing here
    // gives the cache meaningful entropy per-book — versus firing on
    // step 1→2 (the old persona transition), where title/niche/etc.
    // hadn't landed yet and every new book hashed to the same key.
    //
    // We AWAIT the wizard-progress save before firing so the radar
    // route reads the freshly-persisted niche + title + persona off
    // the books row. Then fire-and-forget; the coauthor interstitial
    // polls books.creator_radar_data when the user lands there.
    const isDetailsToTone = step === 2

    if (isDetailsToTone) {
      // Pre-set deepRadarFired so the interstitial knows a fire is in
      // flight. Set it BEFORE setData/setStep so mount effects see it.
      merged.deepRadarFired = true
      setData(merged)
      try {
        await persistProgress(merged)
      } catch {
        // persistProgress already swallows errors; included here so even
        // an unexpected throw doesn't block step advance.
      }
      // Fire and don't await. Stream the SSE to completion in the
      // background so the result lands in books.creator_radar_data;
      // the interstitial polls for that to appear.
      void fireDeepRadar()
    } else {
      setData(merged)
      void persistProgress(merged)
    }

    setStep((s) => s + 1)
  }

  /** Background per-book radar trigger. The route streams results as SSE;
   *  we drain the reader so the route's persistence side-effect runs to
   *  completion. Errors are silent — radar enhances the outline step but
   *  doesn't gate it. */
  async function fireDeepRadar() {
    try {
      const res = await fetch(`/api/books/${bookId}/creator-radar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh: false }),
      })
      const reader = res.body?.getReader()
      if (!reader) return
      // Drain the stream — we don't read the deltas, we just need the
      // server's persistence path (intelligence_cache + books.creator_
      // radar_data update) to complete.
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    } catch {
      // Silent — Step 4's poll will time out gracefully and proceed
      // without per-book context.
    }
  }

  function back() {
    setStep((s) => Math.max(0, s - 1))
  }

  async function persistProgress(d: WizardData) {
    try {
      await fetch(`/api/books/${bookId}/wizard-progress`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(d),
      })
    } catch {
      // Silent — the next step transition tries again with the latest state.
    }
  }

  return (
    <div className="min-h-screen bg-canvas relative overflow-hidden">
      {/* Subtle gold radial accent */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.08)_0%,transparent_55%)]" />

      <div className="relative max-w-3xl mx-auto px-4 py-12">
        {/* Always-visible back arrow. On step > 0 it goes to the previous
            step; on step 0 it goes home. Editing flow keeps the explicit
            "Back to book" affordance below since it's a different mental
            model (jumping out of edit mode). */}
        <button
          type="button"
          onClick={() => {
            if (step > 0) setStep((s) => s - 1)
            else window.location.href = '/dashboard'
          }}
          aria-label={step > 0 ? 'Previous step' : 'Back to dashboard'}
          className="inline-flex items-center gap-1.5 text-xs font-inter text-ink-subtle hover:text-cream transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {step > 0 ? 'Back' : 'Back to dashboard'}
        </button>

        {isEditing && (
          <Link
            href={`/book/${bookId}/coauthor`}
            className="inline-flex items-center gap-1.5 text-xs font-inter text-ink-subtle hover:text-cream transition-colors mb-6 ml-4"
          >
            Back to book
          </Link>
        )}
        <div className="mb-10">
          <p className="text-[10px] font-inter font-semibold text-gold-dim uppercase tracking-[0.22em] mb-2 text-center">
            {isEditing ? 'Edit Book' : 'New Book'}
          </p>
          <h1 className="font-playfair text-4xl text-cream font-semibold mb-7 text-center">
            Set the foundations
          </h1>

          {/* Mobile-only condensed step indicator. Below sm the full
              pill row gets unreadable in 320px viewports — show
              "Step N of M" instead. The pill row reappears at sm+. */}
          <p className="sm:hidden text-center text-sm font-inter text-ink-subtle">
            Step {step + 1} of {STEPS.length}
            <span className="text-ink-muted/60 mx-1.5" aria-hidden="true">·</span>
            <span className="text-gold">{STEPS[step]}</span>
          </p>

          <div className="hidden sm:flex items-center justify-between">
            {STEPS.map((label, i) => {
              const pill = (
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-inter font-medium transition-all ${
                    i < step
                      ? 'bg-gold text-ink-1 shadow-[0_0_18px_-4px_rgba(201,168,76,0.5)]'
                      : i === step
                      ? 'bg-gold text-ink-1 ring-2 ring-gold/40 ring-offset-2 ring-offset-canvas'
                      : 'bg-ink-2 text-ink-subtle border border-ink-3'
                  }`}
                >
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
              )
              return (
                <div key={i} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => setStep(i)}
                        className="cursor-pointer"
                        aria-label={`Go to step ${i + 1}: ${label}`}
                      >
                        {pill}
                      </button>
                    ) : (
                      pill
                    )}
                    <span className={`text-[10px] font-inter tracking-wide ${i === step ? 'text-gold font-medium' : 'text-ink-subtle'}`}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px w-6 sm:w-8 mx-1 transition-colors ${i < step ? 'bg-gold' : 'bg-ink-3'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Cream "page" on a dark canvas — feels like a deliberate
            manuscript step rather than a dark form. AnimatePresence cross-fades
            the form between steps; the step indicator carries enough
            wayfinding that we don't need a heavy slide. */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="bg-cream-1 border border-cream-3 rounded-2xl p-9 shadow-[0_28px_60px_-24px_rgba(0,0,0,0.55)] ring-1 ring-gold/15"
            >
              {step === 0 && <Step1Radar       data={data} onNext={next} mode={mode} />}
              {step === 1 && <Step2Persona     data={data} onNext={next} onBack={back} />}
              {step === 2 && <Step2Meta        data={data} bookId={bookId} onNext={next} onBack={back} />}
              {step === 3 && <Step4ToneReader  data={data} onNext={next} onBack={back} />}
              {step === 4 && <Step5StyleCover  data={data} onNext={next} onBack={back} />}
              {step === 5 && <Step6Typography  data={data} bookId={bookId} onBack={back} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
