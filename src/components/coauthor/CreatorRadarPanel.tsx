'use client'

// CreatorRadarPanel
// ─────────────────
// Panel embedded in the OutlineStage right column. Surfaces market
// intelligence streamed from /api/books/[bookId]/creator-radar.
//
// Plan-gating happens server-side (the API only sends fields the user is
// entitled to), but we ALSO render locked sections client-side as blurred
// previews so users on lower tiers see what they're missing and have a
// path to upgrade. The blurred preview is purely cosmetic — there's no
// real data behind it.
//
// JSON parses progressively during streaming so users see `summary` and
// `marketSignals` while later sections are still arriving.

import { useState, useRef, useEffect } from 'react'
import {
  Zap, RefreshCw, Loader2, Sparkles, TrendingUp, Compass, Users, Trophy,
  BookOpen, ExternalLink, AlertTriangle, Lock, Check, Globe, MessageCircle,
  Target,
} from 'lucide-react'
import type {
  RadarResult, RadarMarketSignal, RadarContentAngle,
  RadarAudienceInsights, RadarCompetitorLandscape, RadarBookRecommendations,
  RadarCompetitorEntry, RadarWebsiteExtraction,
} from '@/types/database'
import { RadarApplyModal, type RadarApplyResult } from './RadarApplyModal'

type Plan = 'free' | 'standard' | 'pro'
type Status = 'idle' | 'researching' | 'scraping' | 'synthesizing' | 'done' | 'error'

interface Props {
  bookId: string
  plan: Plan
  persona: 'business' | 'publisher' | 'storyteller'
  ranAt: string | null
  initialData: RadarResult | null
  /** Last time /apply-radar succeeded for this book. Drives the
   *  "Applied X days ago" hint + the re-apply affordance. NULL means
   *  the button surfaces as a first-time apply. */
  radarAppliedAt?: string | null
  /** Optional in-shell stage navigator. Wired through from
   *  CoauthorShell so the results modal can transition without a
   *  page reload. Falls back to window.location when omitted. */
  onNavigateStage?: (stage: 'outline' | 'chapter') => void
  /** Auto-fire runRadar(false) on first mount when there's no existing
   *  result on the book. Used by the wizard's Step 3.5 to start the scan
   *  immediately on landing rather than making the user click. Default
   *  is false so the coauthor stage still requires an explicit click. */
  autoStart?: boolean
}

