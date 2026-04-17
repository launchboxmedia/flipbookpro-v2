'use client'

import { useState } from 'react'
import type { WizardData } from './WizardShell'

const STYLES = [
  { id: 'watercolor', label: 'Watercolor', description: 'Soft washes, organic edges, painterly warmth.' },
  { id: 'pencil_sketch', label: 'Pencil Sketch', description: 'Hand-drawn linework, textured, intimate.' },
  { id: 'oil_painting', label: 'Oil Painting', description: 'Rich depth, layered tones, classical weight.' },
  { id: '3d_render', label: '3D Render', description: 'Clean geometry, modern, high-impact.' },
]

interface Props {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

export function Step4Style({ data, onNext, onBack }: Props) {
  const [selected, setSelected] = useState(data.visualStyle)
  const [error, setError] = useState('')

  function handleNext() {
    if (!selected) { setError('Choose a visual style.'); return }
    onNext({ visualStyle: selected })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-cream mb-1">Visual Style</h2>
        <p className="text-muted-foreground text-sm font-source-serif">
          Every chapter gets one illustration in this style.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            className={`text-left p-4 rounded-xl border transition-all ${
              selected === s.id
                ? 'border-accent bg-accent/10'
                : 'border-[#333] bg-[#1A1A1A] hover:border-[#444]'
            }`}
          >
            <div className={`w-full aspect-video rounded-lg mb-3 flex items-center justify-center text-2xl ${
              selected === s.id ? 'bg-accent/20' : 'bg-[#2A2A2A]'
            }`}>
              {s.id === 'watercolor' && '🎨'}
              {s.id === 'pencil_sketch' && '✏️'}
              {s.id === 'oil_painting' && '🖼️'}
              {s.id === '3d_render' && '🔷'}
            </div>
            <p className="font-inter font-medium text-cream text-sm">{s.label}</p>
            <p className="text-muted-foreground text-xs font-source-serif mt-0.5">{s.description}</p>
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
