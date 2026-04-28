'use client'

import { useState } from 'react'
import type { WizardData } from './WizardShell'

const VIBES = [
  {
    id: 'educational',
    emoji: '📚',
    label: 'Educational',
    description: 'Informative and clear',
  },
  {
    id: 'inspirational',
    emoji: '🌅',
    label: 'Inspirational',
    description: 'Uplifting and hopeful',
  },
  {
    id: 'research_mode',
    emoji: '🔬',
    label: 'Research Mode',
    description: 'Each chapter will be fact-checked and enriched with deep research',
  },
]

const TONES = [
  { id: 'professional', emoji: '💼', label: 'Professional' },
  { id: 'witty',        emoji: '😏', label: 'Witty' },
  { id: 'direct',       emoji: '🎯', label: 'Direct' },
  { id: 'empathetic',   emoji: '💛', label: 'Empathetic' },
]

interface Props {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

export function Step4Tone({ data, onNext, onBack }: Props) {
  const [vibe, setVibe] = useState(data.vibe || '')
  const [writingTone, setWritingTone] = useState(data.writingTone || '')
  const [error, setError] = useState('')

  function handleNext() {
    if (!vibe) { setError('Choose a vibe for your book.'); return }
    if (!writingTone) { setError('Choose a writing tone.'); return }
    setError('')
    onNext({ vibe, writingTone })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">What&apos;s the vibe?</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          Set the mood and tone for your book.
        </p>
      </div>

      {/* Vibe */}
      <div className="space-y-2">
        {VIBES.map((v) => (
          <button
            key={v.id}
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
                <div className="w-1.5 h-1.5 rounded-full bg-white"/>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Writing Tone */}
      <div>
        <p className="text-ink-1 text-sm font-inter font-medium mb-3">Writing Tone</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
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

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors">Back</button>
        <button onClick={handleNext} className="px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm font-medium rounded-md transition-colors">Continue</button>
      </div>
    </div>
  )
}
