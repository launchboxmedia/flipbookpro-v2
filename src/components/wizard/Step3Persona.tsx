'use client'

import { useState } from 'react'
import type { WizardData } from './WizardShell'
import { Briefcase, BookMarked, Feather } from 'lucide-react'

const PERSONAS = [
  {
    id: 'business',
    label: 'Business Owner',
    description: 'Professional tone. No human figures in illustrations. Focused on authority and expertise.',
    icon: Briefcase,
  },
  {
    id: 'publisher',
    label: 'Publisher',
    description: 'Editorial tone. No human figures. Clean, sophisticated visual language.',
    icon: BookMarked,
  },
  {
    id: 'storyteller',
    label: 'Storyteller',
    description: 'Warm, narrative tone. Rich illustrations. Human connection at the center.',
    icon: Feather,
  },
]

interface Props {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

export function Step3Persona({ data, onNext, onBack }: Props) {
  const [selected, setSelected] = useState(data.persona)
  const [error, setError] = useState('')

  function handleNext() {
    if (!selected) { setError('Choose a persona.'); return }
    onNext({ persona: selected })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Your Persona</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          This shapes the tone of the writing and the style of the illustrations.
        </p>
      </div>

      <div className="grid gap-3">
        {PERSONAS.map((p) => {
          const Icon = p.icon
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                selected === p.id
                  ? 'border-gold bg-gold/10'
                  : 'border-cream-3 bg-white hover:border-gold/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-2 rounded-lg ${selected === p.id ? 'bg-gold/20' : 'bg-white-2'}`}>
                  <Icon className={`w-4 h-4 ${selected === p.id ? 'text-gold-dim' : 'text-ink-1/60'}`} />
                </div>
                <div>
                  <p className="font-inter font-medium text-ink-1 text-sm">{p.label}</p>
                  <p className="text-ink-1/60 text-xs font-source-serif mt-0.5">{p.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors">Back</button>
        <button
          onClick={handleNext}
          disabled={!selected}
          className="px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