// Best-effort partial-JSON extraction. Sonnet streams tokens, not complete
// objects, so we balance braces/brackets and try to parse what we have.
// This is intentionally lenient — failures are silent because we'll get
// a clean parse on the next chunk anyway.
function tryParsePartialJson(buffer: string): RadarResult | null {
  const trimmed = buffer.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  let depth = 0
  let lastBalanced = -1
  let inString = false
  let escape = false
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{' || c === '[') depth++
    else if (c === '}' || c === ']') {
      depth--
      if (depth === 0) lastBalanced = i
    }
  }
  if (lastBalanced === -1) return null
  try {
    return JSON.parse(trimmed.slice(0, lastBalanced + 1)) as RadarResult
  } catch {
    return null
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const d = Math.floor(hr / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

const URGENCY_STYLES: Record<NonNullable<RadarMarketSignal['urgency']>, { dot: string; label: string; text: string }> = {
  high:   { dot: 'bg-rose-400',   label: 'HIGH',   text: 'text-rose-300' },
  medium: { dot: 'bg-amber-400',  label: 'MEDIUM', text: 'text-amber-300' },
  low:    { dot: 'bg-ink-subtle', label: 'LOW',    text: 'text-ink-subtle' },
}

// Persona-specific labels for the middle progress step. The first/last
// steps are constant ("Searching market trends" / "Synthesizing").
const SCRAPE_STEP_LABEL: Record<Props['persona'], string> = {
  business:    'Reading your website…',
  publisher:   'Analyzing competitors…',
  storyteller: 'Reading reader reviews…',
}

export function CreatorRadarPanel({ bookId, plan, persona, ranAt: initialRanAt, initialData, radarAppliedAt: initialAppliedAt, onNavigateStage, autoStart = false }: Props) {
  const [status, setStatus]   = useState<Status>('idle')
  const [result, setResult]   = useState<RadarResult | null>(initialData)
  const [ranAt, setRanAt]     = useState<string | null>(initialRanAt)
  const [error, setError]     = useState<string | null>(null)
  const [stepsDone, setStepsDone] = useState<{ research: boolean; scrape: boolean; synthesis: boolean }>({ research: false, scrape: false, synthesis: false })
  const [toast, setToast]     = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Apply-Radar state. The button surfaces once a result is on screen.
  const [applying, setApplying]               = useState(false)
  const [applyError, setApplyError]           = useState<string | null>(null)
  const [applyResult, setApplyResult]         = useState<RadarApplyResult | null>(null)
  const [appliedAt, setAppliedAt]             = useState<string | null>(initialAppliedAt ?? null)
  const [modalOpen, setModalOpen]             = useState(false)

  const running = status === 'researching' || status === 'scraping' || status === 'synthesizing'

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  // Auto-start fires once on mount when the caller asks for it AND we don't
  // already have a result on the book. The wizard's Step 3.5 uses this so
  // the user lands on a step that's already running, not a step that's
  // waiting for a button click. The eslint disable is because we
  // intentionally want this effect to ignore later prop changes — it's a
  // one-shot trigger; users can refresh manually after that.
  useEffect(() => {
    if (!autoStart) return
    if (initialData || initialRanAt) return
    void runRadar(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setToast('Copied to clipboard')
    } catch {
      setToast('Copy failed')
    }
  }

  /** Triggers /apply-radar and opens the results modal. Idempotent on the
   *  server — re-applying replaces the audience-context blocks rather
   *  than appending duplicates, so this also serves as the "Re-apply"
   *  affordance. */
  async function applyRadar() {
    if (applying) return
    setApplying(true)
    setApplyError(null)
    try {
      const res = await fetch(`/api/books/${bookId}/apply-radar`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Apply failed (${res.status})`)
      const r = json as RadarApplyResult
      setApplyResult(r)
      setAppliedAt(r.appliedAt)
      setModalOpen(true)
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Apply failed')
    } finally {
      setApplying(false)
    }
  }

  async function runRadar(refresh: boolean) {
    if (running) return
    setStatus('researching')
    setError(null)
    setStepsDone({ research: false, scrape: false, synthesis: false })

    const ac = new AbortController()
    abortRef.current = ac

    try {
      const res = await fetch(`/api/books/${bookId}/creator-radar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh }),
        signal:  ac.signal,
      })

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(j.error ?? 'Request failed')
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let jsonBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const evt = JSON.parse(line.slice(6))

          if (evt.type === 'cache_hit') {
            // Skip the progress dance — instant fill.
            setStepsDone({ research: true, scrape: true, synthesis: true })
            setStatus('synthesizing')
            continue
          }
          if (evt.type === 'research_complete') {
            setStepsDone((s) => ({ ...s, research: true }))
            setStatus('scraping')
            continue
          }
          if (evt.type === 'scrape_complete') {
            setStepsDone((s) => ({ ...s, scrape: true }))
            setStatus('synthesizing')
            continue
          }
          if (evt.type === 'delta') {
            jsonBuffer += evt.content
            const partial = tryParsePartialJson(jsonBuffer)
            if (partial) setResult(partial)
            continue
          }
          if (evt.type === 'result') {
            setResult(evt.result as RadarResult)
            continue
          }
          if (evt.type === 'done') {
            setStepsDone((s) => ({ ...s, synthesis: true }))
            setStatus('done')
            if (evt.ranAt) setRanAt(evt.ranAt as string)
            continue
          }
          if (evt.type === 'error') {
            throw new Error(evt.message ?? 'Generation failed')
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError((e as Error).message)
      setStatus('error')
    }
  }

  // Locked section — blurred ghost content + upgrade overlay. Used for
  // any section the user's plan doesn't include.
  function LockedSection({ tier, children, copy }: { tier: 'standard' | 'pro'; copy: string; children: React.ReactNode }) {
    const tierLabel = tier === 'pro' ? 'PRO FEATURE' : 'STANDARD FEATURE'
    return (
      <div className="relative rounded-lg overflow-hidden border border-ink-3 bg-ink-3/40">
        <div className="blur-sm opacity-40 pointer-events-none select-none p-4">
          {children}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-1/80 backdrop-blur-sm px-4">
          <span className="flex items-center gap-1.5 text-gold font-playfair text-sm font-semibold mb-1.5">
            <Lock className="w-3.5 h-3.5" /> {tierLabel}
          </span>
          <span className="text-cream-1/70 text-xs text-center mb-3 font-source-serif leading-snug max-w-[260px]">
            {copy}
          </span>
          <a
            href="/settings/billing"
            className="text-xs bg-gold hover:bg-gold-soft text-ink-1 px-3 py-1.5 rounded-md font-inter font-semibold transition-colors"
          >
            Upgrade to {tier === 'pro' ? 'Pro' : 'Standard'}
          </a>
        </div>
      </div>
    )
  }

  const showAngles      = plan !== 'free'
  const showAudience    = plan !== 'free'
  const showCompetitors = plan === 'pro'
  const showRecs        = plan === 'pro'
  const canRefresh      = plan === 'pro'
  // Persona-specific section gates
  const showWebsiteAnalysis     = plan === 'pro' // business
  const showCompetitorBreakdown = plan === 'pro' // publisher
  const showReaderLanguage      = plan !== 'free' // storyteller (Standard+)

  return (
    <div className="bg-ink-2 border border-ink-3 rounded-2xl overflow-hidden flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-ink-3 bg-ink-1/40">
        <Zap className="w-4 h-4 text-gold" />
        <h3 className="font-playfair text-cream text-base font-semibold flex-1">Creator Radar</h3>
        {result && !running && (
          <span className="text-[10px] font-inter text-ink-subtle">
            Last run: {timeAgo(ranAt)}
          </span>
        )}
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Run / refresh buttons */}
        {!result && !running && (
          <button
            onClick={() => runRadar(false)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 text-sm font-inter font-semibold rounded-md transition-colors press-scale"
          >
            <Zap className="w-3.5 h-3.5" /> Run Creator Radar
          </button>
        )}

        {result && !running && (
          <div className="flex gap-2">
            <button
              onClick={() => canRefresh ? runRadar(true) : null}
              disabled={!canRefresh}
              title={canRefresh ? 'Force a fresh research pass' : 'Refresh available on Pro plan'}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-gold/50 text-gold hover:bg-gold/10 text-xs font-inter font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        )}

        {running && (
          <button disabled className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gold/30 text-ink-1/60 text-sm font-inter font-semibold rounded-md cursor-wait">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…
          </button>
        )}

        {/* Progress steps — shown only while running. The middle step is
            persona-aware (website / competitors / reviews); the first and
            last are constant. */}
        {running && (
          <div className="space-y-2 text-xs font-inter">
            <ProgressStep
              done={stepsDone.research}
              active={status === 'researching'}
              label="Searching market trends…"
            />
            <ProgressStep
              done={stepsDone.scrape}
              active={status === 'scraping'}
              label={SCRAPE_STEP_LABEL[persona]}
            />
            <ProgressStep
              done={stepsDone.synthesis}
              active={status === 'synthesizing'}
              label="Synthesizing insights…"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-rose-300 text-xs font-inter leading-snug">{error}</p>
          </div>
        )}

        {/* Result body */}
        {result && (
          <div className="space-y-4">
            {/* Summary — always visible */}
            {result.summary && (
              <Section icon={<Sparkles className="w-3.5 h-3.5" />} label="Market Summary">
                <p className="text-cream font-source-serif text-sm leading-relaxed">{result.summary}</p>
              </Section>
            )}

            {/* Conversion recommendation pill — Business persona only.
                Pro tier; on lower plans we show a locked teaser when the
                book is business persona, otherwise omit entirely. */}
            {persona === 'business' && (showWebsiteAnalysis ? result.conversionRecommendation : true) && (
              <Section icon={<Target className="w-3.5 h-3.5" />} label="Conversion Recommendation" tier="PRO">
                {showWebsiteAnalysis
                  ? <ConversionRecBlock
                      recommendation={result.conversionRecommendation ?? null}
                      reason={result.conversionReason ?? null}
                    />
                  : <LockedSection tier="pro" copy="See whether to publish free, paid, or as a lead magnet — based on real CTA data from your site.">
                      <ConversionRecBlock recommendation="lead_magnet" reason="Sample reasoning text shown blurred behind the upgrade overlay." />
                    </LockedSection>}
              </Section>
            )}

            {/* Market signals */}
            {result.marketSignals && result.marketSignals.length > 0 && (
              <Section icon={<TrendingUp className="w-3.5 h-3.5" />} label="Market Signals">
                <div className="space-y-2">
                  {result.marketSignals.map((s, i) => <SignalCard key={i} signal={s} />)}
                </div>
              </Section>
            )}

            {/* Content angles — Standard+ */}
            <Section icon={<Compass className="w-3.5 h-3.5" />} label="Content Angles" tier="STANDARD+">
              {showAngles
                ? <AnglesList angles={result.contentAngles ?? []} />
                : <LockedSection tier="standard" copy="Unlock angles, audience insights, and more on Standard.">
                    <AnglesList angles={GHOST_ANGLES} />
                  </LockedSection>}
            </Section>

            {/* Audience insights — Standard+ */}
            <Section icon={<Users className="w-3.5 h-3.5" />} label="Audience Insights" tier="STANDARD+">
              {showAudience
                ? <AudienceBlock insights={result.audienceInsights ?? null} />
                : <LockedSection tier="standard" copy="Unlock the pain, the price, and where they gather.">
                    <AudienceBlock insights={GHOST_AUDIENCE} />
                  </LockedSection>}
            </Section>

            {/* Reader language — Storyteller only, Standard+ */}
            {persona === 'storyteller' && (
              <Section icon={<MessageCircle className="w-3.5 h-3.5" />} label="Reader Language" tier="STANDARD+">
                {showReaderLanguage
                  ? <ReaderLanguageBlock phrases={result.readerLanguage ?? []} onCopy={copyToClipboard} />
                  : <LockedSection tier="standard" copy="See the actual phrases your readers use — on Standard.">
                      <ReaderLanguageBlock phrases={GHOST_READER_LANGUAGE} onCopy={() => { /* ghost */ }} />
                    </LockedSection>}
              </Section>
            )}

            {/* Competitor landscape — Pro */}
            <Section icon={<Trophy className="w-3.5 h-3.5" />} label="Competitor Landscape" tier="PRO">
              {showCompetitors
                ? <CompetitorBlock landscape={result.competitorLandscape ?? null} />
                : <LockedSection tier="pro" copy="See crowded angles, gaps, and price ranges with Pro.">
                    <CompetitorBlock landscape={GHOST_COMPETITORS} />
                  </LockedSection>}
            </Section>

            {/* Competitor breakdown — Publisher only, Pro tier. Cards per
                actual competitor extracted by the route. */}
            {persona === 'publisher' && (
              <Section icon={<Trophy className="w-3.5 h-3.5" />} label="Competitor Breakdown" tier="PRO">
                {showCompetitorBreakdown
                  ? <CompetitorBreakdownList entries={result.competitorData ?? []} />
                  : <LockedSection tier="pro" copy="Per-book competitor analysis — strengths, weaknesses, and pricing — on Pro.">
                      <CompetitorBreakdownList entries={GHOST_COMPETITOR_ENTRIES} />
                    </LockedSection>}
              </Section>
            )}

            {/* Boundary between market intelligence (above) and business
                context (below). Synthesis runs as two phases — Phase 1 is
                topic-driven market analysis, Phase 2 layers in the
                author's actual business — and this divider mirrors that
                separation in the UI so the user can read above and trust
                it as objective market data, then read below as advice
                tailored to their specific business. */}
            {persona === 'business' && (
              <div className="border-t border-ink-4 pt-6 mt-2">
                <p className="text-xs font-inter tracking-widest uppercase text-ink-subtle mb-6">
                  Your Business Context
                </p>
              </div>
            )}

            {/* Website analysis — Business only, Pro tier. */}
            {persona === 'business' && (
              <Section icon={<Globe className="w-3.5 h-3.5" />} label="Website Analysis" tier="PRO">
                {showWebsiteAnalysis
                  ? <WebsiteAnalysisBlock extraction={result.websiteExtraction ?? null} />
                  : <LockedSection tier="pro" copy="Structured analysis of your site — offer, audience, and differentiators — on Pro.">
                      <WebsiteAnalysisBlock extraction={GHOST_WEBSITE_EXTRACTION} />
                    </LockedSection>}
              </Section>
            )}

            {/* Book recommendations — Pro */}
            <Section icon={<BookOpen className="w-3.5 h-3.5" />} label="Book Recommendations" tier="PRO">
              {showRecs
                ? <RecsBlock recs={result.bookRecommendations ?? null} />
                : <LockedSection tier="pro" copy="Get positioning, hook, length, and monetization advice on Pro.">
                    <RecsBlock recs={GHOST_RECS} />
                  </LockedSection>}
            </Section>

            {/* Sources */}
            {result.sources && result.sources.length > 0 && (
              <Section icon={<ExternalLink className="w-3.5 h-3.5" />} label="Sources">
                <div className="flex flex-wrap gap-1.5">
                  {result.sources.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-inter text-gold hover:text-gold-soft px-2 py-1 bg-ink-3 rounded-md truncate max-w-[180px] transition-colors"
                      title={url}
                    >
                      {new URL(url).hostname.replace(/^www\./, '')}
                    </a>
                  ))}
                </div>
              </Section>
            )}

            {/* Apply to Book — appears after every section so users can act
                on the radar's findings without leaving the panel. Re-apply
                affordance when this book has been calibrated before. */}
            <ApplyToBookCard
              applying={applying}
              applyError={applyError}
              appliedAt={appliedAt}
              onApply={applyRadar}
              onReopenLastResult={applyResult ? () => setModalOpen(true) : undefined}
            />
          </div>
        )}

        {!result && !running && !error && (
          <p className="text-ink-subtle text-xs font-source-serif leading-relaxed">
            Run a market intelligence scan to surface trends, audience pain points, and positioning opportunities for this book.
          </p>
        )}
      </div>

      {/* Apply-Radar results modal — opens after a successful /apply-radar.
          Owns its own state for accept-outline; closes on overlay click,
          escape, or footer navigation. */}
      <RadarApplyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        bookId={bookId}
        result={applyResult}
        onNavigateStage={onNavigateStage}
      />

      {/* Copy toast — bottom-right, fades after 2s */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-3 py-2 rounded-lg bg-ink-1 border border-gold/40 text-cream-1 font-inter text-xs shadow-2xl"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ProgressStep({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {done
        ? <Check className="w-3.5 h-3.5 text-gold" />
        : active
          ? <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
          : <span className="w-2 h-2 rounded-full bg-ink-3" />}
      <span className={done ? 'text-cream/70' : active ? 'text-cream' : 'text-ink-subtle'}>{label}</span>
    </div>
  )
}

function Section({ icon, label, tier, children }: { icon: React.ReactNode; label: string; tier?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-gold">{icon}</span>
        <h4 className="text-[10px] font-inter font-semibold text-cream uppercase tracking-[0.15em]">{label}</h4>
        {tier && (
          <span className="ml-auto text-[9px] font-inter font-semibold text-gold/70 px-1.5 py-0.5 rounded bg-gold/10">
            {tier}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function SignalCard({ signal }: { signal: RadarMarketSignal }) {
  const u = signal.urgency ? URGENCY_STYLES[signal.urgency] : null
  return (
    <div className="bg-ink-3 border border-ink-4 rounded-md p-3">
      {u && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${u.dot}`} />
          <span className={`text-[9px] font-inter font-semibold tracking-[0.15em] ${u.text}`}>{u.label}</span>
        </div>
      )}
      <p className="text-cream font-source-serif text-xs leading-relaxed">{signal.signal}</p>
      {signal.why_it_matters && (
        <p className="text-ink-subtle font-source-serif text-[11px] mt-1.5 italic leading-relaxed">{signal.why_it_matters}</p>
      )}
    </div>
  )
}

function AnglesList({ angles }: { angles: RadarContentAngle[] }) {
  if (!angles.length) return <p className="text-ink-subtle text-xs italic">No angles yet…</p>
  return (
    <div className="space-y-2">
      {angles.map((a, i) => (
        <div key={i} className="bg-ink-3 border border-ink-4 rounded-md p-3 space-y-1">
          <p className="text-cream text-xs font-inter font-semibold leading-snug">{a.angle}</p>
          <p className="text-ink-subtle text-[11px] font-source-serif leading-snug">
            <span className="text-gold/80">Differentiator:</span> {a.differentiator}
          </p>
          <p className="text-ink-subtle text-[11px] font-source-serif leading-snug">
            <span className="text-gold/80">Audience fit:</span> {a.audience_fit}
          </p>
        </div>
      ))}
    </div>
  )
}

function AudienceBlock({ insights }: { insights: RadarAudienceInsights | null }) {
  if (!insights) return <p className="text-ink-subtle text-xs italic">No insights yet…</p>
  return (
    <div className="bg-ink-3 border border-ink-4 rounded-md p-3 space-y-2 text-[11px] font-source-serif text-cream/90 leading-relaxed">
      <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Biggest pain</span><br />{insights.biggestPain}</p>
      {insights.alreadyTried?.length > 0 && (
        <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Already tried</span><br />{insights.alreadyTried.join(' · ')}</p>
      )}
      <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Will pay</span><br />{insights.willingToPay}</p>
      {insights.where_they_gather?.length > 0 && (
        <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Where they gather</span><br />{insights.where_they_gather.join(' · ')}</p>
      )}
    </div>
  )
}

function CompetitorBlock({ landscape }: { landscape: RadarCompetitorLandscape | null }) {
  if (!landscape) return <p className="text-ink-subtle text-xs italic">No competitor data yet…</p>
  return (
    <div className="bg-ink-3 border border-ink-4 rounded-md p-3 space-y-2 text-[11px] font-source-serif text-cream/90 leading-relaxed">
      {landscape.crowded_areas?.length > 0 && (
        <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Crowded</span><br />{landscape.crowded_areas.join(' · ')}</p>
      )}
      {landscape.gaps?.length > 0 && (
        <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Gaps</span><br />{landscape.gaps.join(' · ')}</p>
      )}
      <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Price range</span><br />{landscape.price_range}</p>
    </div>
  )
}

function RecsBlock({ recs }: { recs: RadarBookRecommendations | null }) {
  if (!recs) return <p className="text-ink-subtle text-xs italic">No recommendations yet…</p>
  return (
    <div className="bg-ink-3 border border-ink-4 rounded-md p-3 space-y-2 text-[11px] font-source-serif text-cream/90 leading-relaxed">
      <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Positioning</span><br />{recs.positioning}</p>
      <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Suggested hook</span><br />{recs.suggested_hook}</p>
      <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Ideal length</span><br />{recs.ideal_length}</p>
      <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Monetization</span><br />{recs.monetization} — {recs.monetization_reason}</p>
    </div>
  )
}

// Conversion-recommendation pill. Color-coded by recommendation:
// gold for lead_magnet, green for paid, ink-subtle for free.
function ConversionRecBlock({
  recommendation, reason,
}: {
  recommendation: 'free' | 'paid' | 'lead_magnet' | null
  reason: string | null
}) {
  if (!recommendation) {
    return <p className="text-ink-subtle text-xs italic">No recommendation yet…</p>
  }
  const styles: Record<typeof recommendation, { bg: string; border: string; text: string; label: string }> = {
    lead_magnet: { bg: 'bg-gold/15',     border: 'border-gold/50',         text: 'text-gold-soft',   label: 'Lead Magnet' },
    paid:        { bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-300', label: 'Paid Book' },
    free:        { bg: 'bg-ink-3',       border: 'border-ink-4',           text: 'text-cream/80',    label: 'Free Book' },
  }
  const s = styles[recommendation]
  return (
    <div className="space-y-2">
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${s.bg} ${s.border} border ${s.text} font-inter font-semibold text-xs`}>
        <Target className="w-3 h-3" />
        {s.label}
      </span>
      {reason && (
        <p className="text-cream/80 font-source-serif text-[11px] leading-relaxed">{reason}</p>
      )}
    </div>
  )
}

// Reader-language tags. Each pill copies its phrase to the clipboard on
// click and triggers a toast at the panel root.
function ReaderLanguageBlock({
  phrases, onCopy,
}: {
  phrases: string[]
  onCopy: (text: string) => void
}) {
  if (!phrases.length) return <p className="text-ink-subtle text-xs italic">No reader language yet…</p>
  return (
    <div className="space-y-2">
      <p className="text-ink-subtle text-[11px] font-source-serif italic">Words your readers actually use:</p>
      <div className="flex flex-wrap gap-1.5">
        {phrases.map((phrase, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onCopy(phrase)}
            title="Click to copy"
            className="px-2.5 py-1 rounded-full bg-ink-4 hover:bg-ink-3 border border-ink-3 text-cream-1 font-inter text-[11px] transition-colors cursor-pointer"
          >
            {phrase}
          </button>
        ))}
      </div>
    </div>
  )
}

// Per-competitor card list. Each card shows title + price, the promise,
// strengths in green, weaknesses in rose. Empty arrays simply omit their
// row rather than showing "(none)".
function CompetitorBreakdownList({ entries }: { entries: RadarCompetitorEntry[] }) {
  if (!entries.length) return <p className="text-ink-subtle text-xs italic">No competitor breakdowns yet…</p>
  return (
    <div className="space-y-2">
      {entries.map((c, i) => (
        <div key={i} className="bg-ink-3 border border-ink-4 rounded-md p-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-cream text-xs font-inter font-semibold leading-snug truncate">{c.title}</p>
            {c.price && <span className="text-gold-soft text-[11px] font-inter shrink-0">{c.price}</span>}
          </div>
          {c.promise && (
            <p className="text-cream/80 font-source-serif text-[11px] leading-snug">
              <span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Promise: </span>
              {c.promise}
            </p>
          )}
          {c.strengths.length > 0 && (
            <p className="text-emerald-300 font-source-serif text-[11px] leading-snug">
              <span className="font-inter font-semibold uppercase text-[9px] tracking-wider">✓ Strengths: </span>
              {c.strengths.join(', ')}
            </p>
          )}
          {c.weaknesses.length > 0 && (
            <p className="text-rose-300 font-source-serif text-[11px] leading-snug">
              <span className="font-inter font-semibold uppercase text-[9px] tracking-wider">✗ Weaknesses: </span>
              {c.weaknesses.join(', ')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// Business-persona website analysis. Shows the structured fields the
// enrichment pipeline pulled out of Firecrawl + Sonnet. Testimonials are
// summarised as a count rather than rendered (they live on the back-cover
// in the actual book).
function WebsiteAnalysisBlock({ extraction }: { extraction: RadarWebsiteExtraction | null }) {
  if (!extraction) return <p className="text-ink-subtle text-xs italic">No website analysis yet…</p>
  return (
    <div className="bg-ink-3 border border-ink-4 rounded-md p-3 space-y-2 text-[11px] font-source-serif text-cream/90 leading-relaxed">
      {extraction.companyName && (
        <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Company</span><br />{extraction.companyName}</p>
      )}
      {extraction.offer && (
        <p><span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Offer</span><br />{extraction.offer}</p>
      )}
      {extraction.keyDifferentiators.length > 0 && (
        <div>
          <p className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider mb-1">Key differentiators</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {extraction.keyDifferentiators.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      )}
      <p>
        <span className="text-gold/80 font-inter font-semibold uppercase text-[9px] tracking-wider">Testimonials found</span><br />
        {extraction.testimonials.length}
      </p>
    </div>
  )
}

// Ghost data shown blurred behind the upgrade overlay. Pure cosmetics —
// gives the locked sections shape so they don't read as empty boxes.
const GHOST_ANGLES: RadarContentAngle[] = [
  { angle: 'A specific framing for your book', differentiator: 'What makes it different', audience_fit: 'Who it serves' },
  { angle: 'Another positioning option',       differentiator: 'Its competitive edge',     audience_fit: 'A different reader' },
]

const GHOST_AUDIENCE: RadarAudienceInsights = {
  biggestPain: 'The single most acute problem this audience faces, distilled.',
  alreadyTried: ['solution one', 'solution two'],
  willingToPay: 'Typical price tolerance for solving this problem.',
  where_they_gather: ['community A', 'community B'],
}

const GHOST_COMPETITORS: RadarCompetitorLandscape = {
  crowded_areas: ['saturated angle', 'saturated angle'],
  gaps:          ['underserved gap', 'underserved gap'],
  price_range:   'Typical range in this space',
}

const GHOST_RECS: RadarBookRecommendations = {
  positioning: 'How to position the book for maximum traction',
  suggested_hook: 'A concrete opening line that hooks the right reader',
  ideal_length: 'Recommended chapter count',
  monetization: 'paid',
  monetization_reason: 'Why this monetization fits your audience',
}

const GHOST_COMPETITOR_ENTRIES: RadarCompetitorEntry[] = [
  { title: 'A leading book in your space', promise: 'What it claims to deliver', price: '$9.99', strengths: ['praised aspect'], weaknesses: ['common complaint'] },
  { title: 'Another major competitor',     promise: 'Its core promise',          price: '$14.99', strengths: ['praised aspect'], weaknesses: ['common complaint'] },
]

const GHOST_WEBSITE_EXTRACTION: RadarWebsiteExtraction = {
  companyName:        'Your Company',
  tagline:            'Your value proposition',
  offer:              'What you sell',
  targetAudience:     'Who you serve',
  keyDifferentiators: ['differentiator one', 'differentiator two'],
  ctaText:            'Work with me',
  testimonials:       ['testimonial one', 'testimonial two'],
  brandVoice:         'How you sound',
}

const GHOST_READER_LANGUAGE: string[] = [
  'a phrase your readers use',
  'another phrase',
  'an emotional beat',
  'a craving readers describe',
]

// ── Apply to Book CTA card ──────────────────────────────────────────────────
// Surfaces the radar's actionable promise. Shows a checklist of what
// "Apply to Book" will do (so the user knows what they're agreeing to)
// and the full-width gold button. After a previous apply, switches to a
// "Applied X days ago" hint with a Re-apply link, plus a "View results
// again" link if the modal data is still in memory this session.

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)))
}

function ApplyToBookCard({
  applying, applyError, appliedAt, onApply, onReopenLastResult,
}: {
  applying: boolean
  applyError: string | null
  appliedAt: string | null
  onApply: () => void
  onReopenLastResult?: () => void
}) {
  const days = daysSince(appliedAt)
  const alreadyApplied = appliedAt !== null

  return (
    <div className="bg-ink-2 border border-ink-3 rounded-xl p-6 mt-4 space-y-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-gold" />
        <p className="font-playfair text-cream text-base font-semibold">
          Ready to use these insights?
        </p>
      </div>
      <p className="text-cream-1/70 text-xs font-source-serif leading-relaxed">
        Apply to Book will:
      </p>
      <ul className="space-y-1.5 text-cream-1 text-xs font-source-serif">
        {[
          'Enrich your chapter briefs with audience context',
          'Draft your back cover copy',
          'Add the suggested opening hook to Chapter 1',
          'Set your monetization strategy',
          'Suggest an improved chapter structure',
        ].map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {applyError && (
        <p className="text-rose-300 text-xs font-inter">{applyError}</p>
      )}

      <button
        type="button"
        onClick={onApply}
        disabled={applying}
        className="w-full inline-flex items-center justify-center gap-2 px-8 py-3 bg-gold hover:bg-gold-soft text-ink-1 font-playfair font-semibold text-base rounded-lg transition-colors disabled:opacity-60"
      >
        {applying
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying intelligence to your book…</>
          : <><Sparkles className="w-4 h-4" /> {alreadyApplied ? 'Re-apply with latest radar' : 'Apply to Book'}</>}
      </button>

      {alreadyApplied && (
        <div className="flex items-center justify-between gap-3 text-[11px] font-inter">
          <p className="text-ink-subtle">
            Applied {days === null ? 'recently' : days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}.
          </p>
          {onReopenLastResult && (
            <button
              type="button"
              onClick={onReopenLastResult}
              className="text-gold hover:text-gold-soft underline underline-offset-2 transition-colors"
            >
              View last results
            </button>
          )}
        </div>
      )}
    </div>
  )
}
