'use client'

import { useEffect, useState } from 'react'
import type { WizardData } from './WizardShell'
import { PALETTES, type PaletteId } from '@/lib/palettes'

export const STYLES = [
  {
    id: 'watercolor',
    label: 'Watercolor',
    description: 'Soft washes, organic edges, painterly warmth.',
    preview: <WatercolorPreview />,
  },
  {
    id: 'photorealistic',
    label: 'Photorealistic',
    description: 'High-detail photography-style, crisp and lifelike.',
    preview: <PhotorealisticPreview />,
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Dramatic lighting, film grain, wide-format mood.',
    preview: <CinematicPreview />,
  },
  {
    id: 'illustrated',
    label: 'Editorial Illustrated',
    description: 'Ink and wash, textured paper, professional book art.',
    preview: <IllustratedPreview />,
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    description: 'Clean lines, limited palette, geometric and bold.',
    preview: <MinimalistPreview />,
  },
  {
    id: 'vintage',
    label: 'Vintage',
    description: 'Aged paper, engraving style, sepia-toned classics.',
    preview: <VintagePreview />,
  },
]

function WatercolorPreview() {
  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #e8f4f0 0%, #f0e8f4 50%, #f4f0e8 100%)' }}
    >
      <div className="absolute rounded-full" style={{ top: '6%', left: '8%', width: '48%', height: '62%', background: '#e8b8c8', opacity: 0.55, filter: 'blur(20px)' }} />
      <div className="absolute rounded-full" style={{ top: '18%', left: '40%', width: '52%', height: '58%', background: '#c8bce8', opacity: 0.5, filter: 'blur(20px)' }} />
      <div className="absolute rounded-full" style={{ top: '34%', left: '16%', width: '42%', height: '46%', background: '#bcd8c0', opacity: 0.45, filter: 'blur(20px)' }} />
      <div className="absolute rounded-full" style={{ top: '4%', left: '62%', width: '34%', height: '40%', background: '#f0e0b8', opacity: 0.45, filter: 'blur(20px)' }} />
      <div className="absolute inset-x-0 bottom-0 px-[10%] pb-[9%] space-y-1.5">
        <div className="h-1 rounded-full" style={{ width: '86%', background: 'rgba(120,120,120,0.30)' }} />
        <div className="h-1 rounded-full" style={{ width: '68%', background: 'rgba(120,120,120,0.30)' }} />
        <div className="h-1 rounded-full" style={{ width: '78%', background: 'rgba(120,120,120,0.30)' }} />
      </div>
    </div>
  )
}

function PhotorealisticPreview() {
  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
    >
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 42%, rgba(255,255,255,0.10) 0%, transparent 45%)' }} />
      <div className="absolute" style={{ left: 0, right: 0, top: '66%', height: '1px', background: 'rgba(255,255,255,0.20)' }} />
      <div className="absolute" style={{ left: 0, right: 0, top: '66%', bottom: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.10))' }} />
    </div>
  )
}

function CinematicPreview() {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#0a0a0a' }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1a0a00 0%, #2d1600 100%)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 30% 60%, rgba(255,180,50,0.30) 0%, transparent 55%)' }} />
      <div className="absolute inset-0" style={{ opacity: 0.06, backgroundImage: 'radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)', backgroundSize: '4px 4px' }} />
      <div className="absolute inset-x-0 top-0 h-6 bg-black" />
      <div className="absolute inset-x-0 bottom-0 h-6 bg-black" />
    </div>
  )
}

function IllustratedPreview() {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#faf9f7' }}>
      {/* bold headline block */}
      <div className="absolute" style={{ top: '14%', left: '12%', width: '54%', height: '8%', background: '#0F1623' }} />
      {/* circle — stroke only */}
      <div className="absolute rounded-full" style={{ top: '34%', left: '14%', width: '38%', height: '54%', border: '3px solid rgba(15,22,35,0.8)' }} />
      {/* overlapping rectangle */}
      <div className="absolute" style={{ top: '46%', left: '40%', width: '34%', height: '34%', border: '2px solid rgba(15,22,35,0.7)' }} />
      {/* solid gold geometric accent */}
      <div className="absolute" style={{ top: '30%', right: '12%', width: '13%', height: '13%', background: '#C9A84C' }} />
      {/* precise thin lines */}
      <div className="absolute" style={{ bottom: '15%', left: '40%', width: '46%', height: '1px', background: 'rgba(15,22,35,0.5)' }} />
      <div className="absolute" style={{ bottom: '9%', left: '40%', width: '34%', height: '1px', background: 'rgba(15,22,35,0.4)' }} />
    </div>
  )
}

