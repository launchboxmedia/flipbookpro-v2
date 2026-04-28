'use client'

import { useState } from 'react'
import type { WizardData } from './WizardShell'

interface Props {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

export function Step2Meta({ data, onNext, onBack }: Props) {
  const [title, setTitle] = useState(data.title === 'Untitled Book' ? '' : data.title)
  const [subtitle, setSubtitle] = useState(data.subtitle)
  const [authorName, setAuthorName] = useState(data.authorName)
  const [error, setError] = useState('')

  function handleNext() {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    onNext({ title: title.trim(), subtitle: subtitle.trim(), authorName: authorName.trim() })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Book Details</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          Set the title, subtitle, and author name for your book.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-inter text-ink-1/80">Title <span className="text-red-400">*</span></label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The Art of Strategic Thinking"
            className="w-full px-3 py-2.5 rounded-md bg-white border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-playfair text-lg focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-inter text-ink-1/80">Subtitle</label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="A practical guide to decisions that matter"
            className="w-full px-3 py-2 rounded-md bg-white border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-inter text-ink-1/80">Author Name</label>
          <input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 rounded-md bg-white border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors">
          Back
        </button>
        <button onClick={handleNext} className="px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm font-medium rounded-md transition-colors">
          Continue
        </button>
      </div>
    </div>
  )
}
