'use client'

import { useEffect, useState } from 'react'
import { X, Sparkles, Check, ArrowRight, Loader2, BookOpen, PenLine } from 'lucide-react'

export interface SuggestedChapter {
  title: string
  brief: string
  radar_insight?: string
  change: 'NEW' | 'IMPROVED' | 'UNCHANGED'
}

export interface RadarApplyResult {
  appliedAt: string
  outlineSuggested: { chapters: SuggestedChapter[] }
  chaptersEnriched: number
  backCoverDrafted: boolean
  monetizationSet: 'free' | 'email' | 'paid' | null
  hookOffered: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  bookId: string
  result: RadarApplyResult | null
  /** Coauthor stage navigator. When provided, "Go to Outline" / "Start
   *  Writing" use this for an in-page transition; falls back to a hard
   *  navigate if absent (e.g. modal opened from a context without shell). */
  onNavigateStage?: (stage: 'outline' | 'chapter') => void
}

const CHANGE_LABEL: Record<SuggestedChapter['change'], string> = {
  NEW:       'NEW',
  IMPROVED:  'IMPROVED',
  UNCHANGED: 'UNCHANGED',
}

const CHANGE_PILL: Record<SuggestedChapter['change'], string> = {
  NEW:       'bg-gold/15 text-gold-dim border border-gold/40',
  IMPROVED:  'bg-amber-100 text-amber-800 border border-amber-200',
  UNCHANGED: 'bg-ink-3 text-ink-subtle border border-ink-4',
}

const MONETIZATION_LABEL: Record<NonNullable<RadarApplyResult['monetizationSet']>, string> = {
  free:  'Free Book',
  email: 'Lead Magnet (email gate)',
  paid:  'Paid Book',
}

