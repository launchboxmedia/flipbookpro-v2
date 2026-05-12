'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Loader2, RefreshCw, Upload, Wand2, ImageIcon, X, Check,
  BookOpen, Layers, Sparkles, ArrowRight,
  ShoppingBag, Link2, FileText,
} from 'lucide-react'
import type { Book, BookPage } from '@/types/database'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { createClient } from '@/lib/supabase/client'
import type { ImageStatus } from './CoauthorShell'

// Cover generation modes. 'ai' is the Phase-1 typography-first AI cover;
// 'mascot' and 'photo' route through openai.images.edit() with a brand
// asset as the seed image. The selector pill is gated on whether the
// matching asset exists in the user's profile.
export type CoverMode = 'ai' | 'mascot' | 'photo'

// ── AI back-cover critique flag shape ──────────────────────────────────────
// Matches the response from /api/books/[id]/critique-back-matter. Lifted
// from the deleted BackMatterStage so the analyze/apply/dismiss flow
// keeps the same surface.
type BackMatterField    = 'tagline' | 'description' | 'ctaText' | 'ctaUrl' | 'optional'
type BackMatterFlagType = 'HOOK' | 'CLARITY' | 'CTA' | 'VALUE' | 'TONE' | 'LENGTH'

interface BackMatterFlag {
  field:      BackMatterField
  type:       BackMatterFlagType
  issue:      string
  suggestion: string
  severity:   'low' | 'medium' | 'high'
}

const FIELD_LABEL: Record<BackMatterField, string> = {
  tagline:     'Tagline',
  description: 'Description',
  ctaText:     'CTA text',
  ctaUrl:      'CTA URL',
  optional:    'Optional pages',
}

// ── Optional back-matter pages ─────────────────────────────────────────────
// Three slots saved to book_pages at negative chapter_index values via the
// existing /api/books/[id]/back-matter route. The route maps:
//   upsell → -1, affiliate → -2, custom → -3.
type BackMatterType = 'upsell' | 'affiliate' | 'custom'

const OPTIONAL_TYPES: ReadonlyArray<{
  id:          BackMatterType
  label:       string
  icon:        React.ComponentType<{ className?: string }>
  description: string
  placeholder: string
}> = [
  {
    id:          'upsell',
    label:       'Upsell Page',
    icon:        ShoppingBag,
    description: 'Promote a product, course, or service.',
    placeholder: 'Describe your offer, price, and how to access it…',
  },
  {
    id:          'affiliate',
    label:       'Affiliate Page',
    icon:        Link2,
    description: 'Share recommended resources with links.',
    placeholder: 'List your recommended resources with links…',
  },
  {
    id:          'custom',
    label:       'Custom Page',
    icon:        FileText,
    description: 'Write any content — bio, CTA, credits.',
    placeholder: 'Write your custom page content…',
  },
]

interface Props {
  book: Book
  chapters: BookPage[]

  // ── Front cover (driven by CoauthorShell so the sidebar cover panel +
  //    this stage share state) ────────────────────────────────────────────
  coverImageUrl: string | null
  coverImageStatus: ImageStatus
  coverImageError: string | null
  /** Generate the cover via the selected mode. 'ai' uses Haiku scene
   *  extraction + the typography prompt; 'mascot' / 'photo' edit the
   *  uploaded brand asset into a cover layout. */
  onGenerateCover: (mode: CoverMode) => void
  onUploadCover: (file: File) => void

  /** Profile-side asset URLs that gate the Mascot / Photo cover modes.
   *  When null, the corresponding pill is hidden — the author needs to
   *  upload the asset in Settings → Brand first. */
  authorPhotoUrl?: string | null
  mascotUrl?:      string | null

  // ── Chapter images ─────────────────────────────────────────────────────
  imageStatuses: Record<string, ImageStatus>
  imageErrors: Record<string, string>
  onGenerateChapterImage: (pageId: string) => void
  onUploadChapterImage: (pageId: string, file: File) => void

