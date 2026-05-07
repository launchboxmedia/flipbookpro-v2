'use client'

import { useState } from 'react'
import { Radar, Loader2, AlertTriangle, RefreshCw, ArrowRight, X, Sparkles } from 'lucide-react'
import type { Book } from '@/types/database'
import { CreatorRadarPanel } from './CreatorRadarPanel'
import type { CoauthorStage } from './CoauthorShell'

interface Props {
  book: Book
  /** Plan tier as Creator Radar sees it. Admin collapses to 'pro' upstream
   *  in CoauthorShell so the panel only ever has to handle 3 buckets. */
  plan: 'free' | 'standard' | 'pro'
  /** Coauthor stage navigator — passed down to the apply-radar modal so
   *  "Go to Outline" / "Start Writing" can transition without a full reload.
   *  Also drives the bottom-of-page "Continue to Outline" affordance. */
  onStageChange?: (stage: CoauthorStage) => void
}

function formatAppliedDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// A book is "fresh" if it was created within the last 30 minutes. The
// canonical first-entry flow lands here straight from the wizard, so a
// fresh + never-run book auto-fires radar instead of forcing the user
// through the empty-state click. After 30 minutes, the empty state takes
// over so we don't surprise users who returned later.
const FRESH_BOOK_WINDOW_MS = 30 * 60 * 1000
function isFreshlyCreated(book: Book): boolean {
  const created = new Date(book.created_at).getTime()
  if (!Number.isFinite(created)) return false
  return Date.now() - created < FRESH_BOOK_WINDOW_MS
}

/** Coauthor stage for Creator Radar — single canonical surface for the
 *  market-intelligence flow. Replaces the old RadarInterstitial split:
 *  whether the user is on first entry or revisiting, the experience here
 *  is the same.
 *
 *  States:
 *  1. Never run (creator_radar_ran_at is null) AND fresh book — auto-fires
 *     radar via the panel's autoStart contract; user sees the streaming
 *     progress UI immediately.
 *  2. Never run AND not fresh — empty state with a manual Run button
 *     (e.g. user returns much later or radar generation failed).
 *  3. Ran but never applied — first-visit banner up top, panel shows
 *     results, Apply card invites applying.
 *  4. Applied — banner gone, header shows "Creator Radar was applied on
 *     [date]" hint, Apply card switches to "Re-apply with latest radar." */