function MinimalistPreview() {
  return (
    <div
      className="relative w-full h-full overflow-hidden flex items-center justify-center"
      style={{ background: '#ffffff' }}
    >
      <div className="absolute inset-x-0" style={{ top: '50%', height: '1px', background: '#333333' }} />
      <div
        className="relative rounded-full"
        style={{ width: '40%', aspectRatio: '1 / 1', border: '1px solid #333333', background: '#ffffff' }}
      />
    </div>
  )
}

function VintagePreview() {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#f5e6c8' }}>
      <div
        className="absolute inset-0"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(139,105,20,0.06) 0, rgba(139,105,20,0.06) 1px, transparent 1px, transparent 7px)' }}
      />
      <div className="absolute" style={{ inset: '8px', border: '2px solid rgba(139,105,20,0.6)' }} />
      <div className="absolute" style={{ top: '4px', left: '4px', width: '6px', height: '6px', background: 'rgba(139,105,20,0.6)' }} />
      <div className="absolute" style={{ top: '4px', right: '4px', width: '6px', height: '6px', background: 'rgba(139,105,20,0.6)' }} />
      <div className="absolute" style={{ bottom: '4px', left: '4px', width: '6px', height: '6px', background: 'rgba(139,105,20,0.6)' }} />
      <div className="absolute" style={{ bottom: '4px', right: '4px', width: '6px', height: '6px', background: 'rgba(139,105,20,0.6)' }} />
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: '34%', height: '54%', transform: 'translate(-50%, -50%)', border: '1px solid rgba(74,46,16,0.55)', borderRadius: '50%' }}
      />
    </div>
  )
}

interface Props {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

export function Step4Style({ data, onNext, onBack }: Props) {
  const [selected, setSelected] = useState(data.visualStyle)
  const [palette, setPalette] = useState<PaletteId | ''>(
    (data.palette as PaletteId) || '',
  )
  const [brandColors, setBrandColors] = useState<{ primary: string | null; accent: string | null }>({
    primary: null,
    accent: null,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/profile', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p) {
          setBrandColors({
            primary: p.brand_color ?? null,
            accent: p.accent_color ?? null,
          })
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        console.error('[Step4Style] profile fetch failed', e)
      })
    return () => controller.abort()
  }, [])

  function handleNext() {
    if (!selected) { setError('Choose a visual style.'); return }
    onNext({ visualStyle: selected, palette: palette || 'teal-cream' })
  }

  const brandReady = !!brandColors.primary

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Visual Style</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          Every chapter gets one illustration in this style.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            className={`text-left p-4 rounded-xl border transition-all ${
              selected === s.id
                ? 'border-gold bg-gold/10'
                : 'border-cream-3 bg-white hover:border-gold/40'
            }`}
          >
            <div className={`w-full aspect-video rounded-lg mb-3 overflow-hidden ring-2 transition-all ${
              selected === s.id ? 'ring-gold' : 'ring-transparent'
            }`}>
              {s.preview}
            </div>
            <p className="font-inter font-medium text-ink-1 text-sm">{s.label}</p>
            <p className="text-ink-1/60 text-xs font-source-serif mt-0.5">{s.description}</p>
          </button>
        ))}
      </div>

      <div className="space-y-4 pt-2 border-t border-cream-3">
        <div>
          <h3 className="font-playfair text-xl text-ink-1 mb-1">Color Palette</h3>
          <p className="text-ink-1/60 text-sm font-source-serif">
            Anchors every chapter and cover image to a cohesive set of colors.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PALETTES.map((p) => (
            <button
              key={p.id}
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
                <div
                  className="flex-1"
                  style={{ backgroundColor: brandColors.primary ?? '#444' }}
                />
                <div
                  className="flex-1"
                  style={{ backgroundColor: brandColors.accent ?? '#666' }}
                />
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

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors">Back</button>
        <button onClick={handleNext} className="px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm font-medium rounded-md transition-colors">Continue</button>
      </div>
    </div>
  )
}
