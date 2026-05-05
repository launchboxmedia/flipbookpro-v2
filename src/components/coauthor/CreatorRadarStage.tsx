'use client'

import { useState } from 'react'
import { Radar, Loader2, AlertTriangle } from 'lucide-react'
import type { Book } from '@/types/database'
import { CreatorRadarPanel } from './CreatorRadarPanel'
import type { CoauthorStage } from './CoauthorShell'

interface Props {
  book: Book
  /** Plan tier as Creator Radar sees it. Admin collapses to 'pro' upstream
   *  in CoauthorShell so the panel only ever has to handle 3 buckets. */
  plan: 'free' | 'standard' | 'pro'
  /** Coauthor stage navigator — passed down to the apply-radar modal so
   *  "Go to Outline" / "Start Writing" can transition without a full reload. */
  onStageChange?: (stage: CoauthorStage) => void
}

function formatAppliedDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Coauthor stage for Creator Radar — review and re-apply. The first run
 *  now happens during the wizard's Step 3.5; this stage is for revisits.
 *
 *  Three states:
 *  1. Never run (creator_radar_ran_at is null) — empty state with a
 *     prompt + "Run Creator Radar" button. Rare in normal flow because
 *     the wizard auto-fires it; can happen if the user skipped it via
 *     the wizard's Skip link or if radar generation failed.
 *  2. Ran but never applied — panel shows results, Apply card invites
 *     applying.
 *  3. Applied — panel shows results, header shows "Creator Radar was
 *     applied on [date]" hint, Apply card switches to "Re-apply with
 *     latest radar." */
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

  if (hasNeverRun && !emptyStateClicked) {
    return (
      <div className="bg-ink-1 min-h-screen">
        <div className="max-w-2xl mx-auto px-6 py-16">
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
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
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

        <CreatorRadarPanel
          bookId={book.id}
          plan={plan}
          persona={persona}
          ranAt={book.creator_radar_ran_at}
          initialData={book.creator_radar_data}
          radarAppliedAt={book.radar_applied_at ?? null}
          onNavigateStage={handleNavigate}
          // Auto-start when the user clicked through the empty state — the
          // panel mounts with no data and immediately begins streaming.
          autoStart={emptyStateClicked && !book.creator_radar_data}
        />
      </div>
    </div>
  )
}
