'use client'

import { useState } from 'react'
import type { WizardData } from './WizardShell'

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

export function Step5ReaderLevel({ data, onNext, onBack }: Props) {
  const [level, setLevel] = useState(data.readerLevel ?? 5)
  const [humanScore, setHumanScore] = useState(data.humanScore ?? false)

  const current = LEVEL_LABELS[level]

  function handleNext() {
    const safeLevel = Math.max(1, Math.min(10, Math.round(level)))
    onNext({ readerLevel: safeLevel, humanScore })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-playfair text-2xl text-cream mb-1">Reader Level</h2>
        <p className="text-muted-foreground text-sm font-source-serif">
          Set the complexity and vocabulary for your audience.
        </p>
      </div>

      {/* Slider */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <p className="font-inter font-semibold text-cream text-lg">{current.label}</p>
          <p className="text-muted-foreground text-xs font-inter">Level {level} / 10</p>
        </div>
        <p className="text-muted-foreground text-sm font-source-serif -mt-2">{current.description}</p>

        <div className="relative">
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-accent"
            style={{
              background: `linear-gradient(to right, var(--color-accent, #C9A84C) 0%, var(--color-accent, #C9A84C) ${(level - 1) / 9 * 100}%, #333 ${(level - 1) / 9 * 100}%, #333 100%)`,
            }}
          />
          <div className="flex justify-between mt-2">
            <span className="text-xs text-muted-foreground font-inter">Grade 3</span>
            <span className="text-xs text-muted-foreground font-inter">Ph.D.</span>
          </div>
        </div>
      </div>

      {/* Human Score toggle */}
      <div className="border border-[#333] rounded-xl p-4 bg-[#1A1A1A]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-inter font-medium text-cream text-sm">
              Human Score™
            </p>
            <p className="text-muted-foreground text-xs font-source-serif mt-0.5">
              Authenticity optimization ensures your book passes AI-detection filters
            </p>
          </div>
          <button
            onClick={() => setHumanScore((v) => !v)}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
              humanScore ? 'bg-accent' : 'bg-[#333]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-cream rounded-full shadow transition-transform ${
                humanScore ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-muted-foreground hover:text-cream font-inter text-sm transition-colors">Back</button>
        <button onClick={handleNext} className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors">Continue</button>
      </div>
    </div>
  )
}
