'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, ShieldCheck, AlertCircle, Info, Sparkles, CheckCircle2,
  ArrowRight, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react'
import type { Book } from '@/types/database'
import type { CoauthorStage } from './CoauthorShell'

type CheckSeverity = 'error' | 'warning' | 'hint'
type CheckCategory = 'BLOCKER' | 'CONTENT' | 'BRAND' | 'CONSISTENCY'

interface CheckFlag {
  category: CheckCategory
  severity: CheckSeverity
  message: string
  suggestion?: string
  /** Action key the API may emit so the UI can map it to a Fix-It nav
   *  target. Currently: 'generate-cover', 'approve-chapters', etc. */
  action?: string
}

interface CheckResult {
  flags: CheckFlag[]
  canPublish: boolean
  counts: { errors: number; warnings: number; hints: number }
}

interface Props {
  book: Book
  /** Forward nav — invoked when the user clicks Publish after the check
   *  passes. CoauthorShell advances the stage to 'publish'. */
  onPublish: () => void
  /** Generic stage navigator for Fix-It links. The optional chapterIndex
   *  is honoured when the action points at a specific chapter. */
  onNavigate: (stage: CoauthorStage, chapterIndex?: number) => void
}

// Map of API action keys → which stage to send the user to. Anything we
// don't recognise falls back to Book Design (the most likely fix surface
// for cover / image / back-cover issues).
const ACTION_TO_STAGE: Record<string, CoauthorStage> = {
  'generate-cover':       'book-design',
  'generate-back-cover':  'book-design',
  'approve-chapters':     'chapter',
  'add-chapters':         'outline',
  'set-title':            'book-design',
  'set-cta':              'book-design',
}

