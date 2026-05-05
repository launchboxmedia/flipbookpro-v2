'use client'

import { useEffect, useState } from 'react'
import type { WizardData } from './WizardShell'
import { PALETTES, type PaletteId } from '@/lib/palettes'
import { STYLES } from './Step4Style'
import { COVER_DIRECTIONS } from './Step5Cover'

interface Props {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

/** Combined Step 5 — Visual Style + Palette + Cover Direction.
 *
 *  Reuses the option data + SVG previews from the original Step4Style
 *  and Step5Cover files so we don't duplicate ~600 lines of inline SVG.
 *  Single Continue advances past all three selections at once. */
export function Step5StyleCover({ data, onNext, onBack }: Props) {
  const [visualStyle, setVisualStyle] = useState(data.visualStyle)
  const [palette, setPalette]         = useState<PaletteId | ''>((data.palette as PaletteId) || '')
  const [coverDirection, setCoverDirection] = useState(data.coverDirection)
  const [brandColors, setBrandColors] = useState<{ primary: string | null; accent: string | null }>({
    primary: null, accent: null,
  })
  const [error, setError] = useState('')

  // Brand colors are pulled from the user's profile so the "Use my brand
  // colors" palette tile can preview them. Same call site as the legacy
  // Step4Style — kept here so the combined step works standalone.
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/profile', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p) {
          setBrandColors({
            primary: p.brand_color ?? null,
            accent:  p.accent_color ?? null,
          })
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        console.error('[Step5StyleCover] profile fetch failed', e)
      })
    return () => controller.abort()
  }, [])

  const brandReady = !!brandColors.primary

  function handleNext() {
    if (!visualStyle)    { setError('Choose a visual style.');    return }
    if (!coverDirection) { setError('Choose a cover direction.'); return }
    setError('')
    onNext({
      visualStyle,
      palette: (palette || 'teal-cream') as string,
      coverDirection,
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Look &amp; Feel</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          Pick your illustration style, palette, and cover direction.
        </p>
      </div>

      {/* ── Visual Style ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h3 className="font-playfair text-lg text-ink-1">Visual Style</h3>
          <p className="text-ink-1/60 text-xs font-source-serif">
            Every chapter gets one illustration in this style.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setVisualStyle(s.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                visualStyle === s.id
                  ? 'border-gold bg-gold/10'
                  : 'border-cream-3 bg-white hover:border-gold/40'
              }`}
            >
              <div className={`w-full aspect-video rounded-lg mb-3 overflow-hidden ring-2 transition-all ${
                visualStyle === s.id ? 'ring-gold' : 'ring-transparent'
              }`}>
                {s.preview}
              </div>
              <p className="font-inter font-medium text-ink-1 text-sm">{s.label}</p>
              <p className="text-ink-1/60 text-xs font-source-serif mt-0.5">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Palette ────────────────────────────────────────────────────── */}
      <div className="space-y-3 border-t border-cream-3 pt-6">
        <div>
          <h3 className="font-playfair text-lg text-ink-1">Color Palette</h3>
          <p className="text-ink-1/60 text-xs font-source-serif">
            Anchors every chapter and cover image to a cohesive set of colors.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPalette(p.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                palette === p.id
                  ? 'border-gold bg-gold/10'
                  : 'border-cream-3 bg-white hover:border-gold/40'
              }`}
            >
              <div
                className={`w-full h-12 rounded-lg mb-3 overflow-hidden ring-2 transition-all flex ${
                  palette === p.id ? 'ring-gold' : 'ring-transparent'
                }`}
              >
                <div className="flex-1" style={{ backgroundColor: p.primary }} />
                <div className="flex-1" style={{ backgroundColor: p.secondary }} />
                <div className="flex-1" style={{ backgroundColor: p.background }} />
              </div>
              <p className="font-inter font-medium text-ink-1 text-sm">{p.name}</p>
              <p className="text-ink-1/60 text-xs font-source-serif mt-0.5">{p.descriptor}</p>
            </button>
          ))}

          <button
            type="button"
            onClick={() => brandReady && setPalette('brand')}
            disabled={!brandReady}
            className={`text-left p-4 rounded-xl border transition-all col-span-2 ${
              palette === 'brand'
                ? 'border-gold bg-gold/10'
                : brandReady
                  ? 'border-cream-3 bg-white hover:border-gold/40'
                  : 'border-cream-3 bg-cream-2 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-12 w-24 rounded-lg overflow-hidden ring-2 transition-all flex ${
                  palette === 'brand' ? 'ring-gold' : 'ring-transparent'
                }`}
              >
                <div className="flex-1" style={{ backgroundColor: brandColors.primary ?? '#444' }} />
                <div className="flex-1" style={{ backgroundColor: brandColors.accent  ?? '#666' }} />
              </div>
              <div className="flex-1">
                <p className="font-inter font-medium text-ink-1 text-sm">Use my brand colors</p>
                <p className="text-ink-1/60 text-xs font-source-serif mt-0.5">
                  {brandReady
                    ? 'Pulls from your brand profile (primary + accent).'
                    : 'Set a brand color in your brand profile to enable this.'}
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ── Cover Direction ────────────────────────────────────────────── */}
      <div className="space-y-3 border-t border-cream-3 pt-6">
        <div>
          <h3 className="font-playfair text-lg text-ink-1">Cover Direction</h3>
          <p className="text-ink-1/60 text-xs font-source-serif">
            Guides the AI when generating your book cover.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {COVER_DIRECTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCoverDirection(c.id)}
              className={`text-left p-3 rounded-xl border transition-all ${
                coverDirection === c.id
                  ? 'border-gold bg-gold/10'
                  : 'border-cream-3 bg-white hover:border-gold/40'
              }`}
            >
              <div
                className={`w-full rounded-lg mb-3 overflow-hidden ring-2 transition-all ${
                  coverDirection === c.id ? 'ring-gold' : 'ring-transparent'
                }`}
                style={{ aspectRatio: '3/4' }}
              >
                {c.preview}
              </div>
              <p className={`font-inter font-medium text-sm mb-0.5 ${coverDirection === c.id ? 'text-gold' : 'text-ink-1'}`}>
                {c.label}
              </p>
              <p className="text-ink-1/60 text-xs font-source-serif">{c.description}</p>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm rounded-md transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
