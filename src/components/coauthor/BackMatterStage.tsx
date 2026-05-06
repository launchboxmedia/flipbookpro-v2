'use client'

import { useRef, useState } from 'react'
import { Loader2, ShoppingBag, Link2, FileText, BookOpen, Check, Sparkles, RefreshCw, X, Upload, ImageIcon } from 'lucide-react'
import type { Book } from '@/types/database'

type BackMatterField = 'tagline' | 'description' | 'ctaText' | 'ctaUrl' | 'optional'
type BackMatterFlagType = 'HOOK' | 'CLARITY' | 'CTA' | 'VALUE' | 'TONE' | 'LENGTH'

interface BackMatterFlag {
  field: BackMatterField
  type: BackMatterFlagType
  issue: string
  suggestion: string
  severity: 'low' | 'medium' | 'high'
}

const FIELD_LABEL: Record<BackMatterField, string> = {
  tagline:     'Tagline',
  description: 'Description',
  ctaText:     'CTA text',
  ctaUrl:      'CTA URL',
  optional:    'Optional pages',
}

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

  // Back-cover image
  const [backImageUrl, setBackImageUrl] = useState<string | null>(book.back_cover_image_url)
  const [uploadingBackImage, setUploadingBackImage] = useState(false)
  const [backImageError, setBackImageError] = useState('')
  const backImageInputRef = useRef<HTMLInputElement>(null)

  // Optional pages
  const [activeType, setActiveType] = useState<BackMatterType | null>(null)
  const [contents,   setContents]   = useState<Record<string, string>>({})
  const [titles,     setTitles]     = useState<Record<string, string>>({})
  const [saving,     setSaving]     = useState<BackMatterType | null>(null)
  const [saved,      setSaved]      = useState<Set<string>>(new Set())
  const [coverError, setCoverError] = useState('')
  const [optionalError, setOptionalError] = useState('')

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [flags, setFlags] = useState<BackMatterFlag[]>([])
  const [dismissedFlags, setDismissedFlags] = useState<Set<number>>(new Set())
  const [analyzeError, setAnalyzeError] = useState('')

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

  async function runAnalysis() {
    if (analyzing) return
    setAnalyzing(true)
    setAnalyzeError('')
    setFlags([])
    setDismissedFlags(new Set())
    try {
      const res = await fetch(`/api/books/${book.id}/critique-back-matter`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Analysis failed (${res.status})`)
      setFlags(Array.isArray(json.flags) ? json.flags : [])
      setHasAnalyzed(true)
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function applyFlag(flagIndex: number) {
    const flag = flags[flagIndex]
    if (!flag) return
    // Apply the suggestion to the relevant field, then save.
    let nextTagline = tagline
    let nextDescription = description
    let nextCtaText = ctaText
    if (flag.field === 'tagline') {
      nextTagline = flag.suggestion
      setTagline(flag.suggestion)
    } else if (flag.field === 'description') {
      nextDescription = flag.suggestion
      setDescription(flag.suggestion)
    } else if (flag.field === 'ctaText') {
      nextCtaText = flag.suggestion
      setCtaText(flag.suggestion)
    } else {
      // ctaUrl / optional — advice-only, just dismiss
      dismissFlag(flagIndex)
      return
    }

    setSavingCover(true)
    setCoverError('')
    try {
      const res = await fetch(`/api/books/${book.id}/back-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          back_cover_tagline:     nextTagline.trim()     || null,
          back_cover_description: nextDescription.trim() || null,
          back_cover_cta_text:    nextCtaText.trim()     || null,
          back_cover_cta_url:     ctaUrl.trim()          || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Save failed')
      }
      dismissFlag(flagIndex)
      setSavedCover(true)
      setTimeout(() => setSavedCover(false), 2500)
    } catch (e) {
      setCoverError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingCover(false)
    }
  }

  function dismissFlag(i: number) {
    setDismissedFlags((prev) => {
      const next = new Set(prev)
      next.add(i)
      return next
    })
  }

  async function uploadBackImage(file: File) {
    setUploadingBackImage(true)
    setBackImageError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/books/${book.id}/upload-back-cover`, {
        method: 'POST',
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status})`)
      setBackImageUrl(json.imageUrl)
    } catch (e) {
      setBackImageError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadingBackImage(false)
    }
  }

  async function removeBackImage() {
    setUploadingBackImage(true)
    setBackImageError('')
    try {
      const res = await fetch(`/api/books/${book.id}/upload-back-cover`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Remove failed')
      }
      setBackImageUrl(null)
    } catch (e) {
      setBackImageError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setUploadingBackImage(false)
    }
  }

  function handleBackImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadBackImage(file)
    e.target.value = ''
  }

  const visibleFlags = flags.filter((_, i) => !dismissedFlags.has(i))

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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-playfair text-3xl text-cream">Back Matter</h2>
          <p className="text-muted-foreground text-sm font-source-serif mt-1">
            Configure the back cover and add optional pages at the end of your flipbook.
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2 bg-[#2A2A2A] hover:bg-[#333] border border-[#333] text-cream text-sm font-inter rounded-md transition-colors disabled:opacity-50 shrink-0"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : hasAnalyzed ? <RefreshCw className="w-4 h-4 text-gold" /> : <Sparkles className="w-4 h-4 text-gold" />}
          {analyzing ? 'Analyzing...' : hasAnalyzed ? 'Re-analyze' : 'Analyze Back Cover'}
        </button>
      </div>

      {analyzeError && (
        <div className="mb-6 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-inter">
          {analyzeError}
        </div>
      )}

      {hasAnalyzed && !analyzing && visibleFlags.length === 0 && flags.length === 0 && (
        <div className="mb-6 flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-inter">
          <Check className="w-3.5 h-3.5" />
          Back-cover copy reads well — no flags.
        </div>
      )}

      {visibleFlags.length > 0 && (
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-inter font-medium text-cream/70 uppercase tracking-wider">
              AI Analysis · {visibleFlags.length} flag{visibleFlags.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => setDismissedFlags(new Set(flags.map((_, i) => i)))}
              className="text-[11px] font-inter text-muted-foreground hover:text-cream transition-colors"
            >
              Dismiss all
            </button>
          </div>
          {visibleFlags.map((flag) => {
            const originalIndex = flags.indexOf(flag)
            const canApply = flag.field === 'tagline' || flag.field === 'description' || flag.field === 'ctaText'
            return (
              <div key={originalIndex} className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-inter font-semibold border bg-blue-500/15 text-blue-400 border-blue-500/30">
                    {FIELD_LABEL[flag.field]} · {flag.type}
                  </span>
                  <span className={`text-[10px] font-inter px-1.5 py-0.5 rounded ${
                    flag.severity === 'high'   ? 'bg-red-500/15 text-red-400'
                    : flag.severity === 'medium' ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-cream/10 text-cream/60'
                  }`}>
                    {flag.severity}
                  </span>
                </div>
                <p className="text-cream/90 text-sm font-source-serif mb-1.5 leading-relaxed">{flag.issue}</p>
                <p className="text-cream/55 text-xs font-source-serif italic mb-3 leading-relaxed">
                  {canApply ? `Replace with: "${flag.suggestion}"` : flag.suggestion}
                </p>
                <div className="flex gap-2">
                  {canApply && (
                    <button
                      onClick={() => applyFlag(originalIndex)}
                      disabled={savingCover}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 text-emerald-400 text-[11px] font-inter rounded-md transition-colors"
                    >
                      {savingCover ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Apply
                    </button>
                  )}
                  <button
                    onClick={() => dismissFlag(originalIndex)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#333] text-muted-foreground text-[11px] font-inter rounded-md transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Dismiss
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Back Cover (required) ─────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-accent" />
          <h3 className="font-inter font-semibold text-cream text-sm uppercase tracking-wider">Back Cover</h3>
        </div>

        <div className="bg-[#222] border border-[#333] rounded-xl p-6 space-y-4">
          {/* Back cover image */}
          <div className="space-y-2">
            <label className="text-xs font-inter text-muted-foreground">Back cover image <span className="text-cream/30">(optional)</span></label>
            <div className="flex items-start gap-3">
              {backImageUrl ? (
                <div className="relative">
                  <img
                    src={backImageUrl}
                    alt="Back cover"
                    className="w-24 h-32 object-cover rounded-md border border-[#333]"
                  />
                  <button
                    onClick={removeBackImage}
                    disabled={uploadingBackImage}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#1A1A1A] border border-[#333] rounded-full flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
                    title="Remove image"
                    aria-label="Remove back cover image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-32 bg-[#1A1A1A] border border-dashed border-[#333] rounded-md flex flex-col items-center justify-center gap-1">
                  <ImageIcon className="w-4 h-4 text-[#444]" />
                  <span className="text-[10px] font-inter text-muted-foreground">No image</span>
                </div>
              )}
              <div className="flex-1 space-y-2">
                <button
                  onClick={() => backImageInputRef.current?.click()}
                  disabled={uploadingBackImage}
                  className="flex items-center gap-2 px-3 py-1.5 border border-[#333] hover:border-accent/40 text-muted-foreground hover:text-cream font-inter text-xs rounded-md transition-colors disabled:opacity-40"
                >
                  {uploadingBackImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {backImageUrl ? 'Replace' : 'Upload'} image
                </button>
                <p className="text-[10px] font-inter text-muted-foreground leading-relaxed">
                  PNG, JPEG, or WebP. Up to 5 MB. Recommended: 3:4 portrait for the back-cover spread.
                </p>
                {backImageError && <p className="text-[10px] text-red-400 font-inter">{backImageError}</p>}
              </div>
              <input
                ref={backImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleBackImageChange}
                className="hidden"
              />
            </div>
          </div>

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
