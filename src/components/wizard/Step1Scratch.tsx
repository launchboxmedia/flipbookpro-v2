'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Loader2, ArrowRight, Plus, Trash2, RefreshCw, Lightbulb,
  Radar, BookOpen,
} from 'lucide-react'
import type { WizardData } from './WizardShell'
import type { RadarResult } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface Props {
  data: WizardData
  /** Needed to poll books.creator_radar_data while the per-book deep
   *  radar runs in the background after Step 3. */
  bookId: string
  onNext: (patch: Partial<WizardData>) => void
  onBack?: () => void
  maxChapters?: number
}

interface RadarContextPayload {
  topSignal?:     string
  contentAngles?: string[]
  audiencePain?:  string
  contentGaps?:   string[]
  positioning?:   string
  idealLength?:   string
  suggestedHook?: string
}

const POLL_INTERVAL_MS = 2_000
const POLL_MAX_MS      = 20_000

/** Scratch-mode Step 4 (Outline).
 *
 *  By the time the user lands here they've completed Radar (1), Title (2),
 *  and Audience (3). This step is now the most informed in the wizard —
 *  every prior signal feeds chapter generation. There's no description
 *  textarea anymore: the topic comes from `data.outline` (set by Step 1
 *  to the picked topic / niche), and the rest of the context layers on.
 *
 *  Auto-fires on mount when no chapters exist yet. On revisits where
 *  chapters are already populated, the auto-fire is suppressed and the
 *  user just sees / edits the existing list. */
