'use client'

import { useRef, useState } from 'react'
import {
  Loader2, RefreshCw, Upload, Wand2, ImageIcon, X, Check,
  BookOpen, Layers, Sparkles, ArrowRight,
} from 'lucide-react'
import type { Book, BookPage } from '@/types/database'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import type { ImageStatus } from './CoauthorShell'

interface Props {
  book: Book
  chapters: BookPage[]

  // ── Front cover (driven by CoauthorShell so the sidebar cover panel +
  //    this stage share state) ────────────────────────────────────────────
  coverImageUrl: string | null
  coverImageStatus: ImageStatus
  coverImageError: string | null
  onGenerateCover: () => void
  onUploadCover: (file: File) => void

  // ── Chapter images ─────────────────────────────────────────────────────
  imageStatuses: Record<string, ImageStatus>
  imageErrors: Record<string, string>
  onGenerateChapterImage: (pageId: string) => void
  onUploadChapterImage: (pageId: string, file: File) => void

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
  onContinue,
}: Props) {
  // ── Front cover wiring ────────────────────────────────────────────────
  const coverFileInput = useRef<HTMLInputElement>(null)
  const coverBusy = coverImageStatus === 'generating'

  // ── Chapter images — derived counts for the header label ──────────────
  const withImages = chapters.filter((c) => !!c.image_url).length

  // ── Back-cover image (its own endpoints, no CoauthorShell dependency)
  const [backImageUrl, setBackImageUrl] = useState<string | null>(book.back_cover_image_url)
  const [backUploading, setBackUploading] = useState(false)
  const [backGenerating, setBackGenerating] = useState(false)
  const [backImageError, setBackImageError] = useState('')
  const backImageInput = useRef<HTMLInputElement>(null)

  async function generateBackImage() {
    if (backGenerating || backUploading) return
    setBackGenerating(true)
    setBackImageError('')
    try {
      const res = await fetch(`/api/books/${book.id}/generate-back-cover-image`, { method: 'POST' })
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

  // ── Back-cover text ───────────────────────────────────────────────────
  const [tagline,     setTagline]     = useState(book.back_cover_tagline     ?? '')
  const [description, setDescription] = useState(book.back_cover_description ?? '')
  const [ctaText,     setCtaText]     = useState(book.back_cover_cta_text    ?? '')
  const [ctaUrl,      setCtaUrl]      = useState(book.back_cover_cta_url     ?? '')
  const [savingText,  setSavingText]  = useState(false)
  const [savedText,   setSavedText]   = useState(false)
  const [textError,   setTextError]   = useState('')

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
                  onClick={onGenerateCover}
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
                  onClick={onGenerateCover}
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
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-gold" />
          <h3 className="font-inter font-semibold text-cream text-sm uppercase tracking-wider">
            Back Cover Copy
          </h3>
        </div>

        <div className="space-y-4">
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
