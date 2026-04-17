'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WizardData } from './WizardShell'
import { Loader2 } from 'lucide-react'

const TYPOGRAPHY_OPTIONS = [
  { id: 'standard_clean', label: 'Standard Clean', preview: 'Aa', font: 'font-inter', description: 'Modern sans-serif, easy to read.' },
  { id: 'executive_serif', label: 'Executive Serif', preview: 'Aa', font: 'font-source-serif', description: 'Authoritative, traditional gravitas.' },
  { id: 'editorial_classic', label: 'Editorial Classic', preview: 'Aa', font: 'font-playfair', description: 'Magazine-style elegance.' },
  { id: 'bold_display', label: 'Bold Display', preview: 'Aa', font: 'font-playfair', description: 'Dramatic headings, strong presence.' },
]

interface Props {
  data: WizardData
  bookId: string
  onBack: () => void
}

export function Step6Typography({ data, bookId, onBack }: Props) {
  const [selected, setSelected] = useState(data.typography)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSave() {
    if (!selected) { setError('Choose a typography style.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/books/${bookId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, typography: selected }),
      })
      if (!res.ok) throw new Error('Failed to save')
      router.push(`/book/${bookId}/coauthor`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-cream mb-1">Typography</h2>
        <p className="text-muted-foreground text-sm font-source-serif">
          This sets the text style used throughout your flipbook.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TYPOGRAPHY_OPTIONS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={`text-left p-4 rounded-xl border transition-all ${
              selected === t.id
                ? 'border-accent bg-accent/10'
                : 'border-[#333] bg-[#1A1A1A] hover:border-[#444]'
            }`}
          >
            <div className={`text-4xl mb-2 ${t.font} ${selected === t.id ? 'text-cream' : 'text-cream/60'}`}>
              {t.preview}
            </div>
            <p className="font-inter font-medium text-cream text-sm">{t.label}</p>
            <p className="text-muted-foreground text-xs font-source-serif mt-0.5">{t.description}</p>
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-muted-foreground hover:text-cream font-inter text-sm transition-colors">Back</button>
        <button
          onClick={handleSave}
          disabled={saving || !selected}
          className="flex items-center gap-2 px-6 py-2.5 bg-gold hover:bg-gold/90 text-canvas font-inter text-sm font-semibold rounded-md transition-colors disabled:opacity-40"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Creating book...' : 'Create Book'}
        </button>
      </div>
    </div>
  )
}
