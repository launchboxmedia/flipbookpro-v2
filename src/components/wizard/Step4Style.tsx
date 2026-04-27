'use client'

import { useEffect, useState } from 'react'
import type { WizardData } from './WizardShell'
import { PALETTES, type PaletteId } from '@/lib/palettes'

const STYLES = [
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
    <svg viewBox="0 0 480 270" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <filter id="wc-blur"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="wc-blur2"><feGaussianBlur stdDeviation="12"/></filter>
      </defs>
      <rect width="480" height="270" fill="#e8f4f0"/>
      <ellipse cx="160" cy="100" rx="140" ry="100" fill="#a8d5c2" opacity="0.6" filter="url(#wc-blur)"/>
      <ellipse cx="330" cy="160" rx="120" ry="90" fill="#f4b8a0" opacity="0.5" filter="url(#wc-blur)"/>
      <ellipse cx="240" cy="180" rx="160" ry="70" fill="#b8d4f0" opacity="0.5" filter="url(#wc-blur2)"/>
      <ellipse cx="100" cy="200" rx="80" ry="60" fill="#d4c8f0" opacity="0.4" filter="url(#wc-blur)"/>
      <ellipse cx="400" cy="80" rx="90" ry="70" fill="#f0e0a8" opacity="0.5" filter="url(#wc-blur)"/>
      <ellipse cx="240" cy="120" rx="100" ry="80" fill="#c8e8d8" opacity="0.4" filter="url(#wc-blur2)"/>
    </svg>
  )
}

function PhotorealisticPreview() {
  return (
    <svg viewBox="0 0 480 270" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="ph-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#87CEEB"/>
          <stop offset="60%" stopColor="#d4eaf7"/>
          <stop offset="100%" stopColor="#8B7355"/>
        </linearGradient>
        <linearGradient id="ph-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6B8E5A"/>
          <stop offset="100%" stopColor="#4a6b3a"/>
        </linearGradient>
      </defs>
      <rect width="480" height="270" fill="url(#ph-sky)"/>
      <rect y="185" width="480" height="85" fill="url(#ph-ground)"/>
      <circle cx="360" cy="55" r="38" fill="#FFF5C0" opacity="0.95"/>
      <rect x="0" y="185" width="480" height="4" fill="#5a7a4a" opacity="0.6"/>
      <rect x="80" y="100" width="60" height="85" fill="#c8a87a" opacity="0.9"/>
      <rect x="75" y="90" width="70" height="14" fill="#8B6543"/>
      <rect x="250" y="120" width="45" height="65" fill="#c8a87a" opacity="0.9"/>
      <rect x="245" y="110" width="55" height="13" fill="#8B6543"/>
      <rect x="150" y="150" width="80" height="35" fill="#7a9a6a" opacity="0.7"/>
    </svg>
  )
}

function CinematicPreview() {
  return (
    <svg viewBox="0 0 480 270" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="cin-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0a0a1a"/>
          <stop offset="50%" stopColor="#1a1025"/>
          <stop offset="100%" stopColor="#0d0810"/>
        </linearGradient>
        <linearGradient id="cin-light" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#d4a840" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#d4a840" stopOpacity="0"/>
        </linearGradient>
        <filter id="cin-glow"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="480" height="270" fill="url(#cin-bg)"/>
      <rect width="480" height="30" fill="black" opacity="0.9"/>
      <rect y="240" width="480" height="30" fill="black" opacity="0.9"/>
      <ellipse cx="240" cy="80" rx="40" ry="60" fill="url(#cin-light)" opacity="0.6"/>
      <rect x="120" y="120" width="4" height="100" fill="#c8962a" opacity="0.4"/>
      <rect x="200" y="80" width="3" height="140" fill="#c8962a" opacity="0.3"/>
      <rect x="280" y="90" width="3" height="130" fill="#d4a840" opacity="0.25"/>
      <ellipse cx="180" cy="210" rx="60" ry="8" fill="#1a0f00" opacity="0.8"/>
      <rect x="155" y="130" width="50" height="80" fill="#1a1010" opacity="0.9"/>
      <rect x="162" y="138" width="36" height="50" fill="#2a1f0f" opacity="0.8"/>
      <circle cx="182" cy="118" r="22" fill="#c8a880" opacity="0.7"/>
    </svg>
  )
}

