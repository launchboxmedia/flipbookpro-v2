'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WizardData } from './WizardShell'
import { Loader2 } from 'lucide-react'

// ── Page spread previews using exact theme values from bookTheme.ts ───────────

function StandardCleanPreview() {
  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col p-3" style={{ background: '#ffffff' }}>
      <div style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 300, letterSpacing: '0.2em', color: '#999999' }}>
        01
      </div>
      <div className="mt-1" style={{ fontFamily: 'var(--font-inter)', fontSize: '15px', fontWeight: 600, color: '#111111' }}>
        Getting Started
      </div>
      <p className="mt-2 line-clamp-3" style={{ fontFamily: 'var(--font-inter)', fontSize: '8px', lineHeight: 1.6, color: '#444444' }}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.
      </p>
      <div className="mt-auto self-end" style={{ fontFamily: 'var(--font-inter)', fontSize: '8px', color: '#999999' }}>
        12
      </div>
    </div>
  )
}

function ExecutiveSerifPreview() {
  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col p-3" style={{ background: '#faf9f7' }}>
      <div style={{ fontFamily: 'var(--font-source-serif)', fontSize: '13px', fontStyle: 'italic', color: '#8b6914' }}>
        I
      </div>
      <div className="mt-0.5" style={{ fontFamily: 'var(--font-playfair)', fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: '#1a1a1a' }}>
        The Foundation
      </div>
      <div className="mt-1.5 mb-2" style={{ width: '24px', height: '1px', background: '#C9A84C' }} />
      <p className="line-clamp-3" style={{ fontFamily: 'var(--font-source-serif)', fontSize: '8px', lineHeight: 1.7, color: '#333333' }}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua veniam.
      </p>
    </div>
  )
}

function EditorialClassicPreview() {
  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col p-3" style={{ background: '#f5f0e8' }}>
      <div style={{ height: '1px', background: 'rgba(26,26,26,0.25)' }} />
      <div
        className="my-1 text-center"
        style={{ fontFamily: 'var(--font-playfair)', fontSize: '14px', letterSpacing: '0.05em', color: '#1a1a1a' }}
      >
        Chapter Three
      </div>
      <div style={{ height: '1px', background: 'rgba(26,26,26,0.25)' }} />
      <p className="mt-2 line-clamp-3" style={{ fontFamily: 'var(--font-source-serif)', fontSize: '8px', lineHeight: 1.8, color: '#2d2d2d' }}>
        <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '28px', fontWeight: 700, lineHeight: 1, float: 'left', marginRight: '4px', color: '#1a1a1a' }}>
          T
        </span>
        he story opens here. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore.
      </p>
    </div>
  )
}

function BoldDisplayPreview() {
  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col p-3" style={{ background: '#0f0f0f' }}>
      <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '32px', fontWeight: 700, lineHeight: 1, color: '#C9A84C' }}>
        03
      </div>
      <div
        className="mt-1"
        style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ffffff' }}
      >
        The System
      </div>
      <p className="mt-2 line-clamp-3" style={{ fontFamily: 'var(--font-inter)', fontSize: '7px', lineHeight: 1.6, color: '#999999' }}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
      </p>
      <div className="mt-auto" style={{ width: '100%', height: '2px', background: '#C9A84C' }} />
    </div>
  )
}

const TYPOGRAPHY_OPTIONS = [
  {
    id: 'standard_clean',
    label: 'Standard Clean',
    description: 'Modern sans-serif, easy to read.',
    preview: <StandardCleanPreview />,
  },
  {
    id: 'executive_serif',
    label: 'Executive Serif',
    description: 'Authoritative, traditional gravitas.',
    preview: <ExecutiveSerifPreview />,
  },
  {
    id: 'editorial_classic',
    label: 'Editorial Classic',
    description: 'Magazine-style elegance, warm cream pages.',
    preview: <EditorialClassicPreview />,
  },
  {
    id: 'bold_display',
    label: 'Bold Display',
    description: 'Dramatic headings, strong presence.',
    preview: <BoldDisplayPreview />,
  },
]

interface Props {
  data: WizardData
  bookId: string
  onBack: () => void
  /** Fires after the setup call succeeds, before the navigation to
   *  coauthor. Used by WizardShell to clear localStorage-persisted
   *  progress so a future wizard run on this book doesn't restore the
   *  now-completed flow. */
  onComplete?: () => void
}

export function Step6Typography({ data, bookId, onBack, onComplete }: Props) {
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
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to save')
      }
      onComplete?.()
      router.push(`/book/${bookId}/coauthor`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Typography</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          This sets the text style used throughout your flipbook.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TYPOGRAPHY_OPTIONS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={`text-left p-3 rounded-xl border transition-all ${
              selected === t.id
                ? 'border-gold bg-gold/10'
                : 'border-cream-3 bg-white hover:border-gold/40'
            }`}
          >
            {/* Landscape page spread preview */}
            <div className={`w-full rounded-lg mb-3 overflow-hidden ring-2 transition-all shadow-sm ${
              selected === t.id ? 'ring-gold' : 'ring-transparent'
            }`} style={{ aspectRatio: '16/10' }}>
              {t.preview}
            </div>
            <p className="font-inter font-medium text-ink-1 text-sm">{t.label}</p>
            <p className="text-ink-1/60 text-xs font-source-serif mt-0.5">{t.description}</p>
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors">Back</button>
        <button
          onClick={handleSave}
          disabled={saving || !selected}
          className="flex items-center gap-2 px-6 py-2.5 bg-gold hover:bg-gold/90 text-ink-1 font-inter text-sm font-semibold rounded-md transition-colors disabled:opacity-40"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Creating book...' : 'Create Book'}
        </button>
      </div>
    </div>
  )
}
