'use client'

import { useState } from 'react'
import type { WizardData } from './WizardShell'

const VIBES = [
  { id: 'educational',   emoji: '📚', label: 'Educational',   description: 'Informative and clear' },
  { id: 'inspirational', emoji: '🌅', label: 'Inspirational', description: 'Uplifting and hopeful' },
  { id: 'research_mode', emoji: '🔬', label: 'Research Mode', description: 'Each chapter will be fact-checked and enriched with deep research' },
] as const

const TONES = [
  { id: 'professional', emoji: '💼', label: 'Professional' },
  { id: 'witty',        emoji: '😏', label: 'Witty' },
  { id: 'direct',       emoji: '🎯', label: 'Direct' },
  { id: 'empathetic',   emoji: '💛', label: 'Empathetic' },
] as const

const LEVEL_LABELS: Record<number, { label: string; description: string }> = {
  1:  { label: 'Grade 3',       description: 'Ages 8–9, simple vocabulary' },
  2:  { label: 'Grade 4',       description: 'Ages 9–10, building fundamentals' },
  3:  { label: 'Grade 5',       description: 'Ages 10–11, clear and concrete' },
  4:  { label: 'Middle School', description: 'Ages 11–14, growing complexity' },
  5:  { label: 'High School',   description: 'Ages 14–18, confident vocabulary' },
  6:  { label: 'College Intro', description: 'Introductory academic level' },
  7:  { label: 'College',       description: 'Undergraduate reading level' },
  8:  { label: 'Graduate',      description: 'Advanced academic vocabulary' },
  9:  { label: "Master's",      description: 'Specialist-level depth and nuance' },
  10: { label: 'Ph.D.',         description: 'Expert-level, highly technical' },
}

interface Props {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

/** Combined Step 4 — Tone + Reader Level.
 *
 *  Merges the previous Step4Tone (vibe + writing tone) and
 *  Step5ReaderLevel (level slider + Human Score toggle) into one step
 *  with a single Continue. Reduces the wizard from 9 to 6 steps without
 *  losing collected fields. */
export function Step4ToneReader({ data, onNext, onBack }: Props) {
  const [vibe, setVibe]               = useState(data.vibe || '')
  const [writingTone, setWritingTone] = useState(data.writingTone || '')
  const [level, setLevel]             = useState(data.readerLevel ?? 5)
  const [humanScore, setHumanScore]   = useState(data.humanScore ?? false)
  const [error, setError]             = useState('')

  const current = LEVEL_LABELS[level]

  function handleNext() {
    if (!vibe)        { setError('Choose a vibe for your book.'); return }
    if (!writingTone) { setError('Choose a writing tone.');       return }
    setError('')
    const safeLevel = Math.max(1, Math.min(10, Math.round(level)))
    onNext({ vibe, writingTone, readerLevel: safeLevel, humanScore })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Tone &amp; Reader</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          Set the mood, voice, and reading level for your book.
        </p>
      </div>

      {/* ── Top: Vibe + Writing Tone ────────────────────────────────────── */}
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-inter font-medium text-ink-1/80">Vibe</p>
          <div className="space-y-2">
            {VIBES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVibe(v.id)}
                className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  vibe === v.id
                    ? 'border-gold bg-gold/10'
                    : 'border-cream-3 bg-white hover:border-gold/40'
                }`}
              >
                <span className="text-2xl mt-0.5">{v.emoji}</span>
                <div>
                  <p className="font-inter font-medium text-ink-1 text-sm">{v.label}</p>
                  <p className="text-ink-1/60 text-xs font-source-serif mt-0.5">{v.description}</p>
                </div>
                {vibe === v.id && (
                  <div className="ml-auto mt-0.5 w-4 h-4 rounded-full bg-gold flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-inter font-medium text-ink-1/80">Writing Tone</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setWritingTone(t.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-inter transition-all ${
                  writingTone === t.id
                    ? 'border-gold bg-gold/10 text-ink-1'
                    : 'border-cream-3 bg-white text-ink-1/60 hover:border-gold/40 hover:text-ink-1'
                }`}
              >
                <span>{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom: Reader Level + Human Score ─────────────────────────── */}
      <div className="space-y-5 border-t border-cream-3 pt-6">
        <div className="space-y-3">
          <p className="text-sm font-inter font-medium text-ink-1/80">Reader Level</p>
          <div className="flex items-baseline justify-between">
            <p className="font-inter font-semibold text-ink-1 text-lg">{current.label}</p>
            <p className="text-ink-1/60 text-xs font-inter">Level {level} / 10</p>
          </div>
          <p className="text-ink-1/60 text-sm font-source-serif -mt-2">{current.description}</p>
          <div className="relative">
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-gold"
              style={{
                background: `linear-gradient(to right, #C9A84C 0%, #C9A84C ${(level - 1) / 9 * 100}%, #EDE6D8 ${(level - 1) / 9 * 100}%, #EDE6D8 100%)`,
              }}
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-ink-1/60 font-inter">Grade 3</span>
              <span className="text-xs text-ink-1/60 font-inter">Ph.D.</span>
            </div>
          </div>
        </div>

        <div className="border border-cream-3 rounded-xl p-4 bg-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-inter font-medium text-ink-1 text-sm">Human Score™</p>
              <p className="text-ink-1/60 text-xs font-source-serif mt-0.5">
                Authenticity optimization ensures your book passes AI-detection filters.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHumanScore((v) => !v)}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                humanScore ? 'bg-gold' : 'bg-cream-3'
              }`}
              aria-pressed={humanScore}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  humanScore ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm rounded-md transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
