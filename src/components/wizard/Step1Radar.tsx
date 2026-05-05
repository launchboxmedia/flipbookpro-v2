'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Loader2, Search, RefreshCw, ArrowRight, Sparkles,
  TrendingUp, Star, Target, X, Pin,
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

const TYPEWRITER_TOPICS = [
  'personal finance',
  'AI productivity tools',
  'health and wellness',
  'career development',
  'small business growth',
] as const

const TYPE_DELAY_MS  = 65
const ERASE_DELAY_MS = 35
const HOLD_TYPED_MS  = 1500
const HOLD_ERASED_MS = 350

/** Minimum characters for the idea-description textarea to count as a
 *  valid Continue path. Long enough that detect-chapters has something
 *  meaningful to chew on; short enough that a focused pitch works. */
const MIN_DESCRIPTION_LENGTH = 30

export function Step1Radar({ data, onNext }: Props) {
  // ── Niche input + radar streaming state ────────────────────────────────
  const [niche, setNiche]                 = useState(data.niche ?? '')
  const [scanning, setScanning]           = useState(false)
  const [radarResult, setRadarResult]     = useState<CreatorRadarResult | null>(data.radarResults ?? null)
  const [radarError, setRadarError]       = useState('')
  const [refreshNonce, setRefreshNonce]   = useState(0)
  const [scanStep, setScanStep]           = useState<0 | 1 | 2 | 3>(0)

  // Picked radar finding (clicked from one of the three columns) —
  // surfaces as a removable pill above the Continue button.
  const [pickedTopic, setPickedTopic] = useState(data.radarTopic ?? '')

  // The user's own idea description. Optional companion to the radar
  // pick — when both are set, the description takes priority for title +
  // chapter generation while the radar provides market signals.
  const [ideaDescription, setIdeaDescription] = useState(data.ideaDescription ?? '')

  const [toast, setToast] = useState<string | null>(null)

  const nicheRef       = useRef<HTMLInputElement>(null)
  const ideaRef        = useRef<HTMLTextAreaElement>(null)

  // ── Typewriter placeholder ──────────────────────────────────────────────
  const [typewriter, setTypewriter] = useState('')
  useEffect(() => {
    if (niche.length > 0) return
    let topicIdx = 0
    let charIdx = 0
    let mode: 'typing' | 'erasing' = 'typing'
    let cancelled = false
    function tick() {
      if (cancelled) return
      const target = TYPEWRITER_TOPICS[topicIdx]
      if (mode === 'typing') {
        charIdx++
        setTypewriter(target.slice(0, charIdx))
        if (charIdx >= target.length) {
          mode = 'erasing'
          setTimeout(tick, HOLD_TYPED_MS)
          return
        }
        setTimeout(tick, TYPE_DELAY_MS)
        return
      }
      charIdx--
      setTypewriter(target.slice(0, charIdx))
      if (charIdx <= 0) {
        topicIdx = (topicIdx + 1) % TYPEWRITER_TOPICS.length
        mode = 'typing'
        setTimeout(tick, HOLD_ERASED_MS)
        return
      }
      setTimeout(tick, ERASE_DELAY_MS)
    }
    tick()
    return () => { cancelled = true }
  }, [niche.length])

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
   *  use it directly (auto-scan path triggered from Continue with only a
   *  description filled in); otherwise we use the niche field. Returns
   *  `true` on success so the caller can chain a follow-up action like
   *  auto-advancing the wizard. */
  /** Run the Creator Radar against a topic. When `overrideTopic` is set we
   *  use it directly (auto-scan path triggered from Continue with only a
   *  description filled in); otherwise we use the niche field. Returns
   *  `true` on success so the caller can chain a follow-up action like
   *  auto-advancing the wizard. */
  async function runRadar(nonce?: number, overrideTopic?: string): Promise<boolean> {
    const topic = (overrideTopic ?? niche).trim()
    if (topic.length < 2) {
      setRadarError('Type a topic first.')
      return false
    }
    setScanning(true)
    setRadarError('')
    try {
      const res = await fetch('/api/creator-radar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ topic, refreshNonce: nonce ?? undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Scan failed (${res.status})`)
      setRadarResult(json as CreatorRadarResult)
      return true
    } catch (e) {
      setRadarError(e instanceof Error ? e.message : 'Scan failed')
      return false
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
    setToast('Topic selected. Add details below or click Continue.')
  }

  function clearPick() {
    setPickedTopic('')
  }

  /** Commit wizard state and advance to the next step. Pure — does not
   *  trigger any scan; runs only when the data is settled. */
  function commitContinue(forcedRadar?: CreatorRadarResult) {
    const trimmedNiche       = niche.trim()
    const trimmedDescription = ideaDescription.trim()
    // The downstream `outline` field carries the topic forward. Priority:
    //   1. Idea description — richest context, drives detect-chapters
    //      and title generation as primary signal.
    //   2. Picked radar topic — deliberate user choice from the scan.
    //   3. Niche — last resort, the niche string itself becomes the topic.
    const topic = trimmedDescription || pickedTopic || trimmedNiche
    onNext({
      // Description doubles as niche when it's the only input, so downstream
      // steps that key off `niche` (deep radar) still have a topic string.
      niche:           trimmedNiche       || trimmedDescription || undefined,
      radarTopic:      pickedTopic        || undefined,
      radarResults:    forcedRadar ?? radarResult ?? undefined,
      ideaDescription: trimmedDescription || undefined,
      outline:         topic,
    })
  }

  // True when the user has clicked Continue but the auto-scan is in flight.
  // Drives the "scanning the market for your topic" loading copy and disables
  // the button so a double-click can't fire two scans.
  const [continuingViaScan, setContinuingViaScan] = useState(false)

  async function handleContinue() {
    const trimmedDescription = ideaDescription.trim()
    // Already-scanned path — radar results or a pinned topic mean we have
    // enough context to commit immediately.
    if (radarResult || pickedTopic) {
      commitContinue()
      return
    }
    // Auto-scan path — description has 30+ chars but no scan yet. Run the
    // radar with the description as the topic, briefly show the results,
    // then advance.
    if (trimmedDescription.length >= MIN_DESCRIPTION_LENGTH) {
      setContinuingViaScan(true)
      const ok = await runRadar(undefined, trimmedDescription)
      if (!ok) {
        setContinuingViaScan(false)
        return
      }
      // Hold on the results for ~2.5s so the user sees what was found
      // before the page transitions to Step 2. Long enough to register the
      // three columns; short enough not to feel like waiting.
      await new Promise<void>((resolve) => setTimeout(resolve, 2500))
      setContinuingViaScan(false)
      commitContinue()
    }
  }

  // Continue gating: a picked topic OR a 30+ char description satisfies.
  // Both can be set — that's the best case; the description wins for
  // primary context and the radar layers in market signals.
  const canContinue =
    pickedTopic.length > 0 ||
    ideaDescription.trim().length >= MIN_DESCRIPTION_LENGTH

  return (
    <div className="space-y-7">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">
          What&rsquo;s your book about?
        </h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          Tell us your topic and we&rsquo;ll scan the market for opportunities before you write a single word.
        </p>
      </div>

      {/* SECTION 1 — Market Scan input. No label per the new copy: the
          subheader already explains both inputs feed the same scan. */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-1/40" />
            <input
              ref={nicheRef}
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleScan() }}
              placeholder={typewriter}
              disabled={scanning}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-cream-2 border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-50"
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

        {radarError && (
          <p className="text-red-500 text-xs font-inter">{radarError}</p>
        )}

        {/* Loading state. When the scan was triggered via the Continue
            button (no scan run yet, description-only path) we show an
            additional headline so the user knows why the page paused. */}
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

        {/* RESULTS — three columns */}
        {radarResult && (
          <div className="space-y-3 pt-2">
            {radarResult.is_mock && (
              <p className="text-amber-700 text-[11px] font-inter italic">
                Live research is unavailable right now — showing illustrative ideas. Refresh to retry.
              </p>
            )}
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10px] font-inter font-semibold text-ink-1/70 uppercase tracking-[0.15em]">
                Market scan results — pick a topic or refine below
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

      {/* DIVIDER */}
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="flex-1 h-px bg-ink-4/40" />
        <span className="text-[11px] font-inter uppercase tracking-[0.18em] text-ink-1/40">
          or be more specific
        </span>
        <div className="flex-1 h-px bg-ink-4/40" />
      </div>

      {/* SECTION 2 — Idea Description. No label: the placeholder carries
          enough hint, and the unified helper text below both inputs explains
          what happens next. */}
      <div className="space-y-2.5">
        <textarea
          ref={ideaRef}
          value={ideaDescription}
          onChange={(e) => setIdeaDescription(e.target.value)}
          rows={3}
          placeholder="e.g. A step-by-step guide for new business owners who need to build business credit from scratch before applying for their first loan"
          className="w-full px-3 py-3 rounded-lg bg-cream-2 border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none min-h-[80px]"
        />
      </div>

      {/* Unified helper — explains that both inputs lead to the same scan
          so the user understands the description path doesn't skip the
          market intelligence step. */}
      <p className="text-xs font-inter text-ink-subtle text-center -mt-2">
        Either way, we&rsquo;ll scan the market and show you what&rsquo;s trending in your niche before you commit to a direction.
      </p>

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

      {/* Footer — full-width Continue per spec. When continuing via auto-scan
          the button shows the scan-then-advance state so the user sees the
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
