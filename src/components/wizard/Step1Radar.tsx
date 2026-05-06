'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Loader2, Search, RefreshCw, ArrowRight, Sparkles,
  TrendingUp, Star, Target, X, Pin, AlertTriangle,
} from 'lucide-react'
import type { WizardData } from './WizardShell'
import type { CreatorRadarResult } from '@/types/database'

interface Props {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => void
  /** Wizard mode is plumbed through but doesn't change Step 1's behaviour
   *  — both scratch and upload users go through this discovery step. The
   *  difference shows up in Step 4 (auto-generated chapters vs paste). */
  mode?: 'scratch' | 'upload'
}

/** Placeholder examples that cycle in the niche textarea every 3s while
 *  the field is empty. Spec mix: short niches and full one-liner ideas
 *  so the user sees both shapes work. */
const PLACEHOLDERS = [
  'personal finance for millennials',
  'helping new business owners build credit from zero',
  'overcoming anxiety without medication',
  'productivity systems for ADHD entrepreneurs',
  'teaching kids to read before kindergarten',
] as const

const PLACEHOLDER_INTERVAL_MS = 3000

/** Minimum chars in the niche field for the Continue button to enable
 *  (the auto-scan path also uses this threshold). Below this, the user
 *  needs to either pick a result from the scan or type more. */
const MIN_NICHE_LENGTH = 10

/** Min/max heights for the auto-expanding niche textarea. Tuned to match
 *  one-row at the bottom and ~three rows at the top with the current
 *  text-sm + py-2.5 padding. */
const TEXTAREA_MIN_HEIGHT_PX = 44
const TEXTAREA_MAX_HEIGHT_PX = 92

