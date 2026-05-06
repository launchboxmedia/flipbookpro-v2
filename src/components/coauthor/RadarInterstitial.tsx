'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles, Radar, Loader2, Check, ArrowRight, ArrowLeft,
  Users, Layers, FileText, Lightbulb, Target, X,
} from 'lucide-react'
import type { Book, RadarResult, RadarAppliedSelections } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface Props {
  book: Book
  /** Called once the interstitial completes (apply or skip). The caller
   *  re-fetches the book so downstream stages see the fresh radar_applied_at. */
  onComplete: () => void
}

const POLL_INTERVAL_MS = 2_000
const POLL_MAX_MS      = 30_000

const MONETIZATION_LABEL: Record<'free' | 'lead_magnet' | 'paid', string> = {
  free:        'Free Book',
  lead_magnet: 'Lead Magnet',
  paid:        'Paid Book',
}

/** First-entry interstitial. Shown when radar_applied_at is null AND
 *  creator_radar_data is non-null (either freshly arrived or an earlier
 *  unapplied scan). Gates entry to the outline stage — the user picks
 *  what to apply or skips, then the page re-renders into the normal
 *  coauthor flow.
 *
 *  Three states it transitions through:
 *    waiting → radar still running, poll books table
 *    interstitial → radar data present, show selection cards
 *    applying → user clicked Apply Selected
 *
 *  Failure modes are silent — if radar polling times out without data
 *  arriving, the user gets the interstitial anyway with whatever the
 *  initial book payload had. If the payload is empty, the
 *  parent renders this component only when creator_radar_data exists. */