  /** Profile-derived placeholder for the author-name input — shows in the
   *  field when book.author_name is null, hinting at the value the user
   *  could fall back to without forcing it. Empty string = no hint. */
  authorNamePlaceholder?: string

  // ── Forward nav ────────────────────────────────────────────────────────
  onContinue: () => void
}

// Cream/ink card recipe used by every section so the stage reads as a
// single sheet rather than five floating panels.
const CARD = 'bg-[#222] border border-[#333] rounded-xl p-5'

export function BookDesignStage({
  book,
  chapters,
  coverImageUrl,
  coverImageStatus,
  coverImageError,
  onGenerateCover,
  onUploadCover,
  imageStatuses,
  imageErrors,
  onGenerateChapterImage,
  onUploadChapterImage,
  authorNamePlaceholder = '',
  authorPhotoUrl = null,
  mascotUrl = null,
  onContinue,
}: Props) {
  // ── Front cover wiring ────────────────────────────────────────────────
  const coverFileInput = useRef<HTMLInputElement>(null)
  const coverBusy = coverImageStatus === 'generating'

  // Selected cover mode — drives both the Generate Cover button label and
  // the body posted to /generate-cover-image. The user can switch
  // between AI / Mascot / Photo at any time; once selected, the next
  // click of Generate uses that mode.
  const [coverMode, setCoverMode] = useState<CoverMode>('ai')

  // If the user previously selected a brand-asset mode but the asset got
  // removed in settings, snap back to 'ai' so we never POST a mode whose
  // asset doesn't exist.
  useEffect(() => {
    if (coverMode === 'mascot' && !mascotUrl)      setCoverMode('ai')
    if (coverMode === 'photo'  && !authorPhotoUrl) setCoverMode('ai')
  }, [coverMode, mascotUrl, authorPhotoUrl])

  // ── Chapter images — derived counts for the header label ──────────────
  const withImages = chapters.filter((c) => !!c.image_url).length

  // ── Back-cover image (its own endpoints, no CoauthorShell dependency)
  const [backImageUrl, setBackImageUrl] = useState<string | null>(book.back_cover_image_url)
  const [backUploading, setBackUploading] = useState(false)
  const [backGenerating, setBackGenerating] = useState(false)
  const [backImageError, setBackImageError] = useState('')
  const backImageInput = useRef<HTMLInputElement>(null)

  // Back-cover mode — mirrors the front-cover selector. CoverMode shape
  // is identical ('ai' | 'mascot' | 'photo') so we reuse the type.
  const [backCoverMode, setBackCoverMode] = useState<CoverMode>('ai')
  useEffect(() => {
    if (backCoverMode === 'mascot' && !mascotUrl)      setBackCoverMode('ai')
    if (backCoverMode === 'photo'  && !authorPhotoUrl) setBackCoverMode('ai')
  }, [backCoverMode, mascotUrl, authorPhotoUrl])

  async function generateBackImage() {
    if (backGenerating || backUploading) return
    setBackGenerating(true)
    setBackImageError('')
    try {
      const res = await fetch(`/api/books/${book.id}/generate-back-cover-image`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode: backCoverMode }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Generation failed (${res.status})`)
      if (typeof json.imageUrl === 'string') setBackImageUrl(json.imageUrl)
    } catch (e) {
      setBackImageError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setBackGenerating(false)
    }
  }

  async function uploadBackImage(file: File) {
    if (backGenerating || backUploading) return
    setBackUploading(true)
    setBackImageError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/books/${book.id}/upload-back-cover`, {
        method: 'POST',
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status})`)
      if (typeof json.imageUrl === 'string') setBackImageUrl(json.imageUrl)
    } catch (e) {
      setBackImageError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBackUploading(false)
    }
  }

  async function removeBackImage() {
    if (backGenerating || backUploading) return
    setBackUploading(true)
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
      setBackUploading(false)
    }
  }

  // ── Author name ───────────────────────────────────────────────────────
  // Per-book identifier shown on the cover + share card. Saves on blur via
  // the client supabase (RLS protects us), only when the value actually
  // changed — mirrors the target_audience pattern in OutlineStage.
  const [authorName,        setAuthorName]        = useState(book.author_name ?? '')
  const [authorNameSaving,  setAuthorNameSaving]  = useState(false)
  const [authorNameSaved,   setAuthorNameSaved]   = useState(false)
  const lastSavedAuthorName = useRef(book.author_name ?? '')

  async function saveAuthorNameOnBlur() {
    const trimmed = authorName.trim()
    if (trimmed === lastSavedAuthorName.current) return
    setAuthorNameSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('books')
        .update({
          author_name: trimmed.length > 0 ? trimmed : null,
          updated_at:  new Date().toISOString(),
        })
        .eq('id', book.id)
      if (!error) {
        lastSavedAuthorName.current = trimmed
        setAuthorNameSaved(true)
        setTimeout(() => setAuthorNameSaved(false), 1800)
      }
    } finally {
      setAuthorNameSaving(false)
    }
  }

  // ── Back-cover text ───────────────────────────────────────────────────
  const [tagline,     setTagline]     = useState(book.back_cover_tagline     ?? '')
  const [description, setDescription] = useState(book.back_cover_description ?? '')
  const [ctaText,     setCtaText]     = useState(book.back_cover_cta_text    ?? '')
  const [ctaUrl,      setCtaUrl]      = useState(book.back_cover_cta_url     ?? '')
  const [savingText,  setSavingText]  = useState(false)
  const [savedText,   setSavedText]   = useState(false)
  const [textError,   setTextError]   = useState('')

  // ── AI back-cover critique ────────────────────────────────────────────
  const [analyzing,       setAnalyzing]       = useState(false)
  const [hasAnalyzed,     setHasAnalyzed]     = useState(false)
  const [analyzeError,    setAnalyzeError]    = useState('')
  const [flags,           setFlags]           = useState<BackMatterFlag[]>([])
  const [dismissedFlags,  setDismissedFlags]  = useState<Set<number>>(new Set())
  const [applyingFlag,    setApplyingFlag]    = useState<number | null>(null)
  const visibleFlags = flags.filter((_, i) => !dismissedFlags.has(i))

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

  function dismissFlag(i: number) {
    setDismissedFlags((prev) => {
      const next = new Set(prev)
      next.add(i)
      return next
    })
  }

  /** Apply a flag's suggestion to the corresponding back-cover field and
   *  persist immediately. Reads/writes the explicit "next" values rather
   *  than relying on setState landing first, so a fast double-click can't
   *  send a stale snapshot to the server. */
  async function applyFlag(flagIndex: number) {
    const flag = flags[flagIndex]
    if (!flag) return

    let nextTagline     = tagline
    let nextDescription = description
    let nextCtaText     = ctaText
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
      // ctaUrl / optional — advice-only, just dismiss.
      dismissFlag(flagIndex)
      return
    }

    setApplyingFlag(flagIndex)
    setTextError('')
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
      setSavedText(true)
      setTimeout(() => setSavedText(false), 2500)
    } catch (e) {
      setTextError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setApplyingFlag(null)
    }
  }

  // ── Optional pages ────────────────────────────────────────────────────
  const [activeOptional,   setActiveOptional]   = useState<BackMatterType | null>(null)
  const [optionalTitles,   setOptionalTitles]   = useState<Record<BackMatterType, string>>({ upsell: '', affiliate: '', custom: '' })
  const [optionalContents, setOptionalContents] = useState<Record<BackMatterType, string>>({ upsell: '', affiliate: '', custom: '' })
  const [savingOptional,   setSavingOptional]   = useState<BackMatterType | null>(null)
  const [savedOptional,    setSavedOptional]    = useState<Set<BackMatterType>>(new Set())
  const [optionalError,    setOptionalError]    = useState('')

  // Hydrate existing optional pages from the back-matter endpoint. The
  // route already filters to chapter_index < 0; we map by index because
  // -4+ fallback rows aren't part of any tile.
  useEffect(() => {
    let cancelled = false
    async function fetchOptional() {
      try {
        const res = await fetch(`/api/books/${book.id}/back-matter`)
        if (!res.ok || cancelled) return
        const json = await res.json().catch(() => ({}))
        const pages: Array<{ chapter_index: number; chapter_title?: string; content?: string }> =
          Array.isArray(json.pages) ? json.pages : []
        const indexToType: Record<number, BackMatterType> = { [-1]: 'upsell', [-2]: 'affiliate', [-3]: 'custom' }
        const titles:   Record<BackMatterType, string> = { upsell: '', affiliate: '', custom: '' }
        const contents: Record<BackMatterType, string> = { upsell: '', affiliate: '', custom: '' }
        const saved = new Set<BackMatterType>()
        for (const p of pages) {
          const t = indexToType[p.chapter_index]
          if (!t) continue
          if (typeof p.chapter_title === 'string') titles[t]   = p.chapter_title
          if (typeof p.content       === 'string') contents[t] = p.content
          if (p.content) saved.add(t)
        }
        if (cancelled) return
        setOptionalTitles(titles)
        setOptionalContents(contents)
        setSavedOptional(saved)
      } catch {
        // best-effort hydrate — leaving tiles in their empty default is fine
      }
    }
    fetchOptional()
    return () => { cancelled = true }
  }, [book.id])

  async function saveOptional(type: BackMatterType) {
    if (!optionalContents[type]?.trim()) return
    setSavingOptional(type)
    setOptionalError('')
    try {
      const res = await fetch(`/api/books/${book.id}/back-matter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title:   optionalTitles[type] || OPTIONAL_TYPES.find((t) => t.id === type)?.label,
          content: optionalContents[type],
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Save failed')
      }
      setSavedOptional((prev) => {
        const next = new Set(prev)
        next.add(type)
        return next
      })
    } catch (e) {
      setOptionalError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingOptional(null)
    }
  }

  async function saveBackCoverText() {
    setSavingText(true)
    setTextError('')
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
      setSavedText(true)
      setTimeout(() => setSavedText(false), 2500)
    } catch (e) {
      setTextError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingText(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h2 className="font-playfair text-3xl text-cream">Book Design</h2>
        <p className="text-muted-foreground text-sm font-source-serif mt-1">
          Cover, chapter illustrations, and back-cover copy. Finish the visual layer here before the pre-publish check.
        </p>
      </div>

      {/* ── FRONT COVER ──────────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-gold" />
          <h3 className="font-inter font-semibold text-cream text-sm uppercase tracking-wider">
            Front Cover
          </h3>
        </div>

        <input
          ref={coverFileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onUploadCover(f)
            if (coverFileInput.current) coverFileInput.current.value = ''
          }}
        />

        {/* Cover style pills — only render the row when at least one
            non-AI mode is available. AI is always present; Mascot and
            Photo appear when their corresponding brand asset is
            uploaded in Settings → Brand. */}
        {(mascotUrl || authorPhotoUrl) && (
          <div className="mb-4">
            <p className="text-[10px] font-inter font-medium text-cream/55 uppercase tracking-[0.18em] mb-2">
              Cover Style
            </p>
            <div className="flex flex-wrap gap-2">
              <CoverModePill
                active={coverMode === 'ai'}
                label="AI Generated"
                onClick={() => setCoverMode('ai')}
              />
              {mascotUrl && (
                <CoverModePill
                  active={coverMode === 'mascot'}
                  label="Mascot Cover"
                  onClick={() => setCoverMode('mascot')}
                />
              )}
              {authorPhotoUrl && (
                <CoverModePill
                  active={coverMode === 'photo'}
                  label="Photo Cover"
                  onClick={() => setCoverMode('photo')}
                />
              )}
            </div>
          </div>
        )}

        {coverBusy ? (
          <div className="aspect-[3/4] max-w-[160px] bg-[#1A1A1A] border border-dashed border-gold/40 rounded-md flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-gold" />
            <span className="text-[10px] font-inter text-gold/80">Generating…</span>
          </div>
        ) : coverImageUrl ? (
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="w-32 sm:w-40 shrink-0">
              <ImageLightbox src={coverImageUrl} alt={`${book.title} cover`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImageUrl}
                  alt=""
                  className="w-full object-cover rounded-lg shadow-md border border-[#333]"
                  style={{ aspectRatio: '3/4' }}
                />
              </ImageLightbox>
            </div>
            <div className="flex-1 min-w-0 space-y-2.5">
              <p className="text-cream/70 font-source-serif text-xs leading-relaxed">
                Click the thumbnail to enlarge. Regenerate for a fresh AI cover, or upload your own.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onGenerateCover(coverMode)}
                  disabled={coverBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate Cover
                </button>
                <button
                  type="button"
                  onClick={() => coverFileInput.current?.click()}
                  disabled={coverBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#333] hover:border-accent/40 text-cream/80 hover:text-cream font-inter text-xs rounded-md transition-colors disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Custom Cover
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="w-32 sm:w-40 shrink-0 aspect-[3/4] bg-[#1A1A1A] border border-dashed border-[#333] rounded-lg flex flex-col items-center justify-center gap-1">
              <ImageIcon className="w-5 h-5 text-[#444]" />
              <span className="text-[10px] font-inter text-muted-foreground">No cover</span>
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <p className="font-inter text-sm text-cream">Your book needs a cover.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onGenerateCover(coverMode)}
                  disabled={coverBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Cover ✨
                </button>
                <button
                  type="button"
                  onClick={() => coverFileInput.current?.click()}
                  disabled={coverBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#333] hover:border-accent/40 text-cream/80 hover:text-cream font-inter text-xs rounded-md transition-colors disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Cover
                </button>
              </div>
            </div>
          </div>
        )}

        {coverImageError && (
          <p className="mt-3 text-red-400 text-xs font-inter">{coverImageError}</p>
        )}
      </section>

      {/* ── CHAPTER IMAGES ───────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gold" />
            <h3 className="font-inter font-semibold text-cream text-sm uppercase tracking-wider">
              Chapter Images
            </h3>
          </div>
          <span className="text-[11px] font-inter text-muted-foreground tabular-nums">
            {withImages} of {chapters.length} chapter{chapters.length === 1 ? '' : 's'} have images
          </span>
        </div>

        {chapters.length === 0 ? (
          <p className="text-xs font-source-serif text-muted-foreground">
            Add chapters in Outline before generating illustrations.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {chapters.map((ch) => {
              const status = imageStatuses[ch.id] ?? (ch.image_url ? 'done' : 'idle')
              const err    = imageErrors[ch.id]
              const busy   = status === 'generating'
              return (
                <ChapterImageCard
                  key={ch.id}
                  chapter={ch}
                  busy={busy}
                  error={err}
                  onGenerate={() => onGenerateChapterImage(ch.id)}
                  onUpload={(file) => onUploadChapterImage(ch.id, file)}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* ── BACK COVER IMAGE ─────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-4 h-4 text-gold" />
          <h3 className="font-inter font-semibold text-cream text-sm uppercase tracking-wider">
            Back Cover Image
          </h3>
        </div>

        {/* Back-cover style pills — mirrors the front-cover selector.
            AI Generated is always present; Mascot / Photo Back Cover
            appear when the corresponding brand asset is uploaded. */}
        {(mascotUrl || authorPhotoUrl) && (
          <div className="mb-4">
            <p className="text-[10px] font-inter font-medium text-cream/55 uppercase tracking-[0.18em] mb-2">
              Back Cover Style
            </p>
            <div className="flex flex-wrap gap-2">
              <CoverModePill
                active={backCoverMode === 'ai'}
                label="AI Generated"
                onClick={() => setBackCoverMode('ai')}
              />
              {authorPhotoUrl && (
                <CoverModePill
                  active={backCoverMode === 'photo'}
                  label="Photo Back Cover"
                  onClick={() => setBackCoverMode('photo')}
                />
              )}
              {mascotUrl && (
                <CoverModePill
                  active={backCoverMode === 'mascot'}
                  label="Mascot Back Cover"
                  onClick={() => setBackCoverMode('mascot')}
                />
              )}
            </div>
          </div>
        )}

        <input
          ref={backImageInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) uploadBackImage(f)
            if (backImageInput.current) backImageInput.current.value = ''
          }}
        />

        <div className="flex items-start gap-4">
          {backGenerating ? (
            <div className="w-24 h-32 bg-[#1A1A1A] border border-dashed border-gold/40 rounded-md flex flex-col items-center justify-center gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin text-gold" />
              <span className="text-[10px] font-inter text-gold/80 text-center px-1 leading-tight">
                Generating back cover…
              </span>
            </div>
          ) : backImageUrl ? (
            <div className="relative">
              <ImageLightbox src={backImageUrl} alt="Back cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={backImageUrl}
                  alt="Back cover"
                  className="w-24 h-32 object-cover rounded-md border border-[#333]"
                />
              </ImageLightbox>
              <button
                onClick={removeBackImage}
                disabled={backUploading || backGenerating}
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

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={generateBackImage}
                disabled={backGenerating || backUploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
              >
                {backGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {backGenerating
                  ? 'Generating…'
                  : backImageUrl
                    ? 'Regenerate ✨'
                    : 'Generate Back Cover ✨'}
              </button>
              <button
                onClick={() => backImageInput.current?.click()}
                disabled={backGenerating || backUploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#333] hover:border-accent/40 text-cream/80 hover:text-cream font-inter text-xs rounded-md transition-colors disabled:opacity-50"
              >
                {backUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {backImageUrl ? 'Replace' : 'Upload'} image
              </button>
            </div>
            <p className="text-[10px] font-inter text-muted-foreground leading-relaxed">
              Atmospheric companion to the front cover, or upload your own. PNG/JPEG/WebP, up to 5 MB.
            </p>
            {backImageError && (
              <p className="text-[10px] text-red-400 font-inter">{backImageError}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── BACK MATTER TEXT ─────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gold" />
            <h3 className="font-inter font-semibold text-cream text-sm uppercase tracking-wider">
              Back Cover Copy
            </h3>
          </div>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#333] text-cream text-xs font-inter rounded-md transition-colors disabled:opacity-50"
          >
            {analyzing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : hasAnalyzed
                ? <RefreshCw className="w-3.5 h-3.5 text-gold" />
                : <Sparkles className="w-3.5 h-3.5 text-gold" />}
            {analyzing ? 'Analyzing…' : hasAnalyzed ? 'Re-analyze' : 'Analyze Back Cover'}
          </button>
        </div>

        {analyzeError && (
          <div className="mb-4 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-inter">
            {analyzeError}
          </div>
        )}

        {hasAnalyzed && !analyzing && visibleFlags.length === 0 && flags.length === 0 && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-inter">
            <Check className="w-3.5 h-3.5" />
            ✓ No issues found — back-cover copy reads well.
          </div>
        )}

        {visibleFlags.length > 0 && (
          <div className="mb-5 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-inter font-medium text-cream/70 uppercase tracking-wider">
                AI Analysis · {visibleFlags.length} flag{visibleFlags.length !== 1 ? 's' : ''}
              </p>
              <button
                type="button"
                onClick={() => setDismissedFlags(new Set(flags.map((_, i) => i)))}
                className="text-[11px] font-inter text-muted-foreground hover:text-cream transition-colors"
              >
                Dismiss all
              </button>
            </div>
            {visibleFlags.map((flag) => {
              const originalIndex = flags.indexOf(flag)
              const canApply = flag.field === 'tagline' || flag.field === 'description' || flag.field === 'ctaText'
              const isApplying = applyingFlag === originalIndex
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
                        type="button"
                        onClick={() => applyFlag(originalIndex)}
                        disabled={isApplying || applyingFlag !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 text-emerald-400 text-[11px] font-inter rounded-md transition-colors"
                      >
                        {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        {isApplying ? 'Applying…' : 'Apply'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => dismissFlag(originalIndex)}
                      disabled={isApplying}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#333] text-muted-foreground text-[11px] font-inter rounded-md transition-colors disabled:opacity-40"
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

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <label htmlFor="book-author-name" className="text-xs font-inter text-muted-foreground">
                Author name
              </label>
              {authorNameSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              {authorNameSaved  && !authorNameSaving && (
                <span className="inline-flex items-center gap-1 text-[10px] font-inter text-accent">
                  <Check className="w-3 h-3" />
                  Saved
                </span>
              )}
            </div>
            <input
              id="book-author-name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              onBlur={() => void saveAuthorNameOnBlur()}
              placeholder={authorNamePlaceholder || 'Your pen name'}
              className="w-full px-3 py-2 rounded-md bg-[#1A1A1A] border border-[#333] text-cream font-inter text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[10px] font-inter text-muted-foreground leading-relaxed">
              Appears on the cover and in search results. Can differ from your profile name.
            </p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <p className="text-[10px] font-inter text-muted-foreground leading-relaxed">
                Where readers go after finishing — add before publishing.
              </p>
            </div>
          </div>

          {/* Testimonials — read-only when present, set during setup. */}
          {book.testimonials && book.testimonials.trim() && (
            <div className="space-y-1">
              <label className="text-xs font-inter text-muted-foreground">Testimonials <span className="text-cream/30">(set in wizard)</span></label>
              <div className="px-3 py-2 rounded-md bg-[#1A1A1A] border border-[#333] text-cream/70 font-source-serif text-xs whitespace-pre-line leading-relaxed">
                {book.testimonials}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={saveBackCoverText}
              disabled={savingText}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-40"
            >
              {savingText ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : savedText ? (
                <Check className="w-4 h-4" />
              ) : null}
              {savedText ? 'Saved' : 'Save Back Cover Copy'}
            </button>
            {textError && <p className="text-red-400 text-xs font-inter">{textError}</p>}
          </div>
        </div>
      </section>

      {/* ── OPTIONAL PAGES ───────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-gold" />
          <h3 className="font-inter font-semibold text-cream text-sm uppercase tracking-wider">
            Optional Pages
          </h3>
        </div>
        <p className="text-xs font-source-serif text-muted-foreground mb-4 leading-relaxed">
          Extra pages added to the very end of the flipbook — after your chapters and before the back cover. Each slot is independent; you can skip any of them.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {OPTIONAL_TYPES.map((t) => {
            const Icon = t.icon
            const isActive = activeOptional === t.id
            const isSaved  = savedOptional.has(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveOptional(isActive ? null : t.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  isActive
                    ? 'border-accent bg-accent/10'
                    : isSaved
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-[#333] bg-[#1A1A1A] hover:border-[#444]'
                }`}
              >
                <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-accent' : 'text-muted-foreground'}`} />
                <p className="text-sm font-inter font-medium text-cream">{t.label}</p>
                <p className="text-xs font-source-serif text-muted-foreground mt-0.5 leading-snug">{t.description}</p>
                {isSaved && (
                  <p className="text-[10px] font-inter text-accent mt-2 uppercase tracking-[0.18em]">Active</p>
                )}
              </button>
            )
          })}
        </div>

        {activeOptional && (
          <div className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl p-5 space-y-4">
            <h4 className="font-inter font-medium text-cream text-sm">
              {OPTIONAL_TYPES.find((t) => t.id === activeOptional)?.label}
            </h4>

            <div className="space-y-1">
              <label className="text-xs font-inter text-muted-foreground">Page title</label>
              <input
                value={optionalTitles[activeOptional] ?? ''}
                onChange={(e) => setOptionalTitles((prev) => ({ ...prev, [activeOptional]: e.target.value }))}
                placeholder={OPTIONAL_TYPES.find((t) => t.id === activeOptional)?.label}
                className="w-full px-3 py-2 rounded-md bg-[#111] border border-[#333] text-cream font-inter text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-inter text-muted-foreground">Content</label>
              <textarea
                value={optionalContents[activeOptional] ?? ''}
                onChange={(e) => setOptionalContents((prev) => ({ ...prev, [activeOptional]: e.target.value }))}
                rows={6}
                placeholder={OPTIONAL_TYPES.find((t) => t.id === activeOptional)?.placeholder}
                className="w-full px-3 py-2 rounded-md bg-[#111] border border-[#333] text-cream font-source-serif text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => saveOptional(activeOptional)}
                disabled={!optionalContents[activeOptional]?.trim() || savingOptional === activeOptional}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-40"
              >
                {savingOptional === activeOptional ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : savedOptional.has(activeOptional) ? (
                  <Check className="w-4 h-4" />
                ) : null}
                {savedOptional.has(activeOptional) ? 'Saved' : 'Save Page'}
              </button>
              {optionalError && <p className="text-red-400 text-xs font-inter">{optionalError}</p>}
            </div>
          </div>
        )}
      </section>

      {/* ── CONTINUE CTA ─────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          onClick={onContinue}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gold hover:bg-gold-soft text-ink-1 font-inter text-sm font-semibold rounded-md transition-colors shadow-[0_8px_24px_-12px_rgba(201,168,76,0.5)]"
        >
          Run Pre-Publish Check
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Per-chapter card ─────────────────────────────────────────────────────

function ChapterImageCard({
  chapter, busy, error, onGenerate, onUpload,
}: {
  chapter: BookPage
  busy: boolean
  error: string | undefined
  onGenerate: () => void
  onUpload: (file: File) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-3 flex gap-3">
      {busy ? (
        <div className="w-16 h-20 shrink-0 bg-[#111] border border-dashed border-gold/40 rounded-md flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-gold" />
        </div>
      ) : chapter.image_url ? (
        <ImageLightbox src={chapter.image_url} alt={chapter.chapter_title}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={chapter.image_url}
            alt=""
            className="w-16 h-20 shrink-0 object-cover rounded-md border border-[#333]"
          />
        </ImageLightbox>
      ) : (
        <div className="w-16 h-20 shrink-0 bg-[#111] border border-dashed border-[#333] rounded-md flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-[#444]" />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <p className="text-[10px] font-inter font-semibold text-gold-dim uppercase tracking-[0.18em] mb-0.5">
          Chapter {chapter.chapter_index + 1}
        </p>
        <p className="font-source-serif text-sm text-cream leading-snug line-clamp-2">
          {chapter.chapter_title}
        </p>
        {error && (
          <p className="text-[10px] text-red-400 font-inter mt-1 line-clamp-2">{error}</p>
        )}

        <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
          <button
            onClick={onGenerate}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2 py-1 bg-gold/10 hover:bg-gold/20 border border-gold/40 text-gold font-inter text-[10px] font-semibold rounded-md transition-colors disabled:opacity-50"
          >
            {chapter.image_url ? <RefreshCw className="w-3 h-3" /> : <Wand2 className="w-3 h-3" />}
            {chapter.image_url ? 'Regenerate' : 'Generate'}
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2 py-1 border border-[#333] hover:border-cream/40 text-cream/70 hover:text-cream font-inter text-[10px] rounded-md transition-colors disabled:opacity-50"
          >
            <Upload className="w-3 h-3" />
            Upload
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              if (fileInput.current) fileInput.current.value = ''
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Cover-style pill ─────────────────────────────────────────────────────

function CoverModePill({
  active, label, onClick,
}: {
  active: boolean
  label:  string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-xs font-inter transition-colors ${
        active
          ? 'bg-gold text-ink-1 font-semibold'
          : 'border border-[#333] hover:border-gold/40 text-cream/70 hover:text-cream'
      }`}
    >
      {label}
    </button>
  )
}
