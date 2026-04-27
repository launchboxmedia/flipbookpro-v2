'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WizardData } from './WizardShell'
import { Loader2 } from 'lucide-react'

// ── Page spread previews using exact theme values from bookTheme.ts ───────────

function StandardCleanPreview() {
  // page-bg:#FFFFFF, body:Inter (uniform lines), heading:17px, line-height:1.72, drop-cap:3.2em
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Left page */}
      <rect width="158" height="200" fill="#FFFFFF"/>
      {/* Chapter image placeholder */}
      <rect x="12" y="12" width="134" height="76" fill="#F0F0F0" rx="2"/>
      <line x1="12" y1="12" x2="146" y2="88" stroke="#E0E0E0" strokeWidth="0.5"/>
      <line x1="146" y1="12" x2="12" y2="88" stroke="#E0E0E0" strokeWidth="0.5"/>
      {/* Chapter number — accent gold, clean */}
      <rect x="12" y="98" width="20" height="5" fill="#C9A84C" rx="1"/>
      {/* Chapter title — Playfair-style: bold, moderate size */}
      <rect x="12" y="108" width="120" height="8" fill="#1A1A1A" rx="0.5"/>
      <rect x="12" y="120" width="90" height="8" fill="#1A1A1A" rx="0.5"/>
      {/* Rule */}
      <rect x="12" y="134" width="134" height="0.75" fill="#E0E0E0"/>
      {/* Body text — Inter: thin, uniform, tighter lines */}
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x="12" y={140 + i * 9} width={i % 3 === 2 ? 100 : 130} height="4" fill="#1A1A1A" rx="0.5" opacity="0.55"/>
      ))}
      {/* Page number */}
      <rect x="70" y="192" width="18" height="3" fill="#999999" rx="1"/>

      {/* Spine */}
      <rect x="158" y="0" width="4" height="200" fill="#E8E8E8"/>

      {/* Right page */}
      <rect x="162" y="0" width="158" height="200" fill="#FFFFFF"/>
      {/* Drop cap — clean, square, accent */}
      <rect x="174" y="14" width="22" height="28" fill="#C9A84C" rx="1" opacity="0.15"/>
      <rect x="178" y="18" width="14" height="20" fill="#C9A84C" rx="0.5"/>
      {/* Body text — Inter: regular weight, moderate line height */}
      {[0,1,2,3,4].map(i => (
        <rect key={i} x="200" y={14 + i * 9} width={i === 4 ? 85 : 108} height="4" fill="#1A1A1A" rx="0.5" opacity="0.55"/>
      ))}
      {/* Paragraph 2 */}
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x="174" y={62 + i * 9} width={i === 5 ? 70 : 116} height="4" fill="#1A1A1A" rx="0.5" opacity="0.55"/>
      ))}
      {/* Paragraph 3 */}
      {[0,1,2,3,4].map(i => (
        <rect key={i} x="174" y={120 + i * 9} width={i === 4 ? 55 : 116} height="4" fill="#1A1A1A" rx="0.5" opacity="0.55"/>
      ))}
      {/* Paragraph 4 */}
      {[0,1,2].map(i => (
        <rect key={i} x="174" y={168 + i * 9} width={i === 2 ? 80 : 116} height="4" fill="#1A1A1A" rx="0.5" opacity="0.55"/>
      ))}
      {/* Page number */}
      <rect x="232" y="192" width="18" height="3" fill="#999999" rx="1"/>
    </svg>
  )
}