function IllustratedPreview() {
  return (
    <svg viewBox="0 0 480 270" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <filter id="il-paper">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise"/>
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
          <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blended"/>
        </filter>
      </defs>
      <rect width="480" height="270" fill="#f2e8d5"/>
      <rect width="480" height="270" fill="#e8dcc8" opacity="0.3" filter="url(#il-paper)"/>
      <path d="M80 200 Q120 140 160 160 Q200 180 240 120 Q280 60 320 100 Q360 140 400 80" fill="none" stroke="#2a1a0a" strokeWidth="2.5" opacity="0.8"/>
      <circle cx="160" cy="160" r="6" fill="#2a1a0a" opacity="0.7"/>
      <circle cx="240" cy="120" r="6" fill="#2a1a0a" opacity="0.7"/>
      <circle cx="320" cy="100" r="6" fill="#2a1a0a" opacity="0.7"/>
      <path d="M200 220 L200 160 M190 175 L200 160 L210 175" fill="none" stroke="#3a2a1a" strokeWidth="2" opacity="0.7"/>
      <path d="M220 220 L220 155 M210 170 L220 155 L230 170" fill="none" stroke="#3a2a1a" strokeWidth="2" opacity="0.7"/>
      <path d="M180 220 L180 165 M170 180 L180 165 L190 180" fill="none" stroke="#3a2a1a" strokeWidth="2" opacity="0.7"/>
      <rect x="60" y="55" width="140" height="90" fill="none" stroke="#3a2a1a" strokeWidth="1.5" opacity="0.5"/>
      <line x1="60" y1="70" x2="200" y2="70" stroke="#3a2a1a" strokeWidth="1" opacity="0.3"/>
      <line x1="60" y1="85" x2="200" y2="85" stroke="#3a2a1a" strokeWidth="1" opacity="0.3"/>
      <line x1="60" y1="100" x2="180" y2="100" stroke="#3a2a1a" strokeWidth="1" opacity="0.3"/>
      <line x1="60" y1="115" x2="190" y2="115" stroke="#3a2a1a" strokeWidth="1" opacity="0.3"/>
      <line x1="60" y1="130" x2="170" y2="130" stroke="#3a2a1a" strokeWidth="1" opacity="0.3"/>
      <path d="M270 60 Q310 40 350 60 L360 180 Q310 200 270 180 Z" fill="#d4c8b0" stroke="#3a2a1a" strokeWidth="1.5" opacity="0.7"/>
      <path d="M310 60 L310 180" fill="none" stroke="#3a2a1a" strokeWidth="1" opacity="0.4"/>
    </svg>
  )
}

function MinimalistPreview() {
  return (
    <svg viewBox="0 0 480 270" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="480" height="270" fill="#f8f8f6"/>
      <rect x="0" y="0" width="4" height="270" fill="#1a1a1a"/>
      <circle cx="240" cy="135" r="72" fill="none" stroke="#1a1a1a" strokeWidth="1.5"/>
      <circle cx="240" cy="135" r="48" fill="#1a1a1a"/>
      <circle cx="240" cy="135" r="24" fill="#f8f8f6"/>
      <line x1="60" y1="50" x2="420" y2="50" stroke="#1a1a1a" strokeWidth="1"/>
      <line x1="60" y1="220" x2="420" y2="220" stroke="#1a1a1a" strokeWidth="1"/>
      <rect x="60" y="55" width="80" height="4" fill="#1a1a1a"/>
      <rect x="60" y="63" width="50" height="4" fill="#cccccc"/>
      <rect x="340" y="55" width="80" height="4" fill="#1a1a1a"/>
      <rect x="355" y="63" width="50" height="4" fill="#cccccc"/>
    </svg>
  )
}

