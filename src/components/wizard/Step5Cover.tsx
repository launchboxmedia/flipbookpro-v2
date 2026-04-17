'use client'

import { useState } from 'react'
import type { WizardData } from './WizardShell'

const COVER_DIRECTIONS = [
  { id: 'bold_operator', label: 'Bold Operator', description: 'High contrast, strong typography, commands attention.' },
  { id: 'clean_corporate', label: 'Clean Corporate', description: 'Minimal, trusted, professional.' },
  { id: 'editorial_modern', label: 'Editorial Modern', description: 'Magazine-quality layout, refined spacing.' },
  { id: 'cinematic_abstract', label: 'Cinematic Abstract', description: 'Moody, atmospheric, striking.' },
  { id: 'retro_illustrated', label: 'Retro Illustrated', description: 'Vintage character, hand-crafted warmth.' },
  { id: 'studio_product', label: 'Studio Product', description: 'Clean studio aesthetic, premium feel.' },
]

interface Props {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

export function Step5Cover({ data, onNext, onBack }: Props) {
  const [selected, setSelected] = useState(data.coverDirection)
  const [error, setError] = useState('')

  function handleNext() {
    if (!selected) { setError('Choose a cover direction.'); return }
    onNext({ coverDirection: selected })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-cream mb-1">Cover Direction</h2>
        <p className="text-muted-foreground text-sm font-source-serif">
          This guides the AI when generating your book cover.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {COVER_DIRECTIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`text-left p-4 rounded-xl border transition-all ${
              selected === c.id
                ? 'border-gold bg-gold/10'
                : 'border-[#333] bg-[#1A1A1A] hover:border-[#444]'
            }`}
          >
            <p className={`font-inter font-medium text-sm mb-1 ${selected === c.id ? 'text-gold' : 'text-cream'}`}>
              {c.label}
            </p>
            <p className="text-muted-foreground text-xs font-source-serif">{c.description}</p>
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-muted-foreground hover:text-cream font-inter text-sm transition-colors">Back</button>
        <button onClick={handleNext} className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors">Continue</button>
      </div>
    </div>
  )
}