function ExecutiveSerifPreview() {
  // page-bg:#FAFAF7, body:Source Serif 4 (wider spacing), heading:18px, line-height:1.78, drop-cap:3.5em
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Left page */}
      <rect width="158" height="200" fill="#FAFAF7"/>
      {/* Chapter image */}
      <rect x="12" y="12" width="134" height="76" fill="#EFEFE8" rx="2"/>
      <line x1="12" y1="12" x2="146" y2="88" stroke="#E0E0D8" strokeWidth="0.5"/>
      <line x1="146" y1="12" x2="12" y2="88" stroke="#E0E0D8" strokeWidth="0.5"/>
      {/* Chapter number */}
      <rect x="12" y="98" width="22" height="5" fill="#C9A84C" rx="1"/>
      {/* Title — Playfair, slightly larger, more weight */}
      <rect x="12" y="108" width="125" height="9" fill="#1A1A1A" rx="0.5"/>
      <rect x="12" y="121" width="95" height="9" fill="#1A1A1A" rx="0.5"/>
      {/* Thin rule */}
      <rect x="12" y="136" width="134" height="0.75" fill="#D8D8D0"/>
      {/* Body — serif: slightly taller lines, wider spacing (1.78) */}
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x="12" y={142 + i * 9.5} width={i % 3 === 2 ? 105 : 130} height="5" fill="#1A1A1A" rx="0.5" opacity="0.5"/>
      ))}
      <rect x="70" y="192" width="18" height="3" fill="#999990" rx="1"/>

      {/* Spine */}
      <rect x="158" y="0" width="4" height="200" fill="#EEEEE8"/>

      {/* Right page */}
      <rect x="162" y="0" width="158" height="200" fill="#FAFAF7"/>
      {/* Drop cap — taller, serif-weight */}
      <rect x="174" y="12" width="26" height="34" fill="#C9A84C" rx="1" opacity="0.12"/>
      <rect x="177" y="15" width="17" height="26" fill="#C9A84C" rx="0.5"/>
      {/* Body — wider line height, slightly taller rects */}
      {[0,1,2,3,4].map(i => (
        <rect key={i} x="204" y={12 + i * 9.5} width={i === 4 ? 80 : 104} height="5" fill="#1A1A1A" rx="0.5" opacity="0.5"/>
      ))}
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x="174" y={62 + i * 9.5} width={i === 5 ? 65 : 114} height="5" fill="#1A1A1A" rx="0.5" opacity="0.5"/>
      ))}
      {[0,1,2,3,4].map(i => (
        <rect key={i} x="174" y={122 + i * 9.5} width={i === 4 ? 50 : 114} height="5" fill="#1A1A1A" rx="0.5" opacity="0.5"/>
      ))}
      {[0,1,2].map(i => (
        <rect key={i} x="174" y={168 + i * 9.5} width={i === 2 ? 75 : 114} height="5" fill="#1A1A1A" rx="0.5" opacity="0.5"/>
      ))}
      <rect x="232" y="192" width="18" height="3" fill="#999990" rx="1"/>
    </svg>
  )
}

function EditorialClassicPreview() {
  // page-bg:#FAF7F2 (warm cream), body:Source Serif 4, heading:18px, line-height:1.78, drop-cap:3.5em
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Left page */}
      <rect width="158" height="200" fill="#FAF7F2"/>
      {/* Chapter image */}
      <rect x="12" y="12" width="134" height="76" fill="#EDE8E0" rx="2"/>
      <line x1="12" y1="12" x2="146" y2="88" stroke="#D8D0C8" strokeWidth="0.5"/>
      <line x1="146" y1="12" x2="12" y2="88" stroke="#D8D0C8" strokeWidth="0.5"/>
      {/* Chapter number — italic feel, smaller */}
      <rect x="12" y="96" width="16" height="4" fill="#C9A84C" rx="1" opacity="0.8"/>
      {/* Title — classic editorial, with italic-suggesting slant geometry */}
      <rect x="12" y="105" width="128" height="9" fill="#1C1C1C" rx="0.5"/>
      <rect x="12" y="118" width="98" height="9" fill="#1C1C1C" rx="0.5"/>
      {/* Double rule — classic editorial touch */}
      <rect x="12" y="132" width="134" height="1" fill="#C8B898" opacity="0.8"/>
      <rect x="12" y="135" width="134" height="0.5" fill="#C8B898" opacity="0.4"/>
      {/* Body text */}
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x="12" y={141 + i * 9.5} width={i % 4 === 3 ? 90 : 130} height="5" fill="#1C1C1C" rx="0.5" opacity="0.48"/>
      ))}
      <rect x="70" y="192" width="18" height="3" fill="#B0A898" rx="1"/>

      {/* Spine */}
      <rect x="158" y="0" width="4" height="200" fill="#EAE5DC"/>

      {/* Right page */}
      <rect x="162" y="0" width="158" height="200" fill="#FAF7F2"/>
      {/* Ornamental top rule */}
      <rect x="174" y="10" width="134" height="0.75" fill="#C8B898" opacity="0.6"/>
      {/* Drop cap — warm, editorial */}
      <rect x="174" y="18" width="26" height="34" fill="#C9A84C" rx="1" opacity="0.12"/>
      <rect x="177" y="21" width="17" height="26" fill="#C9A84C" rx="0.5"/>
      {/* Body lines */}
      {[0,1,2,3,4].map(i => (
        <rect key={i} x="204" y={18 + i * 9.5} width={i === 4 ? 75 : 102} height="5" fill="#1C1C1C" rx="0.5" opacity="0.48"/>
      ))}
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x="174" y={68 + i * 9.5} width={i === 5 ? 60 : 114} height="5" fill="#1C1C1C" rx="0.5" opacity="0.48"/>
      ))}
      {[0,1,2,3,4].map(i => (
        <rect key={i} x="174" y={128 + i * 9.5} width={i === 4 ? 45 : 114} height="5" fill="#1C1C1C" rx="0.5" opacity="0.48"/>
      ))}
      {/* Bottom ornamental rule */}
      <rect x="174" y="185" width="134" height="0.75" fill="#C8B898" opacity="0.6"/>
      <rect x="232" y="192" width="18" height="3" fill="#B0A898" rx="1"/>
    </svg>
  )
}