export function RadarApplyModal({ open, onClose, bookId, result, onNavigateStage }: Props) {
  const [accepting, setAccepting]     = useState(false)
  const [acceptedAt, setAcceptedAt]   = useState<{ updated: number; inserted: number; skipped: number } | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !result) return null

  const suggestions = result.outlineSuggested?.chapters ?? []
  const hasSuggestions = suggestions.length > 0

  async function acceptOutline() {
    if (accepting || !hasSuggestions) return
    setAccepting(true)
    setAcceptError(null)
    try {
      const res = await fetch(`/api/books/${bookId}/apply-radar/accept-outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapters: suggestions.map((c) => ({ title: c.title, brief: c.brief })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Accept failed (${res.status})`)
      setAcceptedAt({
        updated:  Number(json.updated)  || 0,
        inserted: Number(json.inserted) || 0,
        skipped:  Number(json.skipped)  || 0,
      })
    } catch (e) {
      setAcceptError(e instanceof Error ? e.message : 'Accept failed')
    } finally {
      setAccepting(false)
    }
  }

  function gotoOutline() {
    if (onNavigateStage) {
      onNavigateStage('outline')
      onClose()
      return
    }
    window.location.href = `/book/${bookId}/coauthor?stage=outline`
  }

  function gotoFirstChapter() {
    if (onNavigateStage) {
      onNavigateStage('chapter')
      onClose()
      return
    }
    window.location.href = `/book/${bookId}/coauthor?stage=chapter`
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-1/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="radar-apply-title"
    >
      <div
        className="bg-ink-2 border border-ink-3 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-[0_28px_60px_-24px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-ink-3 bg-ink-1/40">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            <h2 id="radar-apply-title" className="font-playfair text-lg text-cream font-semibold">
              Creator Radar Applied
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full text-cream-1/50 hover:text-cream-1 hover:bg-ink-3 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <p className="text-cream-1/80 text-sm font-source-serif">
            Your book has been updated with market intelligence. Here&rsquo;s what changed:
          </p>

          <ul className="space-y-2">
            {result.chaptersEnriched > 0 && (
              <ChangeRow>
                {result.chaptersEnriched} chapter brief{result.chaptersEnriched === 1 ? '' : 's'} enriched with audience context
              </ChangeRow>
            )}
            {result.backCoverDrafted && (
              <ChangeRow>Back cover copy drafted</ChangeRow>
            )}
            {result.hookOffered && (
              <ChangeRow>Suggested opening hook added to Chapter 1&rsquo;s brief</ChangeRow>
            )}
            {result.monetizationSet && (
              <ChangeRow>
                Monetization set to{' '}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-inter font-semibold bg-gold/15 text-gold-dim border border-gold/40 ml-1 align-middle">
                  {MONETIZATION_LABEL[result.monetizationSet]}
                </span>
              </ChangeRow>
            )}
            {result.chaptersEnriched === 0 && !result.backCoverDrafted && !result.hookOffered && !result.monetizationSet && (
              <li className="text-ink-subtle text-xs font-source-serif italic">
                Nothing to enrich — every chapter is already approved, the back cover already exists, and there&rsquo;s nothing to publish to. The radar context was still saved and will inform future chapter generation.
              </li>
            )}
          </ul>

          {/* Suggested outline section */}
          {hasSuggestions && (
            <div className="space-y-3 pt-2 border-t border-ink-3">
              <div>
                <p className="text-[10px] font-inter font-semibold text-cream uppercase tracking-[0.15em] mb-1">
                  Suggested outline changes
                </p>
                <p className="text-ink-subtle text-xs font-source-serif">
                  Review the suggested chapter structure. Accept the changes or keep your current outline. Approved chapters are preserved.
                </p>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {suggestions.map((c, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${
                      c.change === 'UNCHANGED'
                        ? 'bg-ink-3/50 border-ink-4'
                        : 'bg-ink-3 border-ink-4'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-[10px] font-inter text-ink-subtle shrink-0">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <p className="font-playfair text-sm text-cream leading-tight truncate">
                          {c.title}
                        </p>
                      </div>
                      <span className={`text-[10px] font-inter font-semibold tracking-wider px-1.5 py-0.5 rounded shrink-0 ${CHANGE_PILL[c.change]}`}>
                        {CHANGE_LABEL[c.change]}
                      </span>
                    </div>
                    {c.radar_insight && c.change !== 'UNCHANGED' && (
                      <p className="text-gold/80 text-[10px] font-inter italic mb-1">
                        ✦ {c.radar_insight}
                      </p>
                    )}
                    {c.brief && (
                      <p className="text-cream-1/65 text-xs font-source-serif leading-snug line-clamp-2">
                        {c.brief}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {acceptError && (
                <p className="text-rose-300 text-xs font-inter">{acceptError}</p>
              )}

              {acceptedAt ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-inter">
                  <Check className="w-3.5 h-3.5" />
                  Outline updated — {acceptedAt.updated} updated, {acceptedAt.inserted} added, {acceptedAt.skipped} approved chapter{acceptedAt.skipped === 1 ? '' : 's'} preserved.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={acceptOutline}
                    disabled={accepting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold hover:bg-gold-soft text-ink-1 font-inter font-semibold text-sm rounded-md transition-colors disabled:opacity-50"
                  >
                    {accepting
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Applying outline…</>
                      : <>Accept Suggested Outline</>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAcceptedAt({ updated: 0, inserted: 0, skipped: 0 })}
                    disabled={accepting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-ink-4 hover:border-cream-1/40 text-cream-1/70 hover:text-cream-1 font-inter font-medium text-sm rounded-md transition-colors disabled:opacity-50"
                  >
                    Keep Current
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — navigation actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-ink-3 bg-ink-1/40">
          <button
            type="button"
            onClick={gotoOutline}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-ink-4 hover:border-cream-1/40 text-cream-1/80 hover:text-cream-1 font-inter font-medium text-xs rounded-md transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Go to Outline
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={gotoFirstChapter}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter font-semibold text-xs rounded-md transition-colors"
          >
            <PenLine className="w-3.5 h-3.5" />
            Start Writing
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ChangeRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-cream-1 text-sm font-source-serif">
      <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  )
}
