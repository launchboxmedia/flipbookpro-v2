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
        <h2 className="font-playfair text-2xl text-cream mb-1">What&apos;s the vibe?</h2>
        <p className="text-muted-foreground text-sm font-source-serif">
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
                ? 'border-accent bg-accent/10'
                : 'border-[#333] bg-[#1A1A1A] hover:border-[#444]'
            }`}
          >
            <span className="text-2xl mt-0.5">{v.emoji}</span>
            <div>
              <p className="font-inter font-medium text-cream text-sm">{v.label}</p>
              <p className="text-muted-foreground text-xs font-source-serif mt-0.5">{v.description}</p>
            </div>
            {vibe === v.id && (
              <div className="ml-auto mt-0.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-cream"/>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Writing Tone */}
      <div>
        <p className="text-cream text-sm font-inter font-medium mb-3">Writing Tone</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setWritingTone(t.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-inter transition-all ${
                writingTone === t.id
                  ? 'border-accent bg-accent/10 text-cream'
                  : 'border-[#333] bg-[#1A1A1A] text-muted-foreground hover:border-[#444] hover:text-cream'
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
        <button onClick={onBack} className="px-4 py-2.5 text-muted-foreground hover:text-cream font-inter text-sm transition-colors">Back</button>
        <button onClick={handleNext} className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors">Continue</button>
      </div>
    </div>
  )
}