function BoldDisplayPreview() {
  // page-bg:#F8F8F8, body:Inter, heading:20px (largest), line-height:1.70, drop-cap:3.8em (biggest)
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Left page */}
      <rect width="158" height="200" fill="#F8F8F8"/>
      {/* Chapter image */}
      <rect x="12" y="12" width="134" height="72" fill="#EBEBEB" rx="2"/>
      <line x1="12" y1="12" x2="146" y2="84" stroke="#D8D8D8" strokeWidth="0.5"/>
      <line x1="146" y1="12" x2="12" y2="84" stroke="#D8D8D8" strokeWidth="0.5"/>
      {/* Bold chapter number — large and prominent */}
      <rect x="12" y="92" width="30" height="10" fill="#C9A84C" rx="1"/>
      {/* Title — very large, bold, dramatic */}
      <rect x="12" y="108" width="132" height="12" fill="#0D0D0D" rx="0.5"/>
      <rect x="12" y="124" width="108" height="12" fill="#0D0D0D" rx="0.5"/>
      {/* Heavy rule */}
      <rect x="12" y="142" width="134" height="2" fill="#0D0D0D" opacity="0.15"/>
      {/* Body — Inter, tight lines (1.70) */}
      {[0,1,2,3].map(i => (
        <rect key={i} x="12" y={150 + i * 9} width={i === 3 ? 85 : 130} height="4" fill="#0D0D0D" rx="0.5" opacity="0.5"/>
      ))}
      <rect x="70" y="192" width="18" height="3" fill="#888888" rx="1"/>

      {/* Spine */}
      <rect x="158" y="0" width="4" height="200" fill="#E8E8E8"/>

      {/* Right page */}
      <rect x="162" y="0" width="158" height="200" fill="#F8F8F8"/>
      {/* Drop cap — very large (3.8em), bold block */}
      <rect x="174" y="12" width="34" height="44" fill="#C9A84C" rx="1" opacity="0.15"/>
      <rect x="177" y="15" width="24" height="36" fill="#C9A84C" rx="0.5"/>
      {/* Body lines alongside drop cap */}
      {[0,1,2,3,4].map(i => (
        <rect key={i} x="214" y={12 + i * 9} width={i === 4 ? 60 : 92} height="4" fill="#0D0D0D" rx="0.5" opacity="0.5"/>
      ))}
      {/* Paragraph — tight line height */}
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={i} x="174" y={60 + i * 9} width={i === 6 ? 55 : 114} height="4" fill="#0D0D0D" rx="0.5" opacity="0.5"/>
      ))}
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x="174" y={126 + i * 9} width={i === 5 ? 70 : 114} height="4" fill="#0D0D0D" rx="0.5" opacity="0.5"/>
      ))}
      {/* Bold inline heading mid-page */}
      <rect x="174" y="180" width="90" height="7" fill="#0D0D0D" rx="0.5" opacity="0.75"/>
      <rect x="232" y="192" width="18" height="3" fill="#888888" rx="1"/>
    </svg>
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
            className={`text-left p-3 rounded-xl border transition-all ${
              selected === t.id
                ? 'border-accent bg-accent/10'
                : 'border-[#333] bg-[#1A1A1A] hover:border-[#444]'
            }`}
          >
            {/* Landscape page spread preview */}
            <div className={`w-full rounded-lg mb-3 overflow-hidden ring-2 transition-all shadow-sm ${
              selected === t.id ? 'ring-accent' : 'ring-transparent'
            }`} style={{ aspectRatio: '16/10' }}>
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
