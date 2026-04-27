'use client'

import { useState } from 'react'
import { Loader2, ShoppingBag, Link2, FileText, BookOpen, Check } from 'lucide-react'
import type { Book } from '@/types/database'

interface Props {
  book: Book
  onComplete: () => void
}

type BackMatterType = 'upsell' | 'affiliate' | 'custom'

const OPTIONAL_TYPES = [
  { id: 'upsell' as BackMatterType,   label: 'Upsell Page',    icon: ShoppingBag, description: 'Promote a product, course, or service.' },
  { id: 'affiliate' as BackMatterType, label: 'Affiliate Page', icon: Link2,       description: 'Share recommended resources with links.' },
  { id: 'custom' as BackMatterType,   label: 'Custom Page',    icon: FileText,    description: 'Write any content — bio, CTA, credits.' },
]

export function BackMatterStage({ book, onComplete }: Props) {
  // Back cover — required
  const [tagline,     setTagline]     = useState(book.back_cover_tagline     ?? '')
  const [description, setDescription] = useState(book.back_cover_description ?? '')
  const [ctaText,     setCtaText]     = useState(book.back_cover_cta_text    ?? '')
  const [ctaUrl,      setCtaUrl]      = useState(book.back_cover_cta_url     ?? '')
  const [savingCover,  setSavingCover]  = useState(false)
  const [savedCover,   setSavedCover]   = useState(false)

  // Optional pages
  const [activeType, setActiveType] = useState<BackMatterType | null>(null)
  const [contents,   setContents]   = useState<Record<string, string>>({})
  const [titles,     setTitles]     = useState<Record<string, string>>({})
  const [saving,     setSaving]     = useState<BackMatterType | null>(null)
  const [saved,      setSaved]      = useState<Set<string>>(new Set())
  const [coverError, setCoverError] = useState('')
  const [optionalError, setOptionalError] = useState('')

  async function saveBackCover() {
    setSavingCover(true)
    setCoverError('')
    try {
      const res = await fetch(`/api/books/${book.id}/back-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          back_cover_tagline:     tagline.trim()     || null,
          back_cover_description: description.trim() || null,
          back_cover_cta_text:    ctaText.trim()     || null,
          back_cover_cta_url:     ctaUrl.trim()      || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Save failed')
      }
      setSavedCover(true)
      setTimeout(() => setSavedCover(false), 2500)
    } catch (e) {
      setCoverError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingCover(false)
    }
  }

  async function saveOptional(type: BackMatterType) {
    if (!contents[type]?.trim()) return
    setSaving(type)
    setOptionalError('')
    try {
      const res = await fetch(`/api/books/${book.id}/back-matter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title:   titles[type] || OPTIONAL_TYPES.find((t) => t.id === type)?.label,
          content: contents[type],
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Save failed')
      }
      setSaved((prev) => new Set(Array.from(prev).concat(type)))
    } catch (e) {
      setOptionalError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h2 className="font-playfair text-3xl text-cream">Back Matter</h2>
        <p className="text-muted-foreground text-sm font-source-serif mt-1">
          Configure the back cover and add optional pages at the end of your flipbook.
        </p>
      </div>

      {/* ── Back Cover (required) ─────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-accent" />
          <h3 className="font-inter font-semibold text-cream text-sm uppercase tracking-wider">Back Cover</h3>
        </div>

        <div className="bg-[#222] border border-[#333] rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-inter text-muted-foreground">Tagline / subtitle</label>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="The practical guide to decisions that matter"
              className="w-full px-3 py-2 rounded-md bg-[#1A1A1A] border border-[#333] text-cream font-playfair text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-inter text-muted-foreground">Description <span className="text-cream/30">(two sentences)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What readers will learn or gain. Why they should read it now."
              className="w-full px-3 py-2 rounded-md bg-[#1A1A1A] border border-[#333] text-cream font-source-serif text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-inter text-muted-foreground">CTA button text</label>
              <input
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Get Instant Access"
                className="w-full px-3 py-2 rounded-md bg-[#1A1A1A] border border-[#333] text-cream font-inter text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-inter text-muted-foreground">CTA URL</label>
              <input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://your-site.com"
                type="url"
                className="w-full px-3 py-2 rounded-md bg-[#1A1A1A] border border-[#333] text-cream font-inter text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <button
            onClick={saveBackCover}
            disabled={savingCover}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-40"
          >
            {savingCover ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : savedCover ? (
              <Check className="w-4 h-4" />
            ) : null}
            {savedCover ? 'Saved' : 'Save Back Cover'}
          </button>

          {coverError && <p className="text-red-400 text-xs font-inter">{coverError}</p>}
        </div>
      </div>

      {/* ── Optional pages ────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h3 className="font-inter font-semibold text-cream text-sm uppercase tracking-wider mb-4">
          Optional Pages
        </h3>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {OPTIONAL_TYPES.map((t) => {
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
                {saved.has(t.id) && <p className="text-xs font-inter text-accent mt-2">Saved</p>}
              </button>
            )
          })}
        </div>

        {activeType && (
          <div className="bg-[#222] border border-[#333] rounded-xl p-6 space-y-4">
            <h3 className="font-inter font-medium text-cream text-sm">
              {OPTIONAL_TYPES.find((t) => t.id === activeType)?.label}
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-inter text-muted-foreground">Page title</label>
              <input
                value={titles[activeType] ?? ''}
                onChange={(e) => setTitles((prev) => ({ ...prev, [activeType]: e.target.value }))}
                placeholder={OPTIONAL_TYPES.find((t) => t.id === activeType)?.label}
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
                  activeType === 'upsell'    ? 'Describe your offer, price, and how to access it...'
                  : activeType === 'affiliate' ? 'List your recommended resources with links...'
                  : 'Write your custom page content...'
                }
                className="w-full px-3 py-2 rounded-md bg-[#1A1A1A] border border-[#333] text-cream font-source-serif text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
            </div>

            <button
              onClick={() => saveOptional(activeType)}
              disabled={!contents[activeType]?.trim() || saving === activeType}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-40"
            >
              {saving === activeType && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Page
            </button>

            {optionalError && <p className="text-red-400 text-xs font-inter">{optionalError}</p>}
          </div>
        )}
      </div>

      <div className="flex justify-end">
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