export function RadarInterstitial({ book: initialBook, onComplete }: Props) {
  const [book, setBook] = useState<Book>(initialBook)
  // Phase: 'waiting' if data is still coming in; 'ready' once we have it.
  const [phase, setPhase] = useState<'waiting' | 'ready' | 'applying' | 'done'>(
    initialBook.creator_radar_data ? 'ready' : 'waiting',
  )
  const [error, setError] = useState<string | null>(null)

  // Selection state — all checked by default per spec.
  const [sel, setSel] = useState<RadarAppliedSelections>({
    targetAudience:   true,
    chapterStructure: true,
    backCover:        true,
    openingHook:      true,
    monetization:     true,
  })

  // Poll for radar data when we land here without it. Up to POLL_MAX_MS;
  // after that we render the interstitial anyway with the latest book
  // we have (likely no data, in which case the parent shouldn't have
  // mounted us — defensive fallback).
  useEffect(() => {
    if (phase !== 'waiting') return
    let cancelled = false
    const supabase = createClient()
    const start = Date.now()
    void (async () => {
      while (!cancelled && Date.now() - start < POLL_MAX_MS) {
        try {
          const { data: row } = await supabase
            .from('books')
            .select('*')
            .eq('id', book.id)
            .maybeSingle<Book>()
          if (cancelled) return
          if (row?.creator_radar_data) {
            setBook(row)
            setPhase('ready')
            return
          }
        } catch { /* retry next tick */ }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      }
      if (!cancelled) {
        // Timed out. If there's still no data, skip directly — nothing
        // to interstitial about. The parent will hide us once
        // radar_applied_at is set.
        if (!book.creator_radar_data) {
          await markSkipped()
          return
        }
        setPhase('ready')
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  async function markSkipped() {
    setPhase('applying')
    try {
      // Skip = treat as "applied with all unchecked". Persist via the
      // route so the same applied_selections schema lands on the book.
      const all: RadarAppliedSelections = {
        targetAudience: false, chapterStructure: false, backCover: false,
        openingHook: false, monetization: false,
      }
      await fetch(`/api/books/${book.id}/apply-radar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ selections: all }),
      })
    } catch {
      // Fail silently — radar_applied_at gets set even on partial
      // failure inside the route, so the interstitial won't reappear.
    } finally {
      setPhase('done')
      onComplete()
    }
  }

  async function applySelected() {
    setError(null)
    setPhase('applying')
    try {
      const res = await fetch(`/api/books/${book.id}/apply-radar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ selections: sel }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Apply failed (${res.status})`)
      }
      setPhase('done')
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed')
      setPhase('ready')
    }
  }

  const radar: RadarResult | null = book.creator_radar_data ?? null

  // ── Waiting state — radar still running ──────────────────────────────
  if (phase === 'waiting') {
    return (
      <div className="bg-ink-1 min-h-screen flex items-center justify-center px-6">
        <div className="bg-ink-2 border border-ink-3 rounded-2xl p-10 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <Radar className="w-8 h-8 text-gold animate-pulse" />
          </div>
          <h2 className="font-playfair text-2xl text-cream font-semibold">
            Finishing your market intelligence scan&hellip;
          </h2>
          <p className="text-cream-1/60 font-source-serif text-sm leading-relaxed">
            This usually takes 15&ndash;20 seconds. We&rsquo;ll show you what we found as soon as it lands.
          </p>
          <LoadingDots />
        </div>
      </div>
    )
  }

  // ── Applying state — selections being applied ────────────────────────
  if (phase === 'applying') {
    return (
      <div className="bg-ink-1 min-h-screen flex items-center justify-center px-6">
        <div className="bg-ink-2 border border-ink-3 rounded-2xl p-10 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
          </div>
          <h2 className="font-playfair text-xl text-cream font-semibold">
            Applying your selections&hellip;
          </h2>
          <p className="text-cream-1/60 font-source-serif text-sm">
            Drafting back cover, setting monetization, and queueing chapter context.
          </p>
        </div>
      </div>
    )
  }

  // ── Ready state — main interstitial ──────────────────────────────────
  // Pull preview text from the radar result. Any field can be missing;
  // we omit cards whose underlying data is absent.
  const audiencePain    = radar?.audienceInsights?.biggestPain
  const idealLength     = radar?.bookRecommendations?.ideal_length
  const topGap          = radar?.competitorLandscape?.gaps?.[0]
  const positioning     = radar?.bookRecommendations?.positioning
  const suggestedHook   = radar?.bookRecommendations?.suggested_hook
  const monetization    = radar?.bookRecommendations?.monetization as 'free' | 'lead_magnet' | 'paid' | undefined
  const monReason       = radar?.bookRecommendations?.monetization_reason

  return (
    <div className="bg-ink-1 min-h-screen">
      {/* Top bar — gives the user an exit before they apply anything.
          Sticky so it stays visible even on long mobile scrolls. */}
      <div className="sticky top-0 z-20 bg-ink-1/90 backdrop-blur border-b border-ink-3">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-inter text-ink-subtle hover:text-cream transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Link>
          <div className="flex-1 min-w-0 text-center">
            <p className="font-inter text-xs text-cream-1 truncate">
              {book.title || 'Untitled book'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void markSkipped()}
            className="inline-flex items-center gap-1 text-xs font-inter text-ink-subtle hover:text-cream-1 transition-colors shrink-0"
          >
            Skip
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="mb-8 text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/15 border border-gold/40 text-gold text-xs font-inter font-semibold uppercase tracking-[0.18em]">
            <Sparkles className="w-3 h-3" />
            Market intelligence ready
          </div>
          <h1 className="font-playfair text-3xl text-cream font-semibold">
            Your Market Intelligence is Ready
          </h1>
          <p className="text-cream-1/65 font-source-serif text-sm max-w-lg mx-auto leading-relaxed">
            Review what Creator Radar found and choose what to apply to your book before you start writing.
          </p>
        </div>

        <p className="text-cream-1/55 font-source-serif text-xs italic mb-4 text-center">
          Each insight below can be applied independently. Uncheck anything you don&rsquo;t want.
        </p>

        {/* Selection cards */}
        <div className="space-y-3">
          {audiencePain && (
            <SelectionCard
              icon={<Users className="w-4 h-4" />}
              title="Target Audience"
              checked={sel.targetAudience}
              onToggle={() => setSel((s) => ({ ...s, targetAudience: !s.targetAudience }))}
              description="Pre-fill your reader profile with radar audience insights."
              previewLabel="Preview"
              preview={`"${truncate(audiencePain, 200)}"`}
            />
          )}

          <SelectionCard
            icon={<Layers className="w-4 h-4" />}
            title="Chapter Structure"
            checked={sel.chapterStructure}
            onToggle={() => setSel((s) => ({ ...s, chapterStructure: !s.chapterStructure }))}
            description="Generate your outline using competitor gaps and audience pain points."
            previewLabel={idealLength || topGap ? undefined : 'Preview'}
            preview={
              <div className="space-y-1">
                {idealLength && <p>Recommended: {idealLength}</p>}
                {topGap     && <p>Primary gap: &ldquo;{truncate(topGap, 140)}&rdquo;</p>}
                {!idealLength && !topGap && <p className="italic text-cream-1/50">Outline will use full radar context.</p>}
              </div>
            }
          />

          {(positioning || audiencePain) && (
            <SelectionCard
              icon={<FileText className="w-4 h-4" />}
              title="Back Cover Copy"
              checked={sel.backCover}
              onToggle={() => setSel((s) => ({ ...s, backCover: !s.backCover }))}
              description="Draft your back cover from radar positioning and audience insights."
              previewLabel="Preview"
              preview={`"${truncate(positioning ?? audiencePain ?? '', 200)}"`}
            />
          )}

          {suggestedHook && (
            <SelectionCard
              icon={<Lightbulb className="w-4 h-4" />}
              title="Opening Hook"
              checked={sel.openingHook}
              onToggle={() => setSel((s) => ({ ...s, openingHook: !s.openingHook }))}
              description="Add the suggested hook to Chapter 1."
              previewLabel="Preview"
              preview={`"${truncate(suggestedHook, 280)}"`}
            />
          )}

          {monetization && (
            <SelectionCard
              icon={<Target className="w-4 h-4" />}
              title="Monetization Strategy"
              checked={sel.monetization}
              onToggle={() => setSel((s) => ({ ...s, monetization: !s.monetization }))}
              description="Set your publish access type based on radar recommendation."
              previewLabel={undefined}
              preview={
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gold/15 border border-gold/40 text-gold-soft text-[11px] font-inter font-semibold">
                    <Target className="w-3 h-3" />
                    Recommended: {MONETIZATION_LABEL[monetization]}
                  </span>
                  {monReason && (
                    <p className="italic">&ldquo;{truncate(monReason, 220)}&rdquo;</p>
                  )}
                </div>
              }
            />
          )}
        </div>

        {error && (
          <p className="text-rose-300 text-xs font-inter text-center mt-4">{error}</p>
        )}

        {/* Actions */}
        <div className="mt-10 space-y-3">
          <button
            type="button"
            onClick={applySelected}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold hover:bg-gold-soft text-ink-1 font-playfair font-semibold text-base rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Apply Selected
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void markSkipped()}
            className="w-full text-center text-ink-subtle hover:text-cream-1 font-inter text-xs underline underline-offset-4 transition-colors py-2"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SelectionCard({
  icon, title, description, checked, onToggle, previewLabel, preview,
}: {
  icon:           React.ReactNode
  title:          string
  description:    string
  checked:        boolean
  onToggle:       () => void
  previewLabel?:  string
  preview:        React.ReactNode
}) {
  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      checked
        ? 'bg-ink-2 border-gold/40'
        : 'bg-ink-2/50 border-ink-3'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-label={checked ? `Uncheck ${title}` : `Check ${title}`}
            className={`w-5 h-5 rounded shrink-0 flex items-center justify-center border transition-colors ${
              checked
                ? 'bg-gold border-gold text-ink-1'
                : 'bg-transparent border-ink-4 text-transparent hover:border-cream-1/40'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <span className={`text-gold ${!checked && 'opacity-50'}`}>{icon}</span>
          <h3 className="font-inter font-semibold text-cream text-sm uppercase tracking-wider">
            {title}
          </h3>
        </div>
        {!checked && (
          <span className="text-ink-muted text-[10px] font-inter italic">Skipped</span>
        )}
      </div>
      <p className={`text-cream-1/70 font-source-serif text-xs leading-snug mb-2 ${!checked && 'opacity-60'}`}>
        {description}
      </p>
      <div className={`text-cream-1/85 font-source-serif text-xs leading-relaxed pl-7 ${!checked && 'opacity-50'}`}>
        {previewLabel && <p className="text-[10px] font-inter font-semibold text-ink-muted uppercase tracking-wider mb-1">{previewLabel}:</p>}
        {preview}
      </div>
    </div>
  )
}

function LoadingDots() {
  return (
    <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden="true">
      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" style={{ animationDelay: '200ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" style={{ animationDelay: '400ms' }} />
    </div>
  )
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1).trimEnd() + '…'
}

// Suppress unused-X import warning — we keep X around for the hover-close
// affordance in future iterations of the card design.
void X
