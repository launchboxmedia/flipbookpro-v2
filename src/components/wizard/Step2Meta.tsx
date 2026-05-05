'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Loader2, RefreshCw, X, Check } from 'lucide-react'
import type { WizardData } from './WizardShell'

interface Props {
  data: WizardData
  bookId: string
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

interface TitleSuggestion {
  title: string
  subtitle: string
  style: string
}

const STYLE_LABEL: Record<string, string> = {
  direct:     'Direct',
  intriguing: 'Intriguing',
  benefit:    'Benefit',
  numbered:   'Numbered',
  authority:  'Authority',
}

const STYLE_BADGE: Record<string, string> = {
  direct:     'bg-cream-3 text-ink-1/80',
  intriguing: 'bg-purple-100 text-purple-700 border border-purple-200',
  benefit:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
  numbered:   'bg-amber-100 text-amber-800 border border-amber-200',
  authority:  'bg-blue-100 text-blue-800 border border-blue-200',
}

export function Step2Meta({ data, bookId, onNext, onBack }: Props) {
  const [title, setTitle]         = useState(data.title === 'Untitled Book' ? '' : data.title)
  const [subtitle, setSubtitle]   = useState(data.subtitle)
  const [error, setError]         = useState('')

  // Suggestion panel state. The panel is hidden until the user clicks
  // Suggest Titles, then stays open (with regenerate + close affordances)
  // so they can compare options before picking.
  const [suggesting, setSuggesting]                 = useState(false)
  const [suggestions, setSuggestions]               = useState<TitleSuggestion[]>([])
  const [suggestError, setSuggestError]             = useState('')
  const [panelOpen, setPanelOpen]                   = useState(false)
  const [pickedIndex, setPickedIndex]               = useState<number | null>(null)

  // Title generation now runs BEFORE the outline step, so chapters are
  // typically empty here. As long as the user gave the route something
  // to anchor against — chapters, niche, picked topic, or their own
  // description — Sonnet has enough to produce titles.
  const canSuggest =
    data.chapters.length > 0 ||
    !!data.niche ||
    !!data.radarTopic ||
    !!data.ideaDescription

  // Auto-trigger Suggest Titles on mount when the user came from Step 1
  // with a topic and hasn't typed a title yet. Skips on revisits where
  // the title is already set, so the user doesn't lose their work.
  const autoTriggeredRef = useRef(false)
  useEffect(() => {
    if (autoTriggeredRef.current) return
    if (!canSuggest) return
    if (title.trim().length > 0) return
    autoTriggeredRef.current = true
    void suggestTitles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function suggestTitles() {
    if (suggesting || !canSuggest) return
    setSuggesting(true)
    setSuggestError('')
    setPanelOpen(true)
    try {
      const res = await fetch(`/api/books/${bookId}/generate-titles`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          chapters:       data.chapters,
          persona:        data.persona,
          targetAudience: data.targetAudience,
          existingTitle:  title.trim(),
          // The author's own description of the book idea (Step 1
          // textarea). When present, the route uses this as the primary
          // signal — it's richer than radar topics or chapter lists.
          description:    data.ideaDescription,
          // Wizard-session radar context — captured in Step 1, never
          // persisted. Supplements the description with trending market
          // signals; never overrides it.
          radarContext: data.radarResults ? {
            niche:         data.niche,
            pickedTopic:   data.radarTopic,
            topHotSignal:  data.radarResults.hot_signals?.[0]?.topic,
            topEvergreen:  data.radarResults.evergreen_winners?.[0]?.topic,
            topHiddenGold: data.radarResults.hidden_gold?.[0]?.niche,
          } : undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Suggestion failed (${res.status})`)
      const arr = Array.isArray(json.suggestions) ? json.suggestions as TitleSuggestion[] : []
      if (arr.length === 0) throw new Error('No suggestions came back. Try again.')
      setSuggestions(arr)
      setPickedIndex(null)
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : 'Suggestion failed')
    } finally {
      setSuggesting(false)
    }
  }

  function pickSuggestion(s: TitleSuggestion, idx: number) {
    setTitle(s.title)
    setSubtitle(s.subtitle)
    setPickedIndex(idx)
    setError('')
  }

  function handleNext() {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    onNext({ title: title.trim(), subtitle: subtitle.trim() })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Title</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          Pick a title for your book. Subtitle is optional. Your author name comes from your brand profile.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-inter text-ink-1/80">
              Title <span className="text-red-400">*</span>
            </label>
            <button
              type="button"
              onClick={suggestTitles}
              disabled={!canSuggest || suggesting}
              title={canSuggest
                ? 'Generate 5 title + subtitle options from your outline'
                : 'Add chapters in step 1 first to enable suggestions'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gold/40 hover:border-gold text-gold-dim hover:text-gold-dim/80 text-xs font-inter font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {suggesting
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Suggesting…</>
                : <><Sparkles className="w-3 h-3" /> Suggest titles</>}
            </button>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The Art of Strategic Thinking"
            className="w-full px-3 py-2.5 rounded-md bg-white border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-playfair text-lg focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
        </div>

        {/* Suggestion panel — appears below the title field once the user
            kicks off generation. Stays open with a Re-suggest + Close so
            users can A/B without losing the panel. Picking an option
            populates both inputs and marks the card so they can see what
            they applied. */}
        {panelOpen && (
          <div className="bg-cream-2 border border-cream-3 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-gold" />
                <p className="font-inter font-semibold text-ink-1 text-xs uppercase tracking-wider">
                  Title suggestions
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={suggestTitles}
                  disabled={suggesting}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-inter text-ink-1/60 hover:text-gold transition-colors disabled:opacity-40"
                >
                  {suggesting
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> …</>
                    : <><RefreshCw className="w-3 h-3" /> Re-suggest</>}
                </button>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close suggestions"
                  className="text-ink-1/40 hover:text-ink-1/80 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {suggestError && (
              <p className="text-red-500 text-xs font-inter">{suggestError}</p>
            )}

            {suggesting && suggestions.length === 0 && (
              <p className="text-ink-1/60 text-xs font-inter italic">
                Generating market-aware titles…
              </p>
            )}

            {suggestions.length > 0 && (
              <div className={`space-y-2 ${suggesting ? 'opacity-50 pointer-events-none' : ''}`}>
                {suggestions.map((s, i) => {
                  const picked = pickedIndex === i
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickSuggestion(s, i)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        picked
                          ? 'border-gold bg-gold/10'
                          : 'border-cream-3 bg-white hover:border-gold/40 hover:bg-cream-2/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="font-playfair text-base text-ink-1 leading-tight">
                          {s.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {picked && <Check className="w-3.5 h-3.5 text-gold-dim" />}
                          <span className={`text-[10px] font-inter font-medium px-1.5 py-0.5 rounded ${STYLE_BADGE[s.style] ?? STYLE_BADGE.direct}`}>
                            {STYLE_LABEL[s.style] ?? s.style}
                          </span>
                        </div>
                      </div>
                      {s.subtitle && (
                        <p className="font-source-serif italic text-xs text-ink-1/65 leading-snug">
                          {s.subtitle}
                        </p>
                      )}
                    </button>
                  )
                })}
                <p className="text-[11px] font-inter text-ink-1/50 italic pt-1">
                  Click any suggestion to fill the title and subtitle. You can edit them after.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-inter text-ink-1/80">Subtitle</label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="A practical guide to decisions that matter"
            className="w-full px-3 py-2 rounded-md bg-white border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
        </div>

      </div>

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors">
          Back
        </button>
        <button onClick={handleNext} className="px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm font-medium rounded-md transition-colors">
          Continue
        </button>
      </div>
    </div>
  )
}
