'use client'

import { useState } from 'react'
import type { WizardData } from './WizardShell'

// ── Mini cover previews using exact theme colors from bookTheme.ts ────────────

function BoldOperatorCover() {
  return (
    <svg viewBox="0 0 160 213" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="160" height="213" fill="#111111"/>
      {/* Gold band */}
      <rect x="0" y="148" width="160" height="6" fill="#C9A84C"/>
      {/* Title block */}
      <rect x="16" y="60" width="90" height="10" fill="#F5F0E8" rx="1"/>
      <rect x="16" y="76" width="110" height="10" fill="#F5F0E8" rx="1"/>
      <rect x="16" y="92" width="70" height="10" fill="#F5F0E8" rx="1"/>
      {/* Gold rule above title */}
      <rect x="16" y="50" width="40" height="3" fill="#C9A84C"/>
      {/* Subtitle */}
      <rect x="16" y="162" width="80" height="5" fill="#C9A84C" rx="1" opacity="0.9"/>
      <rect x="16" y="172" width="100" height="4" fill="#F5F0E8" rx="1" opacity="0.5"/>
      <rect x="16" y="180" width="90" height="4" fill="#F5F0E8" rx="1" opacity="0.5"/>
      {/* Author */}
      <rect x="16" y="196" width="60" height="4" fill="#F5F0E8" rx="1" opacity="0.4"/>
      {/* Decorative bottom border */}
      <rect x="0" y="209" width="160" height="4" fill="#C9A84C" opacity="0.5"/>
      {/* Abstract shape */}
      <polygon points="100,20 145,20 145,130 100,100" fill="#C9A84C" opacity="0.08"/>
      <polygon points="110,20 145,20 145,80" fill="#C9A84C" opacity="0.12"/>
    </svg>
  )
}

function CleanCorporateCover() {
  return (
    <svg viewBox="0 0 160 213" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="160" height="213" fill="#0A1628"/>
      {/* Blue top bar */}
      <rect x="0" y="0" width="160" height="5" fill="#2B5BA8"/>
      {/* Clean layout: large white area */}
      <rect x="12" y="22" width="136" height="90" fill="#E8F0FF" opacity="0.07" rx="2"/>
      {/* Title lines */}
      <rect x="20" y="34" width="100" height="9" fill="#E8F0FF" rx="1"/>
      <rect x="20" y="48" width="80" height="9" fill="#E8F0FF" rx="1"/>
      {/* Blue accent line */}
      <rect x="20" y="64" width="50" height="3" fill="#2B5BA8" rx="1"/>
      {/* Subtitle */}
      <rect x="20" y="74" width="95" height="5" fill="#E8F0FF" rx="1" opacity="0.6"/>
      <rect x="20" y="84" width="85" height="5" fill="#E8F0FF" rx="1" opacity="0.6"/>
      {/* Divider */}
      <rect x="12" y="124" width="136" height="1" fill="#2B5BA8" opacity="0.4"/>
      {/* Grid dots */}
      {[0,1,2,3,4].map(col => [0,1,2,3].map(row => (
        <circle key={`${col}-${row}`} cx={20 + col * 28} cy={138 + row * 18} r="1.5" fill="#2B5BA8" opacity="0.35"/>
      )))}
      {/* Author */}
      <rect x="20" y="198" width="70" height="4" fill="#E8F0FF" rx="1" opacity="0.4"/>
      {/* Bottom bar */}
      <rect x="0" y="208" width="160" height="5" fill="#2B5BA8"/>
    </svg>
  )
}

function EditorialModernCover() {
  return (
    <svg viewBox="0 0 160 213" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="160" height="213" fill="#1A0808"/>
      {/* Red left stripe */}
      <rect x="0" y="0" width="8" height="213" fill="#C94C4C"/>
      {/* Headline — large editorial style */}
      <rect x="20" y="30" width="120" height="14" fill="#FFF0F0" rx="1"/>
      <rect x="20" y="50" width="100" height="14" fill="#FFF0F0" rx="1"/>
      <rect x="20" y="70" width="130" height="14" fill="#FFF0F0" rx="1"/>
      {/* Red rule */}
      <rect x="20" y="92" width="120" height="3" fill="#C94C4C"/>
      {/* Body text lines */}
      <rect x="20" y="102" width="120" height="5" fill="#FFF0F0" rx="1" opacity="0.55"/>
      <rect x="20" y="112" width="110" height="5" fill="#FFF0F0" rx="1" opacity="0.55"/>
      <rect x="20" y="122" width="115" height="5" fill="#FFF0F0" rx="1" opacity="0.55"/>
      <rect x="20" y="132" width="90" height="5" fill="#FFF0F0" rx="1" opacity="0.55"/>
      {/* Divider */}
      <rect x="20" y="148" width="120" height="1" fill="#C94C4C" opacity="0.35"/>
      {/* Pull quote */}
      <rect x="20" y="158" width="6" height="30" fill="#C94C4C" opacity="0.7"/>
      <rect x="32" y="160" width="100" height="5" fill="#FFF0F0" rx="1" opacity="0.4"/>
      <rect x="32" y="170" width="90" height="5" fill="#FFF0F0" rx="1" opacity="0.4"/>
      <rect x="32" y="180" width="80" height="5" fill="#FFF0F0" rx="1" opacity="0.4"/>
      {/* Author */}
      <rect x="20" y="200" width="75" height="4" fill="#C94C4C" rx="1" opacity="0.8"/>
    </svg>
  )
}