export function PrePublishStage({ book, onPublish, onNavigate }: Props) {
  const [checking,    setChecking]    = useState(true)
  const [result,      setResult]      = useState<CheckResult | null>(null)
  const [error,       setError]       = useState('')
  const [hintsOpen,   setHintsOpen]   = useState(false)
  const [dismissed,   setDismissed]   = useState<Set<number>>(new Set())

  const run = useCallback(async () => {
    setChecking(true)
    setError('')
    try {
      const res = await fetch(`/api/books/${book.id}/pre-publish-check`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Check failed (${res.status})`)
      setResult({
        flags: Array.isArray(json.flags) ? json.flags : [],
        canPublish: !!json.canPublish,
        counts: json.counts ?? { errors: 0, warnings: 0, hints: 0 },
      })
      setDismissed(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check failed')
    } finally {
      setChecking(false)
    }
  }, [book.id])

  // Auto-run on mount + when the user navigates back into this stage.
  useEffect(() => {
    run()
  }, [run])

  function fix(flag: CheckFlag) {
    const stage = ACTION_TO_STAGE[flag.action ?? ''] ?? 'book-design'
    onNavigate(stage)
  }

  /** Mark a flag as dismissed by its index in the original `flags` array.
   *  Dismissals are session-scoped (cleared on every re-run) and apply to
   *  blockers, warnings, and hints alike — the user explicitly chose to
   *  ignore the issue. */
  function dismissFlag(globalIndex: number) {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(globalIndex)
      return next
    })
  }

  // Each visible item carries its GLOBAL index in the original `flags`
  // array so dismissals remain stable regardless of which category section
  // the card is rendered in. The previous version indexed against the
  // `warnings` sub-array, which made it impossible to dismiss blockers
  // and tangled the bookkeeping when re-runs reshuffled the flag list.
  const flags = result?.flags ?? []
  const indexedFlags = flags.map((f, i) => ({ f, i }))
  const visibleFlags    = indexedFlags.filter(({ i }) => !dismissed.has(i))
  const visibleBlockers = visibleFlags.filter(({ f }) => f.severity === 'error')
  const visibleWarnings = visibleFlags.filter(({ f }) => f.severity === 'warning')
  const visibleHints    = visibleFlags.filter(({ f }) => f.severity === 'hint')

  // Publishing is gated only by ACTIVE (non-dismissed) blockers. Dismissed
  // blockers count as "ignored for this session" — the user has explicitly
  // chosen to publish anyway. The server's `result.canPublish` is
  // intentionally NOT part of this gate because it can't see client-side
  // dismissals.
  const canPublish = visibleBlockers.length === 0

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="font-playfair text-3xl text-cream">Pre-Publish Check</h2>
          <p className="text-muted-foreground text-sm font-source-serif mt-1">
            Final review before the book goes live.
          </p>
        </div>
        {!checking && result && (
          <button
            onClick={run}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#2A2A2A] hover:border-[#444] text-cream/70 hover:text-cream font-inter text-xs rounded-md transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-run
          </button>
        )}
      </div>

      {/* Running ──────────────────────────────────────────────────────── */}
      {checking && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Loader2 className="w-7 h-7 animate-spin text-gold" />
          <p className="text-cream/80 font-inter text-sm">Reviewing your book…</p>
          <p className="text-muted-foreground text-xs font-source-serif max-w-xs">
            Checking cover, chapters, back-cover copy, and consistency across the manuscript.
          </p>
        </div>
      )}

      {/* Error ────────────────────────────────────────────────────────── */}
      {!checking && error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-center">
          <p className="text-red-300 font-inter text-sm mb-3">{error}</p>
          <button
            onClick={run}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 font-inter text-xs rounded-md transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        </div>
      )}

      {/* Results ──────────────────────────────────────────────────────── */}
      {!checking && !error && result && (
        <div className="space-y-6">
          {/* Success state — no blockers, all clear. */}
          {flags.length === 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
              <h3 className="font-playfair text-xl text-cream mb-1">Your book is ready to publish.</h3>
              <p className="text-cream/70 font-source-serif text-sm">
                Everything checks out. You can go live whenever you&rsquo;re ready.
              </p>
            </div>
          )}

          {/* Blockers ── */}
          {visibleBlockers.length > 0 && (
            <section>
              <p className="flex items-center gap-2 text-xs font-inter font-medium text-red-300 uppercase tracking-wider mb-3">
                <AlertCircle className="w-3.5 h-3.5" />
                Blockers · {visibleBlockers.length}
                <span className="text-red-300/60 normal-case tracking-normal">fix or ignore to publish</span>
              </p>
              <div className="space-y-2.5">
                {visibleBlockers.map(({ f, i }) => (
                  <FlagCard
                    key={`b-${i}`}
                    severity="error"
                    flag={f}
                    onFix={() => fix(f)}
                    onIgnore={() => dismissFlag(i)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Warnings ── */}
          {visibleWarnings.length > 0 && (
            <section>
              <p className="flex items-center gap-2 text-xs font-inter font-medium text-amber-300 uppercase tracking-wider mb-3">
                <Info className="w-3.5 h-3.5" />
                Warnings · {visibleWarnings.length}
                <span className="text-amber-300/60 normal-case tracking-normal">should fix</span>
              </p>
              <div className="space-y-2.5">
                {visibleWarnings.map(({ f, i }) => (
                  <FlagCard
                    key={`w-${i}`}
                    severity="warning"
                    flag={f}
                    onFix={() => fix(f)}
                    onIgnore={() => dismissFlag(i)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Hints — collapsible */}
          {visibleHints.length > 0 && (
            <section>
              <button
                onClick={() => setHintsOpen((v) => !v)}
                className="flex items-center gap-2 text-xs font-inter font-medium text-cream/60 hover:text-cream uppercase tracking-wider mb-3 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Nice to have · {visibleHints.length}
                {hintsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {hintsOpen && (
                <div className="space-y-2.5">
                  {visibleHints.map(({ f, i }) => (
                    <FlagCard
                      key={`h-${i}`}
                      severity="hint"
                      flag={f}
                      onFix={() => fix(f)}
                      onIgnore={() => dismissFlag(i)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Primary CTA ── */}
          <div className="pt-2 flex justify-end">
            {canPublish ? (
              <button
                onClick={onPublish}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter text-base font-semibold rounded-md transition-colors shadow-[0_10px_28px_-12px_rgba(201,168,76,0.55)]"
              >
                <ShieldCheck className="w-5 h-5" />
                Publish Your Book
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-[#2A2A2A] text-cream/60 font-inter text-sm font-medium rounded-md cursor-not-allowed border border-[#333]">
                Fix Issues First
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Flag card ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<CheckSeverity, { ring: string; icon: React.ReactNode; label: string; chip: string }> = {
  error:   {
    ring: 'bg-red-500/8 border-red-500/30',
    icon: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
    label: 'Blocker',
    chip: 'bg-red-500/15 text-red-300 border-red-500/30',
  },
  warning: {
    ring: 'bg-amber-500/8 border-amber-500/30',
    icon: <Info className="w-3.5 h-3.5 text-amber-400" />,
    label: 'Warning',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  hint:    {
    ring: 'bg-blue-500/8 border-blue-500/30',
    icon: <Sparkles className="w-3.5 h-3.5 text-blue-400" />,
    label: 'Hint',
    chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
}

function FlagCard({
  severity, flag, onFix, onIgnore,
}: {
  severity: CheckSeverity
  flag: CheckFlag
  onFix: () => void
  onIgnore?: () => void
}) {
  const style = SEVERITY_STYLES[severity]
  return (
    <div className={`rounded-xl border ${style.ring} p-4`}>
      <div className="flex items-center gap-2 mb-1.5">
        {style.icon}
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-inter font-semibold uppercase tracking-wide border ${style.chip}`}>
          {flag.category}
        </span>
      </div>
      <p className="text-cream font-source-serif text-sm leading-relaxed">{flag.message}</p>
      {flag.suggestion && (
        <p className="mt-1.5 text-cream/55 font-source-serif italic text-xs leading-relaxed">
          {flag.suggestion}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onFix}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gold/10 hover:bg-gold/20 border border-gold/40 text-gold font-inter text-[11px] font-semibold rounded-md transition-colors"
        >
          Fix It
          <ArrowRight className="w-3 h-3" />
        </button>
        {onIgnore && (
          <button
            onClick={onIgnore}
            className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#333] hover:border-cream/40 text-cream/60 hover:text-cream font-inter text-[11px] rounded-md transition-colors"
          >
            Ignore
          </button>
        )}
      </div>
    </div>
  )
}
