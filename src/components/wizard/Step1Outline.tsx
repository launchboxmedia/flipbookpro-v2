'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { WizardData } from './WizardShell'
import { Loader2, Trash2, Plus, ArrowRight } from 'lucide-react'
import { Step1Scratch } from './Step1Scratch'

interface Props {
  data: WizardData
  /** Required in scratch mode now that Step 4 polls for the per-book
   *  radar; harmless in upload mode (the upload branch ignores it). */
  bookId: string
  onNext: (patch: Partial<WizardData>) => void
  /** Optional in the legacy first-step shape; required now that the
   *  radar step sits before this one. WizardShell always passes it. */
  onBack?: () => void
  maxChapters?: number
  /** 'scratch' = user describes the idea, Claude generates a suggested
   *  chapter structure. 'upload' = user pastes an existing outline,
   *  Claude parses it. Default is 'upload' for backward-compat with the
   *  edit-existing-book flow. */
  mode?: 'scratch' | 'upload'
}

export function Step1Outline({ data, bookId, onNext, onBack, maxChapters = 6, mode = 'upload' }: Props) {
  // eslint-disable-next-line no-console
  console.log('[Step1Outline] mode:', mode)
  // Scratch mode is a wholly different experience (problem-statement +
  // optional radar insight card from Step 1). Dispatch to the dedicated
  // component so the upload/edit path below stays untouched.
  if (mode === 'scratch') {
    return <Step1Scratch data={data} bookId={bookId} onNext={onNext} onBack={onBack} maxChapters={maxChapters} />
  }

  const [outline, setOutline] = useState(data.outline)
  const [chapters, setChapters] = useState<Array<{ title: string; brief: string }>>(data.chapters)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState('')
  const [detected, setDetected] = useState(chapters.length > 0)

  const heading     = 'Your Outline'
  const description = 'Paste your table of contents or chapter outline. Claude will detect the chapters automatically.'
  const placeholder = 'Chapter 1: The Foundation\nChapter 2: Building Momentum\n...'
  const detectButton = 'Detect Chapters with AI'
  const detectingLabel = 'Detecting chapters…'
  const chapterListHeading = `${chapters.length} chapter${chapters.length !== 1 ? 's' : ''} detected`

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
        body: JSON.stringify({ outline, mode: 'upload' }),
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
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">{heading}</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          {description}
        </p>
      </div>

      <textarea
        value={outline}
        onChange={(e) => setOutline(e.target.value)}
        placeholder={placeholder}
        rows={8}
        className="w-full px-3 py-3 rounded-md bg-white border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
      />

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      {!detected && (
        <button
          onClick={detectChapters}
          disabled={detecting}
          className="flex items-center gap-2 px-4 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-60"
        >
          {detecting && <Loader2 className="w-4 h-4 animate-spin" />}
          {detecting ? detectingLabel : detectButton}
        </button>
      )}

      {chapters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-inter text-sm font-medium text-ink-1/80">
              {chapterListHeading}
            </h3>
            <button
              onClick={detectChapters}
              disabled={detecting}
              className="text-xs text-ink-1/60 hover:text-gold font-inter transition-colors whitespace-nowrap shrink-0"
            >
              Re-detect
            </button>
          </div>

          {chapters.map((ch, i) => (
            <div key={i} className="border border-cream-3 rounded-lg p-4 bg-white space-y-2">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-md bg-gold text-ink-1 font-inter font-bold text-sm flex items-center justify-center shrink-0 mt-1">
                  {i + 1}
                </span>
                <div className="flex-1 space-y-2">
                  <input
                    aria-label={`Chapter ${i + 1} title`}
                    value={ch.title}
                    onChange={(e) => updateChapter(i, 'title', e.target.value)}
                    className="w-full px-2 py-1.5 rounded bg-cream-2 border border-cream-3 text-ink-1 font-inter text-sm focus:outline-none focus:ring-1 focus:ring-gold/40"
                  />
                  <textarea
                    aria-label={`Chapter ${i + 1} brief`}
                    value={ch.brief}
                    onChange={(e) => updateChapter(i, 'brief', e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1.5 rounded bg-cream-2 border border-cream-3 text-ink-1 placeholder:text-ink-1/40 font-source-serif text-sm focus:outline-none focus:ring-1 focus:ring-gold/40 resize-none"
                    placeholder="Chapter brief..."
                  />
                </div>
                <button
                  onClick={() => removeChapter(i)}
                  className="text-ink-1/60 hover:text-red-400 transition-colors mt-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {chapters.length < maxChapters ? (
            <button
              onClick={addChapter}
              className="flex items-center gap-1.5 text-xs text-ink-1/60 hover:text-ink-1 font-inter transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add chapter
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-cream-3 bg-white px-4 py-3">
              <p className="text-xs font-inter text-ink-1/60">
                {maxChapters}-chapter limit reached on your current plan.
              </p>
              <Link href="/settings/billing" className="flex items-center gap-1 text-xs font-inter text-gold-dim hover:text-gold-dim/80 transition-colors whitespace-nowrap ml-4">
                Upgrade <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        {onBack ? (
          <button
            onClick={onBack}
            className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors"
          >
            Back
          </button>
        ) : <span />}
        <button
          onClick={handleNext}
          disabled={chapters.length === 0}
          className="px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