export function CreatorRadarStage({ book, plan, onStageChange }: Props) {
  const persona: 'business' | 'publisher' | 'storyteller' =
    book.persona === 'publisher' || book.persona === 'storyteller'
      ? book.persona
      : 'business'

  const handleNavigate = onStageChange
    ? (stage: 'outline' | 'chapter') => onStageChange(stage)
    : undefined

  // Empty-state run trigger. Mirrors the panel's own runRadar contract
  // but is rendered as a full-page CTA so the user has something concrete
  // to click instead of an unexplained empty panel. After clicking, we
  // hand off to the panel — render it with autoStart so the streaming
  // run begins immediately.
  const [emptyStateClicked, setEmptyStateClicked] = useState(false)
  const hasNeverRun = book.creator_radar_ran_at === null && book.creator_radar_data === null
  // Fresh-book auto-start: skip the empty-state click for new books that
  // came straight from the wizard. The panel's autoStart fires runRadar
  // on mount; we just need to render the panel branch (not the empty
  // state) and pass autoStart through.
  const autoStartFresh = hasNeverRun && isFreshlyCreated(book)

  // Page-level refresh nonce. Bumped by the header Refresh button; the
  // panel watches it via the externalRefreshKey prop and fires a fresh
  // runRadar(true) on each bump. Lives here so the affordance is on the
  // page header (where the user expects it) rather than buried in the
  // panel's own toolbar.
  const [refreshNonce, setRefreshNonce] = useState(0)

  // First-visit banner state. Local-only — dismiss is per-mount (the spec
  // explicitly says no persistence). The banner shows whenever radar has
  // not been applied yet AND the user hasn't dismissed it this session.
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const showBanner = !book.radar_applied_at && !bannerDismissed

  // Empty-state branch: only when the user has never run radar AND the
  // book isn't fresh from the wizard. Fresh books auto-start instead.
  if (hasNeverRun && !emptyStateClicked && !autoStartFresh) {
    return (
      <div className="bg-ink-1 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
          <div className="bg-ink-2 border border-ink-3 rounded-2xl p-8 text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-full bg-gold/15 flex items-center justify-center">
              <Radar className="w-6 h-6 text-gold" />
            </div>
            <div className="space-y-1">
              <h2 className="font-playfair text-2xl text-cream font-semibold">
                You haven&rsquo;t run Creator Radar yet
              </h2>
              <p className="text-ink-subtle text-sm font-source-serif">
                Run it now to get market intelligence — audience pain points, competitive gaps, and a positioning angle your book can own.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEmptyStateClicked(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gold hover:bg-gold-soft text-ink-1 font-inter font-semibold text-sm rounded-lg transition-colors"
            >
              <Radar className="w-4 h-4" />
              Run Creator Radar
            </button>
            {!book.persona && (
              <div className="mx-auto max-w-sm flex items-start gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-left">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                <p className="text-amber-200 text-xs font-inter leading-snug">
                  Persona isn&rsquo;t set yet. The radar will run with the default
                  business persona — set the persona in the wizard for a more
                  tailored result.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const appliedDate = formatAppliedDate(book.radar_applied_at)

  return (
    <div className="bg-ink-1 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* First-visit banner — only when radar hasn't been applied. Local
            dismiss only; the spec calls for no persistence (the next page
            load shows it again until the user actually applies). */}
        {showBanner && (
          <div className="mb-6 bg-ink-3 border-l-4 border-gold rounded-lg p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-gold shrink-0 mt-0.5" />
            <p className="flex-1 text-cream-1/85 font-source-serif text-sm leading-relaxed">
              Review your market intelligence before you start writing. Apply what&rsquo;s useful — skip what isn&rsquo;t.
            </p>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss banner"
              className="shrink-0 p-1 rounded text-ink-subtle hover:text-cream-1 hover:bg-ink-2 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-inter font-semibold text-gold-dim uppercase tracking-[0.2em] mb-2">
              Market Intelligence
            </p>
            <h2 className="font-playfair text-3xl text-cream font-semibold">Your Creator Radar results</h2>
            <p className="text-ink-subtle text-sm font-source-serif mt-1">
              Review the market intelligence, refresh with new data, or re-apply to your book.
            </p>
            {appliedDate && (
              <p className="text-cream/70 text-xs font-inter mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ink-2 border border-ink-3">
                <Loader2 className="w-3 h-3 text-gold opacity-0" aria-hidden="true" />
                {/* Loader2 hidden as a layout reservation so the badge height
                    matches other badges that use it. Not visually rendered. */}
                Creator Radar was applied to your book on {appliedDate}. Refresh to update with latest market data.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setRefreshNonce((n) => n + 1)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 border border-gold/50 text-gold hover:bg-gold/10 text-sm font-inter font-medium rounded-md transition-colors"
            title="Run a fresh market intelligence scan"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <CreatorRadarPanel
          bookId={book.id}
          plan={plan}
          persona={persona}
          ranAt={book.creator_radar_ran_at}
          initialData={book.creator_radar_data}
          radarAppliedAt={book.radar_applied_at ?? null}
          onNavigateStage={handleNavigate}
          // Auto-start when the book is fresh (just came from wizard) OR
          // the user clicked through the empty state — the panel mounts
          // with no data and immediately begins streaming.
          autoStart={(autoStartFresh || emptyStateClicked) && !book.creator_radar_data}
          externalRefreshKey={refreshNonce}
        />

        {/* Continue to Outline — always visible at the bottom of the
            stage. Replaces the old interstitial's "Skip for now" link.
            Outlined gold so it reads as the next step without competing
            with the panel's primary "Apply Selected" CTA. Disabled when
            the parent didn't wire onStageChange (defensive — current
            CoauthorShell always wires it). */}
        {handleNavigate && (
          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={() => handleNavigate('outline')}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-gold/50 text-gold hover:bg-gold/10 text-sm font-inter font-semibold rounded-md transition-colors"
            >
              Continue to Outline
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