function CinematicAbstractCover() {
  return (
    <svg viewBox="0 0 160 213" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <radialGradient id="cin-cover-glow" cx="60%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#6B4C9A" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#0D0918" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="cin-cover-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0D0918"/>
          <stop offset="100%" stopColor="#1a1030"/>
        </linearGradient>
      </defs>
      <rect width="160" height="213" fill="url(#cin-cover-fade)"/>
      <rect width="160" height="213" fill="url(#cin-cover-glow)"/>
      {/* Abstract circles */}
      <circle cx="120" cy="55" r="50" fill="none" stroke="#8B6BB5" strokeWidth="0.75" opacity="0.3"/>
      <circle cx="120" cy="55" r="35" fill="none" stroke="#8B6BB5" strokeWidth="0.75" opacity="0.25"/>
      <circle cx="120" cy="55" r="20" fill="#6B4C9A" opacity="0.2"/>
      {/* Horizontal lines — cinematic feel */}
      <rect x="0" y="0" width="160" height="14" fill="#000" opacity="0.7"/>
      <rect x="0" y="199" width="160" height="14" fill="#000" opacity="0.7"/>
      {/* Title */}
      <rect x="16" y="90" width="100" height="10" fill="#F0EEFF" rx="1"/>
      <rect x="16" y="106" width="120" height="10" fill="#F0EEFF" rx="1"/>
      <rect x="16" y="122" width="80" height="10" fill="#F0EEFF" rx="1"/>
      {/* Purple accent rule */}
      <rect x="16" y="140" width="50" height="2" fill="#8B6BB5"/>
      {/* Subtitle */}
      <rect x="16" y="150" width="110" height="5" fill="#F0EEFF" rx="1" opacity="0.45"/>
      <rect x="16" y="160" width="90" height="5" fill="#F0EEFF" rx="1" opacity="0.45"/>
      {/* Author */}
      <rect x="16" y="185" width="65" height="4" fill="#8B6BB5" rx="1" opacity="0.7"/>
    </svg>
  )
}

function RetroIllustratedCover() {
  return (
    <svg viewBox="0 0 160 213" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="160" height="213" fill="#1A0D05"/>
      {/* Outer ornamental border */}
      <rect x="8" y="8" width="144" height="197" fill="none" stroke="#D4762E" strokeWidth="1.5" opacity="0.6"/>
      <rect x="12" y="12" width="136" height="189" fill="none" stroke="#D4762E" strokeWidth="0.5" opacity="0.3"/>
      {/* Corner ornaments */}
      <path d="M8,8 L22,8 M8,8 L8,22" fill="none" stroke="#D4762E" strokeWidth="2"/>
      <path d="M152,8 L138,8 M152,8 L152,22" fill="none" stroke="#D4762E" strokeWidth="2"/>
      <path d="M8,205 L22,205 M8,205 L8,191" fill="none" stroke="#D4762E" strokeWidth="2"/>
      <path d="M152,205 L138,205 M152,205 L152,191" fill="none" stroke="#D4762E" strokeWidth="2"/>
      {/* Orange band */}
      <rect x="8" y="55" width="144" height="5" fill="#D4762E" opacity="0.8"/>
      <rect x="8" y="145" width="144" height="5" fill="#D4762E" opacity="0.8"/>
      {/* Title */}
      <rect x="20" y="68" width="90" height="10" fill="#FFF5EC" rx="1"/>
      <rect x="20" y="84" width="110" height="10" fill="#FFF5EC" rx="1"/>
      <rect x="20" y="100" width="75" height="10" fill="#FFF5EC" rx="1"/>
      {/* Decorative divider */}
      <path d="M55,120 Q80,115 105,120" fill="none" stroke="#D4762E" strokeWidth="1" opacity="0.7"/>
      <circle cx="80" cy="119" r="3" fill="#D4762E" opacity="0.7"/>
      {/* Author */}
      <rect x="20" y="157" width="80" height="6" fill="#D4762E" rx="1" opacity="0.9"/>
      {/* Subtitle lines */}
      <rect x="20" y="170" width="110" height="4" fill="#FFF5EC" rx="1" opacity="0.45"/>
      <rect x="20" y="179" width="100" height="4" fill="#FFF5EC" rx="1" opacity="0.45"/>
      <rect x="20" y="188" width="85" height="4" fill="#FFF5EC" rx="1" opacity="0.45"/>
    </svg>
  )
}