function VintagePreview() {
  return (
    <svg viewBox="0 0 480 270" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <filter id="vt-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
          <feBlend in="SourceGraphic" mode="multiply"/>
        </filter>
        <linearGradient id="vt-vignette" cx="50%" cy="50%" r="60%" fx="50%" fy="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="transparent"/>
          <stop offset="100%" stopColor="#2a1800" stopOpacity="0.6"/>
        </linearGradient>
      </defs>
      <rect width="480" height="270" fill="#c8a870"/>
      <rect width="480" height="270" fill="#d4b880" opacity="0.5"/>
      <rect x="30" y="20" width="420" height="230" fill="none" stroke="#6b4520" strokeWidth="3" opacity="0.6"/>
      <rect x="38" y="28" width="404" height="214" fill="none" stroke="#6b4520" strokeWidth="1" opacity="0.4"/>
      <ellipse cx="240" cy="135" rx="80" ry="100" fill="none" stroke="#4a2e10" strokeWidth="1.5" opacity="0.5"/>
      <path d="M160 80 Q240 40 320 80 Q360 120 320 190 Q240 230 160 190 Q120 150 160 80 Z" fill="none" stroke="#4a2e10" strokeWidth="1" opacity="0.4"/>
      <line x1="60" y1="90" x2="420" y2="90" stroke="#4a2e10" strokeWidth="0.75" opacity="0.3"/>
      <line x1="60" y1="105" x2="420" y2="105" stroke="#4a2e10" strokeWidth="0.75" opacity="0.3"/>
      <line x1="60" y1="120" x2="420" y2="120" stroke="#4a2e10" strokeWidth="0.75" opacity="0.3"/>
      <line x1="60" y1="150" x2="420" y2="150" stroke="#4a2e10" strokeWidth="0.75" opacity="0.3"/>
      <line x1="60" y1="165" x2="420" y2="165" stroke="#4a2e10" strokeWidth="0.75" opacity="0.3"/>
      <line x1="60" y1="180" x2="420" y2="180" stroke="#4a2e10" strokeWidth="0.75" opacity="0.3"/>
      <rect width="480" height="270" fill="url(#vt-vignette)"/>
      <rect width="480" height="270" opacity="0.15" filter="url(#vt-grain)"/>
    </svg>
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
    let cancelled = false
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!cancelled && p) {
          setBrandColors({
            primary: p.brand_color ?? null,
            accent: p.accent_color ?? null,
          })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  function handleNext() {
    if (!selected) { setError('Choose a visual style.'); return }
    onNext({ visualStyle: selected, palette: palette || 'teal-cream' })
  }

  const brandReady = !!brandColors.primary

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-playfair text-2xl text-cream mb-1">Visual Style</h2>
        <p className="text-muted-foreground text-sm font-source-serif">
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
                ? 'border-accent bg-accent/10'
                : 'border-[#333] bg-[#1A1A1A] hover:border-[#444]'
            }`}
          >
            <div className={`w-full aspect-video rounded-lg mb-3 overflow-hidden ring-2 transition-all ${
              selected === s.id ? 'ring-accent' : 'ring-transparent'
            }`}>
              {s.preview}
            </div>
            <p className="font-inter font-medium text-cream text-sm">{s.label}</p>
            <p className="text-muted-foreground text-xs font-source-serif mt-0.5">{s.description}</p>
          </button>
        ))}
      </div>

      <div className="space-y-4 pt-2 border-t border-[#2A2A2A]">
        <div>
          <h3 className="font-playfair text-xl text-cream mb-1">Color Palette</h3>
          <p className="text-muted-foreground text-sm font-source-serif">
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
                  ? 'border-accent bg-accent/10'
                  : 'border-[#333] bg-[#1A1A1A] hover:border-[#444]'
              }`}
            >
              <div
                className={`w-full h-12 rounded-lg mb-3 overflow-hidden ring-2 transition-all flex ${
                  palette === p.id ? 'ring-accent' : 'ring-transparent'
                }`}
              >
                <div className="flex-1" style={{ backgroundColor: p.primary }} />
                <div className="flex-1" style={{ backgroundColor: p.secondary }} />
                <div className="flex-1" style={{ backgroundColor: p.background }} />
              </div>
              <p className="font-inter font-medium text-cream text-sm">{p.name}</p>
              <p className="text-muted-foreground text-xs font-source-serif mt-0.5">{p.descriptor}</p>
            </button>
          ))}

          <button
            onClick={() => brandReady && setPalette('brand')}
            disabled={!brandReady}
            className={`text-left p-4 rounded-xl border transition-all col-span-2 ${
              palette === 'brand'
                ? 'border-accent bg-accent/10'
                : brandReady
                ? 'border-[#333] bg-[#1A1A1A] hover:border-[#444]'
                : 'border-[#2A2A2A] bg-[#161616] opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-12 w-24 rounded-lg overflow-hidden ring-2 transition-all flex ${
                  palette === 'brand' ? 'ring-accent' : 'ring-transparent'
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
                <p className="font-inter font-medium text-cream text-sm">Use my brand colors</p>
                <p className="text-muted-foreground text-xs font-source-serif mt-0.5">
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
        <button onClick={onBack} className="px-4 py-2.5 text-muted-foreground hover:text-cream font-inter text-sm transition-colors">Back</button>
        <button onClick={handleNext} className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors">Continue</button>
      </div>
    </div>
  )
}
