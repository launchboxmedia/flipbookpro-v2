'use client'

import { useState } from 'react'
import { Loader2, ShoppingBag, Link2, FileText } from 'lucide-react'
import type { Book } from '@/types/database'

interface Props {
  book: Book
  onComplete: () => void
}

type BackMatterType = 'upsell' | 'affiliate' | 'custom'

const TYPES = [
  { id: 'upsell' as BackMatterType, label: 'Upsell Page', icon: ShoppingBag, description: 'Promote a product, course, or service.' },
  { id: 'affiliate' as BackMatterType, label: 'Affiliate Page', icon: Link2, description: 'Share recommended resources with links.' },
  { id: 'custom' as BackMatterType, label: 'Custom Page', icon: FileText, description: 'Write any content — bio, CTA, credits.' },
]

export function BackMatterStage({ book, onComplete }: Props) {
  const [activeType, setActiveType] = useState<BackMatterType | null>(null)
  const [contents, setContents] = useState<Record<string, string>>({})
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<BackMatterType | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())

  async function save(type: BackMatterType) {
    if (!contents[type]?.trim()) return
    setSaving(type)
    try {
      await fetch(`/api/books/${book.id}/back-matter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: titles[type] || TYPES.find((t) => t.id === type)?.label,
          content: contents[type],
        }),
      })
      setSaved((prev) => new Set(Array.from(prev).concat(type)))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h2 className="font-playfair text-3xl text-cream">Back Matter</h2>
        <p className="text-muted-foreground text-sm font-source-serif mt-1">
          Add optional pages at the end of your flipbook. All are optional — skip any you don't need.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {TYPES.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setActiveType(activeType === t.id ? null : t.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                activeType === t.id
                  ? 'border-accent bg-accent/10'
                  : saved.has(t.id)
                  ? 'border-accent/40 bg-accent/5'
                  : 'border-[#333] bg-[#222] hover:border-[#444]'
              }`}
            >
              <Icon className={`w-5 h-5 mb-2 ${activeType === t.id ? 'text-accent' : 'text-muted-foreground'}`} />
              <p className="text-sm font-inter font-medium text-cream">{t.label}</p>
              <p className="text-xs font-source-serif text-muted-foreground mt-0.5">{t.description}</p>
              {saved.has(t.id) && (
                <p className="text-xs font-inter text-accent mt-2">Saved</p>
              )}
            </button>
          )
        })}
      </div>

      {activeType && (
        <div className="bg-[#222] border border-[#333] rounded-xl p-6 space-y-4">
          <h3 className="font-inter font-medium text-cream text-sm">
            {TYPES.find((t) => t.id === activeType)?.label}
          </h3>

          <div className="space-y-1">
            <label className="text-xs font-inter text-muted-foreground">Page title</label>
            <input
              value={titles[activeType] ?? ''}
              onChange={(e) => setTitles((prev) => ({ ...prev, [activeType]: e.target.value }))}
              placeholder={TYPES.find((t) => t.id === activeType)?.label}
              className="w-full px-3 py-2 rounded-md bg-[#1A1A1A] border border-[#333] text-cream font-inter text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-inter text-muted-foreground">Content</label>
            <textarea
              value={contents[activeType] ?? ''}
              onChange={(e) => setContents((prev) => ({ ...prev, [activeType]: e.target.value }))}
              rows={6}
              placeholder={
                activeType === 'upsell'
                  ? 'Describe your offer, price, and how to access it...'
                  : activeType === 'affiliate'
                  ? 'List your recommended resources with links...'
                  : 'Write your custom page content...'
              }
              className="w-full px-3 py-2 rounded-md bg-[#1A1A1A] border border-[#333] text-cream font-source-serif text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          <button
            onClick={() => save(activeType)}
            disabled={!contents[activeType]?.trim() || saving === activeType}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-40"
          >
            {saving === activeType && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Page
          </button>
        </div>
      )}

      <div className="mt-10 flex justify-end">
        <button
          onClick={onComplete}
          className="px-6 py-2.5 bg-gold hover:bg-gold/90 text-canvas font-inter text-sm font-semibold rounded-md transition-colors"
        >
          Continue to Complete →
        </button>
      </div>
    </div>
  )
}
