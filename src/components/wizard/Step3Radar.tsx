'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Check, ArrowRight } from 'lucide-react'
import type { WizardData } from './WizardShell'
import type { RadarResult } from '@/types/database'
import { CreatorRadarPanel } from '@/components/coauthor/CreatorRadarPanel'

interface InitialRadar {
  ranAt:     string | null
  data:      RadarResult | null
  appliedAt: string | null
}

interface Props {
  data: WizardData
  bookId: string
  initialRadar: InitialRadar
  /** Plan the panel uses for section gating. Admin → 'pro' is collapsed
   *  upstream in the wizard page so the panel only sees three buckets. */
  plan: 'free' | 'standard' | 'pro'
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

interface ApplySummary {
  chaptersEnriched: number
  backCoverDrafted: boolean
  hookOffered: boolean
  monetizationSet: 'free' | 'email' | 'paid' | null
}

const MONETIZATION_LABEL: Record<NonNullable<ApplySummary['monetizationSet']>, string> = {
  free:  'Free Book',
  email: 'Lead Magnet',
  paid:  'Paid Book',
}

/** Wizard Step 3.5 — Creator Radar.
 *
 *  Drops the user into a market-intelligence pause between Audience
 *  (Step 3) and Tone (Step 4). The panel auto-fires the radar on mount
 *  using the persona/audience/website the previous step persisted. Apply
 *  to Book is optional; the user can Continue regardless of whether the
 *  scan has completed (the route persists to the DB asynchronously).
 *
 *  Apply results render inline as a checklist, not via the modal that
 *  the coauthor stage uses — a modal mid-wizard reads as an interruption
 *  and the suggested-outline diff doesn't make sense here (the user
 *  hasn't seen the outline since Step 1; they'll review it later in the
 *  coauthor view). The outline change suggestions are still saved by the
 *  apply route — they just aren't surfaced here. */
export function Step3Radar({ data, bookId, initialRadar, plan, onNext, onBack }: Props) {
  const persona: 'business' | 'publisher' | 'storyteller' =
    data.persona === 'publisher' || data.persona === 'storyteller'
      ? data.persona
      : 'business'

  const [applying,    setApplying]    = useState(false)
  const [applyError,  setApplyError]  = useState<string | null>(null)
  const [applyResult, setApplyResult] = useState<ApplySummary | null>(null)

  async function applyRadar() {
    if (applying) return
    setApplying(true)
    setApplyError(null)
    try {
      const res = await fetch(`/api/books/${bookId}/apply-radar`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Apply failed (${res.status})`)
      setApplyResult({
        chaptersEnriched: Number(json.chaptersEnriched) || 0,
        backCoverDrafted: !!json.backCoverDrafted,
        hookOffered:      !!json.hookOffered,
        monetizationSet:  json.monetizationSet ?? null,
      })
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Apply failed')
    } finally {
      setApplying(false)
    }
  }

  const alreadyApplied = !!initialRadar.appliedAt || applyResult !== null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Your Market Intelligence</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          See what the market says about your book idea before you commit to tone and structure.
        </p>
      </div>

      {/* Panel auto-fires on mount when no result is on the book yet.
          On revisit (already ran), it hydrates from initialData and shows
          the result with a Refresh affordance. */}
      <CreatorRadarPanel
        bookId={bookId}
        plan={plan}
        persona={persona}
        ranAt={initialRadar.ranAt}
        initialData={initialRadar.data}
        radarAppliedAt={initialRadar.appliedAt}
        autoStart={initialRadar.ranAt === null && initialRadar.data === null}
      />

      {/* Apply to Book — wizard variant. Only renders the inline summary
          on success; the suggested-outline diff is suppressed here (user
          will review it in the coauthor view). The CreatorRadarPanel
          itself also has an Apply card now, but that triggers the modal
          flow. We use this lightweight surface inside the wizard. */}
      <div className="bg-cream-2 border border-cream-3 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <p className="font-inter font-semibold text-ink-1 text-sm uppercase tracking-wider">
            Apply intelligence to your book
          </p>
        </div>

        {applyResult ? (
          <div className="space-y-2">
            <p className="text-ink-1 text-sm font-source-serif font-semibold">
              ✦ Done. Here&rsquo;s what changed:
            </p>
            <ul className="space-y-1.5 text-ink-1 text-sm font-source-serif">
              {applyResult.chaptersEnriched > 0 && (
                <CheckRow>
                  {applyResult.chaptersEnriched} chapter brief{applyResult.chaptersEnriched === 1 ? '' : 's'} enriched
                </CheckRow>
              )}
              {applyResult.backCoverDrafted && <CheckRow>Back cover copy drafted</CheckRow>}
              {applyResult.hookOffered      && <CheckRow>Opening hook added to Chapter 1</CheckRow>}
              {applyResult.monetizationSet  && (
                <CheckRow>
                  Monetization set to{' '}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-inter font-semibold bg-gold/15 text-gold-dim border border-gold/40 ml-1 align-middle">
                    {MONETIZATION_LABEL[applyResult.monetizationSet]}
                  </span>
                </CheckRow>
              )}
              {applyResult.chaptersEnriched === 0 &&
               !applyResult.backCoverDrafted &&
               !applyResult.hookOffered &&
               !applyResult.monetizationSet && (
                <li className="text-ink-1/60 text-xs font-source-serif italic">
                  Radar context saved — it&rsquo;ll inform every chapter you generate.
                </li>
              )}
            </ul>
            <p className="text-ink-1/60 text-xs font-source-serif italic">
              Suggested outline changes saved. You&rsquo;ll review them in the outline view.
            </p>
          </div>
        ) : (
          <>
            <p className="text-ink-1/70 text-sm font-source-serif">
              Enriches chapter briefs, drafts your back cover, sets monetization, and adds an opening hook to Chapter 1. Optional — you can apply later from the coauthor view.
            </p>
            {applyError && (
              <p className="text-red-500 text-xs font-inter">{applyError}</p>
            )}
            <button
              type="button"
              onClick={applyRadar}
              disabled={applying}
              className="inline-flex items-center gap-2 px-5 py-2 bg-gold hover:bg-gold-soft text-ink-1 font-inter font-semibold text-sm rounded-md transition-colors disabled:opacity-50"
            >
              {applying
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying intelligence to your book…</>
                : <><Sparkles className="w-4 h-4" /> {alreadyApplied ? 'Re-apply with latest radar' : 'Apply to Book'}</>}
            </button>
          </>
        )}
      </div>

      {/* Footer — Continue is always active. Skip is the muted twin so the
          user knows applying is optional; they functionally do the same
          thing (advance), but the language signals "you're not behind" vs.
          "ready to move on." */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors"
        >
          Back
        </button>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onNext({})}
            className="text-ink-1/50 hover:text-ink-1 font-inter text-xs transition-colors"
          >
            Skip for now →
          </button>
          <button
            type="button"
            onClick={() => onNext({})}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm rounded-md transition-colors"
          >
            Continue
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function CheckRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  )
}
