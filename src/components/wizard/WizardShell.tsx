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
    <div className="min-h-screen bg-canvas">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-10">
          <h1 className="font-playfair text-3xl text-cream mb-6 text-center">
            {data.chapters.length > 0 ? 'Edit Book' : 'New Book'}
          </h1>
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
                  <div className={`h-px w-6 sm:w-8 mx-1 ${i < step ? 'bg-accent' : 'bg-[#333]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#222] border border-[#333] rounded-xl p-8">
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