export function Step1Radar({ data, onNext }: Props) {
  // ── Niche input + radar streaming state ────────────────────────────────
  const [niche, setNiche]                 = useState(data.niche ?? '')
  const [scanning, setScanning]           = useState(false)
  const [radarResult, setRadarResult]     = useState<CreatorRadarResult | null>(data.radarResults ?? null)
  const [radarError, setRadarError]       = useState('')
  /** True when the route returned errorType: 'service_unavailable'. We
   *  render an inline retry path instead of the standard error string so
   *  the user gets one tap to retry without re-typing their topic. */
  const [serviceUnavailable, setServiceUnavailable] = useState(false)
  const [refreshNonce, setRefreshNonce]   = useState(0)
  const [scanStep, setScanStep]           = useState<0 | 1 | 2 | 3>(0)
  /** When the result is low-opportunity, the columns stay hidden behind a
   *  pivot prompt until the user explicitly opts to see "adjacent
   *  opportunities". This flag tracks that opt-in. */
  const [pivotRevealed, setPivotRevealed] = useState(false)

  // Picked radar finding (clicked from one of the three columns) —
  // surfaces as a removable pill above the Continue button.
  const [pickedTopic, setPickedTopic] = useState(data.radarTopic ?? '')

  const [toast, setToast] = useState<string | null>(null)

  const nicheRef = useRef<HTMLTextAreaElement>(null)

  // ── Rotating placeholder ────────────────────────────────────────────────
  // Simple cycle, no typewriter effect — swaps every PLACEHOLDER_INTERVAL_MS
  // while the field is empty. Once the user starts typing, the cycling
  // pauses (the placeholder isn't visible anyway).
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  useEffect(() => {
    if (niche.length > 0) return
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length)
    }, PLACEHOLDER_INTERVAL_MS)
    return () => clearInterval(id)
  }, [niche.length])

  // ── Auto-expand the textarea between 1 and 3 rows ──────────────────────
  // Reset height to auto so scrollHeight reflects content (not the previous
  // expanded height), then clamp to the min/max range. Runs on every value
  // change so backspacing also collapses the box.
  useEffect(() => {
    const el = nicheRef.current
    if (!el) return
    el.style.height = 'auto'
    const target = Math.min(
      Math.max(el.scrollHeight, TEXTAREA_MIN_HEIGHT_PX),
      TEXTAREA_MAX_HEIGHT_PX,
    )
    el.style.height = `${target}px`
  }, [niche])

  // ── Toast lifetime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  // ── Loading-step ticker ────────────────────────────────────────────────
  useEffect(() => {
    if (!scanning) { setScanStep(0); return }
    setScanStep(1)
    const t1 = setTimeout(() => setScanStep(2), 4000)
    const t2 = setTimeout(() => setScanStep(3), 8000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [scanning])

  /** Run the Creator Radar against a topic. When `overrideTopic` is set we
   *  use it directly (auto-scan path triggered from Continue); otherwise
   *  we use the niche field. Returns the parsed result on success, or
   *  null on failure (validation, service-unavailable, or any other
   *  error). Callers that only care about success/failure can coerce
   *  `!== null`; callers that need to branch on `low_opportunity` read
   *  the field off the returned result. */
  async function runRadar(nonce?: number, overrideTopic?: string): Promise<CreatorRadarResult | null> {
    const topic = (overrideTopic ?? niche).trim()
    if (topic.length < 2) {
      setRadarError('Type a topic first.')
      return null
    }
    setScanning(true)
    setRadarError('')
    setServiceUnavailable(false)
    // A new scan invalidates whatever pivot state was showing — the result
    // we're about to receive may or may not be low-opportunity.
    setPivotRevealed(false)
    try {
      const res = await fetch('/api/creator-radar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ topic, refreshNonce: nonce ?? undefined }),
      })
      const json = await res.json().catch(() => ({}))
      // 503 with errorType: 'service_unavailable' is the canonical
      // upstream-failure signal. We surface a focused retry UI, not an
      // error string in the corner.
      if (res.status === 503 && json?.errorType === 'service_unavailable') {
        setServiceUnavailable(true)
        setRadarResult(null)
        return null
      }
      if (!res.ok) throw new Error(json?.error ?? `Scan failed (${res.status})`)
      const result = json as CreatorRadarResult
      setRadarResult(result)
      return result
    } catch (e) {
      setRadarError(e instanceof Error ? e.message : 'Scan failed')
      return null
    } finally {
      setScanning(false)
    }
  }

  function handleScan() { void runRadar() }
  function handleRefresh() {
    const next = refreshNonce + 1
    setRefreshNonce(next)
    void runRadar(next)
  }

  function handlePickTopic(topic: string) {
    setPickedTopic(topic)
    setToast('Topic selected — click Continue to keep going.')
  }

  function clearPick() {
    setPickedTopic('')
  }

  /** "Try a different topic" handler from the pivot prompt. Drops the
   *  result entirely and refocuses the niche input so the user can type
   *  a fresh topic without scrolling back up. */
  function tryDifferentTopic() {
    setRadarResult(null)
    setPivotRevealed(false)
    setRadarError('')
    setNiche('')
    setTimeout(() => nicheRef.current?.focus(), 50)
  }

  /** Commit wizard state and advance to the next step. Pure — does not
   *  trigger any scan; runs only when the data is settled. The niche
   *  field doubles as the outline seed: downstream steps that key off
   *  `niche` (deep radar) and `outline` (chapter generation) both read
   *  from the same string. */
  function commitContinue(forcedRadar?: CreatorRadarResult) {
    const trimmedNiche = niche.trim()
    const topic = pickedTopic || trimmedNiche
    onNext({
      niche:        trimmedNiche || undefined,
      radarTopic:   pickedTopic  || undefined,
      radarResults: forcedRadar ?? radarResult ?? undefined,
      outline:      topic,
    })
  }

  // True when Continue clicked but the auto-scan is in flight. Drives the
  // "scanning the market for your topic" loading copy and disables the
  // button so a double-click can't fire two scans.
  const [continuingViaScan, setContinuingViaScan] = useState(false)

  async function handleContinue() {
    const trimmedNiche = niche.trim()
    // Already-scanned path — radar results or a pinned topic mean we have
    // enough context to commit immediately.
    if (radarResult || pickedTopic) {
      commitContinue()
      return
    }
    // Auto-scan path — niche has 10+ chars but no scan yet. Run the
    // radar with the niche as the topic. Behavior splits on the result:
    //   • low_opportunity → stop here and let the pivot prompt do its
    //     job. Auto-advancing past it would defeat the entire point.
    //   • normal opportunity → hold on the results for ~2.5s so the user
    //     sees what was found, then advance.
    if (trimmedNiche.length >= MIN_NICHE_LENGTH) {
      setContinuingViaScan(true)
      const result = await runRadar(undefined, trimmedNiche)
      if (!result) {
        setContinuingViaScan(false)
        return
      }
      if (result.low_opportunity) {
        setContinuingViaScan(false)
        return
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 2500))
      setContinuingViaScan(false)
      commitContinue(result)
    }
  }

  // Continue gating: a picked topic OR a 10+ char niche satisfies.
  const canContinue =
    pickedTopic.length > 0 ||
    niche.trim().length >= MIN_NICHE_LENGTH

  return (
    <div className="space-y-7">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">
          What&rsquo;s your book about?
        </h2>
      </div>

      {/* Single niche input — auto-expanding textarea (1-3 rows) so the
          field works both for short niches ("personal finance") and for
          longer one-liner ideas. Same scan triggers either way. */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-ink-1/40" />
            <textarea
              ref={nicheRef}
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder={PLACEHOLDERS[placeholderIdx]}
              disabled={scanning}
              rows={1}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-cream-2 border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-inter text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-50 resize-none overflow-hidden"
              style={{ minHeight: TEXTAREA_MIN_HEIGHT_PX, maxHeight: TEXTAREA_MAX_HEIGHT_PX }}
            />
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning || niche.trim().length < 2}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter font-semibold text-sm rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {scanning
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
              : <>Scan Market <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        </div>

        <p className="text-xs font-inter text-ink-subtle">
          A word, a niche, or a full idea — we&rsquo;ll scan the market and show you what&rsquo;s selling before you commit.
        </p>

        {/* Service-unavailable inline state: the route returned 503 (no
            mock data anymore). Honest copy + one-tap retry. */}
        {serviceUnavailable && (
          <div className="flex flex-col items-center gap-2 py-3">
            <p className="text-ink-subtle text-sm font-inter">
              Market research is unavailable right now.
            </p>
            <button
              type="button"
              onClick={() => void runRadar()}
              disabled={scanning || niche.trim().length < 2}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gold/60 hover:bg-gold/10 text-gold-dim font-inter font-medium text-xs rounded-md transition-colors disabled:opacity-40"
            >
              <RefreshCw className="w-3 h-3" />
              Try Again
            </button>
          </div>
        )}

        {radarError && !serviceUnavailable && (
          <p className="text-red-500 text-xs font-inter">{radarError}</p>
        )}

        {/* Loading state. When the scan was triggered via Continue (no
            scan run yet) we show an additional headline so the user
            knows why the page paused. */}
        {scanning && !radarResult && (
          <div className="space-y-2 mt-2">
            {continuingViaScan && (
              <p className="text-xs font-inter text-ink-1/70 mb-1">
                Scanning the market for your topic…
              </p>
            )}
            <ScanStep done={scanStep > 1} active={scanStep === 1} label="Searching market trends…" />
            <ScanStep done={scanStep > 2} active={scanStep === 2} label="Identifying opportunities…" />
            <ScanStep done={scanStep > 3} active={scanStep === 3} label="Building your intelligence report…" />
          </div>
        )}

        {/* PIVOT PROMPT — shown when the route flagged the topic as
            low-opportunity AND the user hasn't opted to see the results
            yet. Gates the columns: dumping low scores on a user without
            context feels like a failure, but framed as a pivot it's
            actionable. */}
        {radarResult && radarResult.low_opportunity && !pivotRevealed && (
          <div className="bg-ink-3/5 border border-ink-4/30 border-l-2 border-l-amber-400 rounded-lg p-5 space-y-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="font-inter font-semibold text-ink-1 text-sm leading-snug">
                Limited book market for this topic
              </p>
            </div>

            <p className="text-ink-1/80 font-source-serif text-sm leading-relaxed">
              <span className="italic text-ink-1">
                &ldquo;{radarResult.pivot_topic ?? niche.trim()}&rdquo;
              </span>{' '}
              has limited reader demand as a standalone book.
            </p>

            <p className="text-ink-1/80 font-source-serif text-sm leading-relaxed">
              We found some adjacent opportunities that do have buyers.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPivotRevealed(true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-gold hover:bg-gold/10 text-gold-dim font-inter font-semibold text-sm rounded-md transition-colors"
              >
                Show Adjacent Opportunities <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={tryDifferentTopic}
                className="inline-flex items-center justify-center px-4 py-2 text-ink-subtle hover:text-ink-1 font-inter text-sm transition-colors"
              >
                Try a different topic
              </button>
            </div>
          </div>
        )}

        {/* RESULTS — three columns. Hidden behind the pivot prompt when
            the result is low-opportunity until the user explicitly
            reveals it. */}
        {radarResult && (!radarResult.low_opportunity || pivotRevealed) && (
          <div className="space-y-3 pt-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10px] font-inter font-semibold text-ink-1/70 uppercase tracking-[0.15em]">
                {radarResult.low_opportunity
                  ? 'Adjacent opportunities in this space'
                  : 'Market scan results — pick a topic or refine below'}
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={scanning}
                title="Get a fresh batch of ideas"
                className="text-ink-1/50 hover:text-gold transition-colors disabled:opacity-40"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Column icon={<TrendingUp className="w-3.5 h-3.5" />} iconColor="text-gold-dim" title="Hot Signals">
                {radarResult.hot_signals.map((item, i) => (
                  <ResultItem
                    key={i}
                    label={item.topic}
                    selected={pickedTopic === item.topic}
                    onClick={() => handlePickTopic(item.topic)}
                    badge={
                      <span className="text-[10px] font-inter font-semibold text-gold-dim bg-gold/10 px-1.5 py-0.5 rounded">
                        {item.engagement}%
                      </span>
                    }
                    sub={item.trend_direction}
                  />
                ))}
              </Column>
              <Column icon={<Star className="w-3.5 h-3.5" />} iconColor="text-amber-500" title="Evergreen Winners">
                {radarResult.evergreen_winners.map((item, i) => (
                  <ResultItem
                    key={i}
                    label={item.topic}
                    selected={pickedTopic === item.topic}
                    onClick={() => handlePickTopic(item.topic)}
                    badge={
                      <span className="text-[10px] font-inter font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        {item.longevity_score}%
                      </span>
                    }
                  />
                ))}
              </Column>
              <Column icon={<Target className="w-3.5 h-3.5" />} iconColor="text-emerald-600" title="Hidden Gold">
                {radarResult.hidden_gold.map((item, i) => (
                  <ResultItem
                    key={i}
                    label={item.niche}
                    selected={pickedTopic === item.niche}
                    onClick={() => handlePickTopic(item.niche)}
                    badge={<CompetitionBadge level={item.competition_level} />}
                    sub={`Opportunity ${item.opportunity_score}`}
                  />
                ))}
              </Column>
            </div>

            <p className="text-ink-1/40 text-[11px] font-inter italic">
              Text-only book ideas. No templates or downloads.
            </p>
          </div>
        )}
      </div>

      {/* Picked topic pill — surfaces directly above the Continue button. */}
      {pickedTopic && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-inter text-ink-1/50">Selected:</span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/15 border border-gold/40 text-ink-1 text-xs font-inter font-medium">
            <Pin className="w-3 h-3 text-gold-dim" />
            <span className="truncate max-w-[280px]">{pickedTopic}</span>
            <button
              type="button"
              onClick={clearPick}
              className="text-ink-1/50 hover:text-ink-1 transition-colors"
              aria-label="Remove picked topic"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      {/* Footer — full-width Continue. When continuing via auto-scan the
          button shows the scan-then-advance state so the user sees the
          page is doing something. */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue || scanning || continuingViaScan}
          className="w-full inline-flex items-center justify-center gap-1.5 px-6 py-3 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm rounded-md transition-colors disabled:bg-ink-4/30 disabled:text-ink-1/40 disabled:cursor-not-allowed"
        >
          {continuingViaScan ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {scanning ? 'Scanning market…' : 'Reading results…'}
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-3 py-2 rounded-lg bg-ink-1 border border-gold/40 text-cream-1 font-inter text-xs shadow-2xl flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ScanStep({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-inter">
      {done
        ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        : active
          ? <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
          : <span className="w-1.5 h-1.5 rounded-full bg-cream-3" />}
      <span className={done ? 'text-ink-1/60' : active ? 'text-ink-1' : 'text-ink-1/40'}>
        {label}
      </span>
    </div>
  )
}

function Column({
  icon, iconColor, title, children,
}: {
  icon: React.ReactNode
  iconColor: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-cream-2 border border-cream-3 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={iconColor}>{icon}</span>
        <h4 className="text-[10px] font-inter font-semibold text-ink-1 uppercase tracking-[0.15em]">
          {title}
        </h4>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function ResultItem({
  label, badge, sub, onClick, selected,
}: {
  label:    string
  badge:    React.ReactNode
  sub?:     string
  onClick:  () => void
  selected: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left transition-colors rounded-md p-2.5 cursor-pointer group border ${
        selected
          ? 'bg-gold/15 border-gold/60 ring-1 ring-gold/40'
          : 'bg-white border-cream-3 hover:bg-gold/5 hover:border-gold/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xs font-inter leading-snug transition-colors ${
          selected ? 'text-ink-1 font-semibold' : 'text-ink-1 group-hover:text-gold-dim'
        }`}>
          {label}
        </span>
        <span className="shrink-0">{badge}</span>
      </div>
      {sub && (
        <p className="text-ink-1/50 text-[10px] font-inter mt-1 italic">{sub}</p>
      )}
    </button>
  )
}

function CompetitionBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const styles: Record<typeof level, string> = {
    low:    'text-emerald-700 bg-emerald-100',
    medium: 'text-amber-700   bg-amber-100',
    high:   'text-rose-700    bg-rose-100',
  }
  return (
    <span className={`text-[10px] font-inter font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${styles[level]}`}>
      {level}
    </span>
  )
}