export function Step1Scratch({ data, bookId, onNext, onBack, maxChapters = 6 }: Props) {
  const [chapters, setChapters]           = useState<Array<{ title: string; brief: string }>>(data.chapters)
  const [generating, setGenerating]       = useState(false)
  // Two-stage loading: waiting for deep radar to land, then generating
  // chapters. Step 4 mounts with `waitingForRadar = true` when the
  // wizard fired the per-book radar in the Audience→Outline transition.
  const [waitingForRadar, setWaitingForRadar] = useState(false)
  const [deepRadarData, setDeepRadarData]     = useState<RadarResult | null>(null)
  const [generateError, setGenerateError]     = useState('')
  const [chaptersNonce, setChaptersNonce]     = useState(0)

  /** Merge pre-book CreatorRadarResult with per-book RadarResult into the
   *  context shape detect-chapters expects. Either source can be missing;
   *  the route tolerates undefined fields. */
  function buildRadarContext(deep: RadarResult | null): RadarContextPayload | undefined {
    const r = data.radarResults
    if (!r && !deep) return undefined

    // Pre-book signals
    const preTopSignal     = r?.hot_signals?.[0]?.topic ?? r?.evergreen_winners?.[0]?.topic ?? r?.hidden_gold?.[0]?.niche
    const preContentAngles = [
      ...(r?.hot_signals       ?? []).map((h) => h.topic),
      ...(r?.evergreen_winners ?? []).map((e) => e.topic),
    ].filter(Boolean)
    const preContentGaps   = (r?.hidden_gold ?? []).map((g) => g.niche).filter(Boolean)

    // Per-book deep signals — richer fields the discovery radar lacks.
    const audiencePain    = deep?.audienceInsights?.biggestPain
    const positioning     = deep?.bookRecommendations?.positioning
    const idealLength     = deep?.bookRecommendations?.ideal_length
    const suggestedHook   = deep?.bookRecommendations?.suggested_hook
    const competitorGaps  = (deep?.competitorLandscape?.gaps ?? []).filter(Boolean)

    // Combine gap lists from both sources, dedup, cap. competitorGaps
    // (per-book, real competitor analysis) ranks first because it's
    // grounded in scraped competitor pages, not high-level signals.
    const allGaps = Array.from(new Set([...competitorGaps, ...preContentGaps])).slice(0, 6)
    const contentAngles = preContentAngles.slice(0, 5)

    const hasAnything = preTopSignal || contentAngles.length > 0 || allGaps.length > 0 ||
      audiencePain || positioning || idealLength || suggestedHook
    if (!hasAnything) return undefined

    return {
      topSignal:     preTopSignal || undefined,
      contentAngles: contentAngles.length > 0 ? contentAngles : undefined,
      contentGaps:   allGaps.length > 0       ? allGaps       : undefined,
      audiencePain:  audiencePain  || undefined,
      positioning:   positioning   || undefined,
      idealLength:   idealLength   || undefined,
      suggestedHook: suggestedHook || undefined,
    }
  }

  // The topic forwarded to the route. Priority chain:
  //   1. ideaDescription — the user's own framing from Step 1 textarea.
  //      Strongest signal when present.
  //   2. radarTopic — clicked from the Step 1 radar columns.
  //   3. niche — what they typed into the radar scan input.
  //   4. outline — fallback for legacy paths.
  const topic = (
    data.ideaDescription ||
    data.radarTopic ||
    data.niche ||
    data.outline ||
    ''
  ).trim()

  async function generateChapters(nonce: number, deep: RadarResult | null = deepRadarData) {
    if (!topic && !data.title) {
      setGenerateError('No topic available — go back and pick one in Step 1.')
      return
    }
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await fetch('/api/detect-chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode:           'scratch',
          topic:          topic || data.title,
          title:          data.title,
          subtitle:       data.subtitle,
          persona:        data.persona,
          targetAudience: data.targetAudience,
          radarContext:   buildRadarContext(deep),
          ...(nonce > 0 ? { refreshNonce: nonce } : {}),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Generation failed (${res.status})`)
      const arr = Array.isArray(json.chapters) ? json.chapters as Array<{ title: string; brief: string }> : []
      if (arr.length === 0) throw new Error('Claude returned no chapters. Try Regenerate.')
      const capped = arr.slice(0, maxChapters)
      setChapters(capped)
      if (arr.length > maxChapters) {
        setGenerateError(`Your plan allows up to ${maxChapters} chapters. Showing the first ${maxChapters}.`)
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  /** Polls books.creator_radar_ran_at every POLL_INTERVAL_MS. Resolves
   *  with the radar payload once it lands, or null on timeout
   *  (POLL_MAX_MS). Errors are silent — the worst case is timeout, which
   *  the caller already handles. */
  async function pollForRadar(): Promise<RadarResult | null> {
    const supabase = createClient()
    const start = Date.now()
    while (Date.now() - start < POLL_MAX_MS) {
      try {
        const { data: row } = await supabase
          .from('books')
          .select('creator_radar_ran_at, creator_radar_data')
          .eq('id', bookId)
          .maybeSingle<{ creator_radar_ran_at: string | null; creator_radar_data: RadarResult | null }>()
        if (row?.creator_radar_ran_at && row.creator_radar_data) {
          return row.creator_radar_data
        }
      } catch {
        // Network blip — retry next tick.
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
    return null
  }

  // Mount flow. If the Audience→Outline transition fired the deep radar,
  // poll for it before generating chapters so the prompt has the richest
  // possible context. If it lands inside POLL_MAX_MS, we use it; if it
  // doesn't, we proceed with pre-book context only — the wizard never
  // hangs on the radar.
  const autoTriggeredRef = useRef(false)
  useEffect(() => {
    if (autoTriggeredRef.current) return
    if (chapters.length > 0) return
    if (!topic && !data.title) return
    autoTriggeredRef.current = true
    void (async () => {
      let deep: RadarResult | null = null
      if (data.deepRadarFired) {
        setWaitingForRadar(true)
        deep = await pollForRadar()
        setDeepRadarData(deep)
        setWaitingForRadar(false)
      }
      await generateChapters(0, deep)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleRegenerate() {
    const next = chaptersNonce + 1
    setChaptersNonce(next)
    void generateChapters(next)
  }

  function updateChapter(i: number, field: 'title' | 'brief', value: string) {
    setChapters((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)))
  }

  function removeChapter(i: number) {
    setChapters((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addChapter() {
    if (chapters.length >= maxChapters) return
    setChapters((prev) => [...prev, { title: 'New Chapter', brief: '' }])
  }

  function handleContinue() {
    if (chapters.length === 0) {
      setGenerateError('Wait for chapters to generate, or click Regenerate.')
      return
    }
    onNext({ chapters })
  }

  // Insight card content. Top hot signal first; falls back to an
  // evergreen / hidden gold so the card still surfaces useful guidance.
  const insight =
    data.radarResults?.hot_signals?.[0]?.topic ??
    data.radarResults?.evergreen_winners?.[0]?.topic ??
    data.radarResults?.hidden_gold?.[0]?.niche ??
    null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Your Chapter Structure</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          Built from your market intelligence, title, and audience.
        </p>
      </div>

      {/* Insight card — only when we have a radar signal to surface. */}
      {insight && (
        <div className="bg-cream-2 border border-cream-3 border-l-4 border-l-gold rounded-lg p-3 flex items-start gap-3">
          <Lightbulb className="w-4 h-4 text-gold-dim mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-inter font-semibold text-gold-dim uppercase tracking-[0.15em] mb-0.5">
              Structured around your market data
            </p>
            <p className="text-ink-1 text-sm font-source-serif italic leading-snug">
              &ldquo;{insight}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Two-stage loading. Stage 1 surfaces while the per-book deep
          radar is still running in the background after Step 3; the
          poll in pollForRadar() resolves either when it lands or after
          POLL_MAX_MS, then we transition to Stage 2 (chapter
          generation). The card layout is shared between stages. */}
      {waitingForRadar && (
        <div className="bg-ink-2 border border-ink-3 rounded-xl p-8 max-w-md mx-auto mt-4 text-center space-y-3">
          <div className="flex justify-center">
            <Radar className="w-6 h-6 text-gold animate-pulse" />
          </div>
          <p className="text-cream-1 font-inter font-semibold text-sm">
            Running market intelligence scan&hellip;
          </p>
          <p className="text-cream-1/60 font-source-serif text-xs leading-relaxed">
            Analyzing competitors and audience insights to build the smartest possible outline.
          </p>
          <LoadingDots />
        </div>
      )}

      {!waitingForRadar && generating && chapters.length === 0 && (
        <div className="bg-ink-2 border border-ink-3 rounded-xl p-8 max-w-md mx-auto mt-4 text-center space-y-3">
          <div className="flex justify-center">
            <BookOpen className="w-6 h-6 text-gold" />
          </div>
          <p className="text-cream-1 font-inter font-semibold text-sm">
            Building your chapter structure&hellip;
          </p>
          <p className="text-cream-1/60 font-source-serif text-xs leading-relaxed">
            Using your market intelligence, title, and audience to create the most relevant outline.
          </p>
          <LoadingDots />
        </div>
      )}

      {/* Error state when nothing landed */}
      {!generating && chapters.length === 0 && generateError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 space-y-2">
          <p className="text-rose-700 text-sm font-inter">{generateError}</p>
          <button
            type="button"
            onClick={() => generateChapters(0)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter font-semibold text-xs rounded-md transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Try again
          </button>
        </div>
      )}

      {/* Chapter list */}
      {chapters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-inter text-sm font-medium text-ink-1/80">
              Edit any chapter title or brief before continuing.
            </h3>
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-cream-3 hover:border-gold/50 text-xs text-ink-1/70 hover:text-gold font-inter transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-wait"
            >
              {generating
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Regenerating&hellip;</>
                : <><RefreshCw className="w-3 h-3" /> Regenerate</>}
            </button>
          </div>

          {generating && (
            <p className="text-xs font-inter text-ink-1/60 italic">
              Asking Claude for a fresh structure &mdash; your current chapters will be replaced when the new ones arrive.
            </p>
          )}
          {generateError && (
            <p className="text-red-500 text-xs font-inter">{generateError}</p>
          )}

          <div className={generating ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
            {chapters.map((ch, i) => (
              <div key={i} className="border border-cream-3 rounded-lg p-4 bg-white space-y-2 mb-2">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-md bg-gold text-ink-1 font-inter font-bold text-sm flex items-center justify-center shrink-0 mt-1">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <input
                      aria-label={`Chapter ${i + 1} title`}
                      value={ch.title}
                      onChange={(e) => updateChapter(i, 'title', e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-cream-2 border border-cream-3 text-ink-1 font-inter text-sm focus:outline-none focus:ring-1 focus:ring-gold/40"
                    />
                    <textarea
                      aria-label={`Chapter ${i + 1} brief`}
                      value={ch.brief}
                      onChange={(e) => updateChapter(i, 'brief', e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1.5 rounded bg-cream-2 border border-cream-3 text-ink-1 placeholder:text-ink-1/40 font-source-serif text-sm focus:outline-none focus:ring-1 focus:ring-gold/40 resize-none"
                      placeholder="Chapter brief..."
                    />
                  </div>
                  <button
                    onClick={() => removeChapter(i)}
                    className="text-ink-1/60 hover:text-red-400 transition-colors mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {chapters.length < maxChapters ? (
              <button
                onClick={addChapter}
                className="flex items-center gap-1.5 text-xs text-ink-1/60 hover:text-ink-1 font-inter transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add chapter
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-cream-3 bg-white px-4 py-3">
                <p className="text-xs font-inter text-ink-1/60">
                  {maxChapters}-chapter limit reached on your current plan.
                </p>
                <Link href="/settings/billing" className="flex items-center gap-1 text-xs font-inter text-gold-dim hover:text-gold-dim/80 transition-colors whitespace-nowrap ml-4">
                  Upgrade <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        {onBack ? (
          <button
            onClick={onBack}
            className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors"
          >
            Back
          </button>
        ) : <span />}
        <button
          onClick={handleContinue}
          disabled={chapters.length === 0 || generating}
          className="px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm rounded-md transition-colors disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

/** Three pulsing gold dots used in both loading-state cards. Pure
 *  decoration — gives the card a sense of progress without claiming a
 *  specific percent or time. */
function LoadingDots() {
  return (
    <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden="true">
      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" style={{ animationDelay: '200ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" style={{ animationDelay: '400ms' }} />
    </div>
  )
}