function StudioProductCover() {
  return (
    <svg viewBox="0 0 160 213" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="sp-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0D1A12"/>
          <stop offset="100%" stopColor="#142a1c"/>
        </linearGradient>
      </defs>
      <rect width="160" height="213" fill="url(#sp-grad)"/>
      {/* Green top accent bar */}
      <rect x="0" y="0" width="160" height="4" fill="#4A7C59"/>
      {/* Large circular motif */}
      <circle cx="80" cy="75" r="48" fill="none" stroke="#4A7C59" strokeWidth="1" opacity="0.3"/>
      <circle cx="80" cy="75" r="38" fill="none" stroke="#4A7C59" strokeWidth="0.5" opacity="0.2"/>
      <circle cx="80" cy="75" r="28" fill="#4A7C59" opacity="0.12"/>
      {/* Cross lines through circle */}
      <line x1="80" y1="27" x2="80" y2="123" stroke="#4A7C59" strokeWidth="0.5" opacity="0.2"/>
      <line x1="32" y1="75" x2="128" y2="75" stroke="#4A7C59" strokeWidth="0.5" opacity="0.2"/>
      {/* Title */}
      <rect x="16" y="136" width="95" height="9" fill="#EEF5F0" rx="1"/>
      <rect x="16" y="151" width="115" height="9" fill="#EEF5F0" rx="1"/>
      {/* Green rule */}
      <rect x="16" y="167" width="45" height="2.5" fill="#4A7C59" rx="1"/>
      {/* Subtitle */}
      <rect x="16" y="176" width="105" height="4" fill="#EEF5F0" rx="1" opacity="0.5"/>
      <rect x="16" y="185" width="90" height="4" fill="#EEF5F0" rx="1" opacity="0.5"/>
      {/* Author */}
      <rect x="16" y="199" width="65" height="4" fill="#4A7C59" rx="1" opacity="0.8"/>
      {/* Bottom bar */}
      <rect x="0" y="209" width="160" height="4" fill="#4A7C59"/>
    </svg>
  )
}

const COVER_DIRECTIONS = [
  {
    id: 'bold_operator',
    label: 'Bold Operator',
    description: 'High contrast, strong typography, commands attention.',
    preview: <BoldOperatorCover />,
  },
  {
    id: 'clean_corporate',
    label: 'Clean Corporate',
    description: 'Minimal, trusted, professional.',
    preview: <CleanCorporateCover />,
  },
  {
    id: 'editorial_modern',
    label: 'Editorial Modern',
    description: 'Magazine-quality layout, refined spacing.',
    preview: <EditorialModernCover />,
  },
  {
    id: 'cinematic_abstract',
    label: 'Cinematic Abstract',
    description: 'Moody, atmospheric, striking.',
    preview: <CinematicAbstractCover />,
  },
  {
    id: 'retro_illustrated',
    label: 'Retro Illustrated',
    description: 'Vintage character, hand-crafted warmth.',
    preview: <RetroIllustratedCover />,
  },
  {
    id: 'studio_product',
    label: 'Studio Product',
    description: 'Clean studio aesthetic, premium feel.',
    preview: <StudioProductCover />,
  },
]

interface Props {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

export function Step5Cover({ data, onNext, onBack }: Props) {
  const [selected, setSelected] = useState(data.coverDirection)
  const [error, setError] = useState('')

  function handleNext() {
    if (!selected) { setError('Choose a cover direction.'); return }
    onNext({ coverDirection: selected })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Cover Direction</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          This guides the AI when generating your book cover.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {COVER_DIRECTIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`text-left p-3 rounded-xl border transition-all ${
              selected === c.id
                ? 'border-gold bg-gold/10'
                : 'border-cream-3 bg-white hover:border-gold/40'
            }`}
          >
            {/* Book cover preview — portrait aspect ratio */}
            <div className={`w-full rounded-lg mb-3 overflow-hidden ring-2 transition-all ${
              selected === c.id ? 'ring-gold' : 'ring-transparent'
            }`} style={{ aspectRatio: '3/4' }}>
              {c.preview}
            </div>
            <p className={`font-inter font-medium text-sm mb-0.5 ${selected === c.id ? 'text-gold' : 'text-ink-1'}`}>
              {c.label}
            </p>
            <p className="text-ink-1/60 text-xs font-source-serif">{c.description}</p>
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors">Back</button>
        <button onClick={handleNext} className="px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm font-medium rounded-md transition-colors">Continue</button>
      </div>
    </div>
  )
}
