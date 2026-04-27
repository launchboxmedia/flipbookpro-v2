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
        <h2 className="font-playfair text-2xl text-cream mb-1">Your Persona</h2>
        <p className="text-muted-foreground text-sm font-source-serif">
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
                  ? 'border-accent bg-accent/10'
                  : 'border-[#333] bg-[#1A1A1A] hover:border-[#444]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-2 rounded-lg ${selected === p.id ? 'bg-accent/20' : 'bg-[#2A2A2A]'}`}>
                  <Icon className={`w-4 h-4 ${selected === p.id ? 'text-accent' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="font-inter font-medium text-cream text-sm">{p.label}</p>
                  <p className="text-muted-foreground text-xs font-source-serif mt-0.5">{p.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-muted-foreground hover:text-cream font-inter text-sm transition-colors">Back</button>
        <button
          onClick={handleNext}
          disabled={!selected}
          className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
