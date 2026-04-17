'use client'

import { useState } from 'react'
import { Step1Outline } from './Step1Outline'
import { Step2Meta } from './Step2Meta'
import { Step3Persona } from './Step3Persona'
import { Step4Style } from './Step4Style'
import { Step5Cover } from './Step5Cover'
import { Step6Typography } from './Step6Typography'
import { Check } from 'lucide-react'

const STEPS = [
  'Outline',
  'Details',
  'Persona',
  'Visual Style',
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
  visualStyle: string
  coverDirection: string
  typography: string
}

interface WizardShellProps {
  bookId: string
  initialTitle: string
}

export function WizardShell({ bookId, initialTitle }: WizardShellProps) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>({
    outline: '',
    chapters: [],
    title: initialTitle,
    subtitle: '',
    authorName: '',
    persona: '',
    visualStyle: '',
    coverDirection: '',
    typography: '',
  })

  function next(patch: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...patch }))
    setStep((s) => s + 1)
  }

  function back() {
    setStep((s) => Math.max(0, s - 1))
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-10">
          <h1 className="font-playfair text-3xl text-cream mb-6 text-center">New Book</h1>
          <div className="flex items-center justify-between">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-inter font-medium transition-colors ${
                      i < step
                        ? 'bg-accent text-cream'
                        : i === step
                        ? 'bg-gold text-canvas'
                        : 'bg-[#2A2A2A] text-muted-foreground border border-[#333]'
                    }`}
                  >
                    {i < step ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-xs font-inter hidden sm:block ${i === step ? 'text-gold' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-8 sm:w-12 mx-1 ${i < step ? 'bg-accent' : 'bg-[#333]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#222] border border-[#333] rounded-xl p-8">
          {step === 0 && <Step1Outline data={data} onNext={next} />}
          {step === 1 && <Step2Meta data={data} onNext={next} onBack={back} />}
          {step === 2 && <Step3Persona data={data} onNext={next} onBack={back} />}
          {step === 3 && <Step4Style data={data} onNext={next} onBack={back} />}
          {step === 4 && <Step5Cover data={data} onNext={next} onBack={back} />}
          {step === 5 && <Step6Typography data={data} bookId={bookId} onBack={back} />}
        </div>
      </div>
    </div>
  )
}
