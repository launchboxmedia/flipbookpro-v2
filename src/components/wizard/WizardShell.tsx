'use client'

import { useState } from 'react'
import { Step1Outline } from './Step1Outline'
import { Step2Meta } from './Step2Meta'
import { Step3Persona } from './Step3Persona'
import { Step4Tone } from './Step4Tone'
import { Step5ReaderLevel } from './Step5ReaderLevel'
import { Step4Style as Step6Style } from './Step4Style'
import { Step5Cover as Step7Cover } from './Step5Cover'
import { Step6Typography as Step8Typography } from './Step6Typography'
import { Check } from 'lucide-react'

const STEPS = [
  'Outline',
  'Details',
  'Audience',
  'Tone',
  'Reader',
  'Illustrations',
  'Cover',
  'Typography',
]

export interface WizardData {
  outline: string
  chapters: Array<{ title: string; brief: string }>
  title: string
  subtitle: string
  authorName: string
  persona: string
  vibe: string
  writingTone: string
  readerLevel: number
  humanScore: boolean
  visualStyle: string
  palette: string
  coverDirection: string
  typography: string
}

interface WizardShellProps {
  bookId: string
  initialData?: Partial<WizardData>
  maxChapters?: number
}

export function WizardShell({ bookId, initialData, maxChapters = 6 }: WizardShellProps) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>({
    outline: '',
    chapters: [],
    title: '',
    subtitle: '',
    authorName: '',
    persona: '',
    vibe: '',
    writingTone: '',
    readerLevel: 5,
    humanScore: false,
    visualStyle: '',
    palette: '',
    coverDirection: '',
    typography: '',
    ...initialData,
  })

  function next(patch: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...patch }))
    setStep((s) => s + 1)
  }

  function back() {
    setStep((s) => Math.max(0, s - 1))
  }

  return (
    <div className="min-h-screen bg-canvas relative overflow-hidden">
      {/* Subtle gold radial accent */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.08)_0%,transparent_55%)]" />

      <div className="relative max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10">
          <p className="text-[10px] font-inter font-semibold text-gold-dim uppercase tracking-[0.22em] mb-2 text-center">
            {data.chapters.length > 0 ? 'Edit Book' : 'New Book'}
          </p>
          <h1 className="font-playfair text-4xl text-cream font-semibold mb-7 text-center">
            Set the foundations
          </h1>
          <div className="flex items-center justify-between">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-inter font-medium transition-all ${
                      i < step
                        ? 'bg-gold text-ink-1 shadow-[0_0_18px_-4px_rgba(201,168,76,0.5)]'
                        : i === step
                        ? 'bg-gold text-ink-1 ring-2 ring-gold/40 ring-offset-2 ring-offset-canvas'
                        : 'bg-ink-2 text-ink-subtle border border-ink-3'
                    }`}
                  >
                    {i < step ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-[10px] font-inter hidden sm:block tracking-wide ${i === step ? 'text-gold font-medium' : 'text-ink-subtle'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-6 sm:w-8 mx-1 transition-colors ${i < step ? 'bg-gold' : 'bg-ink-3'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Cream "page" on a dark canvas — feels like a deliberate
            manuscript step rather than a dark form. */}
        <div className="bg-cream-1 border border-cream-3 rounded-2xl p-9 shadow-[0_28px_60px_-24px_rgba(0,0,0,0.55)] ring-1 ring-gold/15">
          {step === 0 && <Step1Outline data={data} onNext={next} maxChapters={maxChapters} />}
          {step === 1 && <Step2Meta data={data} onNext={next} onBack={back} />}
          {step === 2 && <Step3Persona data={data} onNext={next} onBack={back} />}
          {step === 3 && <Step4Tone data={data} onNext={next} onBack={back} />}
          {step === 4 && <Step5ReaderLevel data={data} onNext={next} onBack={back} />}
          {step === 5 && <Step6Style data={data} onNext={next} onBack={back} />}
          {step === 6 && <Step7Cover data={data} onNext={next} onBack={back} />}
          {step === 7 && <Step8Typography data={data} bookId={bookId} onBack={back} />}
        </div>
      </div>
    </div>
  )
}
