'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { WizardData } from './WizardShell'
import { Loader2, Trash2, Plus, ArrowRight } from 'lucide-react'

interface Props {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => void
  maxChapters?: number
}

export function Step1Outline({ data, onNext, maxChapters = 6 }: Props) {
  const [outline, setOutline] = useState(data.outline)
  const [chapters, setChapters] = useState<Array<{ title: string; brief: string }>>(data.chapters)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState('')
  const [detected, setDetected] = useState(chapters.length > 0)

  async function detectChapters() {
    if (!outline.trim()) {
      setError('Paste your outline above first.')
      return
    }
    setDetecting(true)
    setError('')
    try {
      const res = await fetch('/api/detect-chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outline }),
      })
      if (!res.ok && res.headers.get('content-type')?.includes('text/html')) {
        throw new Error(`Server error ${res.status}`)
      }
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      // Cap to plan limit
      const capped = (json.chapters as Array<{ title: string; brief: string }>).slice(0, maxChapters)
      if (json.chapters.length > maxChapters) {
        setError(`Your plan allows up to ${maxChapters} chapters. Only the first ${maxChapters} were imported. Upgrade to add more.`)
      }
      setChapters(capped)
      setDetected(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Detection failed')
    } finally {
      setDetecting(false)
    }
  }

  function updateChapter(i: number, field: 'title' | 'brief', value: string) {
    setChapters((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)))
  }

  function removeChapter(i: number) {
    setChapters((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addChapter() {
    if (chapters.length >= maxChapters) return
    setChapters((prev) => [...prev, { title: 'New Chapter', brief: '' }])
  }

  function handleNext() {
    if (chapters.length === 0) {
      setError('Add at least one chapter.')
      return
    }
    onNext({ outline, chapters })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-cream mb-1">Your Outline</h2>
        <p className="text-muted-foreground text-sm font-source-serif">
          Paste your table of contents or chapter outline. Claude will detect the chapters automatically.
        </p>
      </div>

      <textarea
        value={outline}
        onChange={(e) => setOutline(e.target.value)}
        placeholder="Chapter 1: The Foundation&#10;Chapter 2: Building Momentum&#10;..."
        rows={8}
        className="w-full px-3 py-3 rounded-md bg-[#1A1A1A] border border-[#333] text-cream placeholder:text-muted-foreground font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
      />

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      {!detected && (
        <button
          onClick={detectChapters}
          disabled={detecting}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-60"
        >
          {detecting && <Loader2 className="w-4 h-4 animate-spin" />}
          {detecting ? 'Detecting chapters...' : 'Detect Chapters with AI'}
        </button>
      )}

      {chapters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-inter text-sm font-medium text-cream/80">
              {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} detected
            </h3>
            <button
              onClick={detectChapters}
              disabled={detecting}
              className="text-xs text-muted-foreground hover:text-gold font-inter transition-colors"
            >
              Re-detect
            </button>
          </div>

          {chapters.map((ch, i) => (
            <div key={i} className="border border-[#333] rounded-lg p-4 bg-[#1A1A1A] space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground font-inter mt-2.5 w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 space-y-2">
                  <input
                    value={ch.title}
                    onChange={(e) => updateChapter(i, 'title', e.target.value)}
                    className="w-full px-2 py-1.5 rounded bg-[#2A2A2A] border border-[#333] text-cream font-inter text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <textarea
                    value={ch.brief}
                    onChange={(e) => updateChapter(i, 'brief', e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1.5 rounded bg-[#2A2A2A] border border-[#333] text-cream/70 font-source-serif text-xs focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                    placeholder="Chapter brief..."
                  />
                </div>
                <button
                  onClick={() => removeChapter(i)}
                  className="text-muted-foreground hover:text-red-400 transition-colors mt-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {chapters.length < maxChapters ? (
            <button
              onClick={addChapter}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cream font-inter transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add chapter
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-[#333] bg-[#1A1A1A] px-4 py-3">
              <p className="text-xs font-inter text-muted-foreground">
                {maxChapters}-chapter limit reached on your current plan.
              </p>
              <Link href="/settings/billing" className="flex items-center gap-1 text-xs font-inter text-accent hover:text-accent/80 transition-colors whitespace-nowrap ml-4">
                Upgrade <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={handleNext}
          disabled={chapters.length === 0}
          className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
