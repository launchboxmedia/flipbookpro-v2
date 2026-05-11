'use client'

import { useRef, useState } from 'react'
import { Loader2, CheckCircle2, Sparkles, FileText, Download, ShieldCheck, AlertCircle, Info, Zap, Upload, RefreshCw, ImageIcon } from 'lucide-react'
import Link from 'next/link'
import type { Book, BookPage } from '@/types/database'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

type CheckSeverity = 'error' | 'warning' | 'hint'
type CheckCategory = 'BLOCKER' | 'CONTENT' | 'BRAND' | 'CONSISTENCY'

interface CheckFlag {
  category: CheckCategory
  severity: CheckSeverity
  message: string
  suggestion?: string
  action?: string
}

interface CheckResult {
  flags: CheckFlag[]
  canPublish: boolean
  counts: { errors: number; warnings: number; hints: number }
}

const SEVERITY_META: Record<CheckSeverity, { icon: React.ReactNode; color: string; label: string }> = {
  error:   { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'bg-red-500/10 border-red-500/30 text-red-400',       label: 'Blocker' },
  warning: { icon: <Info className="w-3.5 h-3.5" />,        color: 'bg-amber-500/10 border-amber-500/30 text-amber-400', label: 'Warning' },
  hint:    { icon: <Sparkles className="w-3.5 h-3.5" />,    color: 'bg-blue-500/10 border-blue-500/30 text-blue-400',    label: 'Hint' },
}

interface Props {
  book: Book
  pages: BookPage[]
  /** Forward nav in the new stage order — clicked after the pre-publish
   *  check passes so the author can finalise the back-cover blurb +
   *  optional pages. Provided by CoauthorShell; never invoked here
   *  directly because the user can always reach Back Matter from the
   *  sidebar too. */
  onContinueToBackMatter?: () => void
}

export function CompleteStage({ book, pages, onContinueToBackMatter }: Props) {
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [checkError, setCheckError] = useState('')

  // Cover section. Local state so the thumbnail updates immediately when the
  // user generates / uploads / regenerates without waiting for a full router
  // refresh. coverError surfaces upload/generation failures inline.
  const [coverUrl, setCoverUrl] = useState<string | null>(book.cover_image_url)
  const [coverGenerating, setCoverGenerating] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverError, setCoverError] = useState('')
  const coverFileInput = useRef<HTMLInputElement>(null)

  async function generateCover() {
    if (coverGenerating) return
    setCoverError('')
    setCoverGenerating(true)
    try {
      const res = await fetch(`/api/books/${book.id}/generate-cover-image`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Generation failed (${res.status})`)
      if (json.imageUrl) setCoverUrl(json.imageUrl as string)
    } catch (e) {
      setCoverError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setCoverGenerating(false)
    }
  }

  async function uploadCover(file: File) {
    if (coverUploading) return
    setCoverError('')
    setCoverUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/books/${book.id}/upload-cover`, { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status})`)
      if (json.imageUrl) setCoverUrl(json.imageUrl as string)
    } catch (e) {
      setCoverError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setCoverUploading(false)
    }
  }

  const approvedCount = pages.filter((p) => p.approved).length
  // Treat the book as ready for export/publish whenever every chapter has an
  // image — the typical flow now generates images per-chapter from the
  // ChapterStage, so book.status never gets flipped to 'ready'. Legacy books
  // that DID get their status flipped (back when a bulk-generate route ran
  // its job) still pass via that fallback.
  const allHaveImages = pages.length > 0 && pages.every((p) => !!p.image_url)
  const missingImageCount = pages.filter((p) => !p.image_url).length
  const done = book.status === 'ready' || allHaveImages

  async function runPrePublishCheck() {
    if (checking) return
    setChecking(true)
    setCheckError('')
    try {
      const res = await fetch(`/api/books/${book.id}/pre-publish-check`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Check failed (${res.status})`)
      setCheckResult({
        flags: Array.isArray(json.flags) ? json.flags : [],
        canPublish: !!json.canPublish,
        counts: json.counts ?? { errors: 0, warnings: 0, hints: 0 },
      })
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : 'Check failed')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
      {done ? (
        <div className="space-y-6">
          <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-accent" />
          </div>
          <div>
            <h2 className="font-playfair text-3xl text-cream mb-2">Your book is ready.</h2>
            <p className="text-muted-foreground font-source-serif text-sm">
              All illustrations have been generated. Run a final readthrough or publish below.
            </p>
          </div>

          {/* Book cover — sits at the very top because publish is blocked
              without one. Two states: generate/upload prompt when missing,
              click-to-enlarge thumbnail with regen/upload otherwise. */}
          <div className="bg-white border border-cream-3 rounded-xl p-5 text-left shadow-[0_2px_18px_rgba(0,0,0,0.25)]">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="w-4 h-4 text-gold" />
              <p className="font-inter font-semibold text-ink-1 text-sm">Book Cover</p>
            </div>

            {/* Hidden file input shared by both the no-cover and with-cover
                states. Resets value on change so re-selecting the same file
                still fires onChange. */}
            <input
              ref={coverFileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) await uploadCover(f)
                if (coverFileInput.current) coverFileInput.current.value = ''
              }}
            />

            {coverUrl ? (
              <div className="bg-cream-2 border border-cream-3 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-32 sm:w-36 shrink-0">
                  <ImageLightbox src={coverUrl} alt={`${book.title} cover`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverUrl}
                      alt=""
                      className="w-full max-h-48 object-cover rounded-lg shadow-md"
                      style={{ aspectRatio: '3/4' }}
                    />
                  </ImageLightbox>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-inter text-xs text-ink-1/65 leading-relaxed mb-3">
                    Your cover. Click the thumbnail to enlarge. Regenerate to try a fresh AI cover, or upload your own art.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={generateCover}
                      disabled={coverGenerating || coverUploading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
                    >
                      {coverGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      {coverGenerating ? 'Generating cover…' : 'Regenerate Cover'}
                    </button>
                    <button
                      type="button"
                      onClick={() => coverFileInput.current?.click()}
                      disabled={coverGenerating || coverUploading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-ink-4 hover:border-ink-1/40 text-ink-1/80 hover:text-ink-1 font-inter text-xs font-medium rounded-md transition-colors disabled:opacity-50"
                    >
                      {coverUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {coverUploading ? 'Uploading…' : 'Upload Custom Cover'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-cream-2 border border-cream-3 rounded-lg p-5 text-center">
                <p className="font-inter text-sm text-ink-1/80 mb-4">
                  Your book needs a cover before publishing.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    type="button"
                    onClick={generateCover}
                    disabled={coverGenerating || coverUploading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold hover:bg-gold-soft text-ink-1 font-inter text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
                  >
                    {coverGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {coverGenerating ? 'Generating cover…' : 'Generate Cover'}
                  </button>
                  <button
                    type="button"
                    onClick={() => coverFileInput.current?.click()}
                    disabled={coverGenerating || coverUploading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-ink-4 hover:border-ink-1/40 text-ink-1/80 hover:text-ink-1 font-inter text-xs font-medium rounded-md transition-colors disabled:opacity-50"
                  >
                    {coverUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {coverUploading ? 'Uploading…' : 'Upload Cover'}
                  </button>
                </div>
              </div>
            )}

            {coverError && (
              <p className="mt-3 text-red-500 text-xs font-inter">{coverError}</p>
            )}
          </div>

          {/* Pre-publish check */}
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 text-left">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gold" />
                <p className="font-inter font-semibold text-cream text-sm">Pre-publish check</p>
              </div>
              <button
                onClick={runPrePublishCheck}
                disabled={checking}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#333] border border-[#333] text-cream text-xs font-inter rounded-md transition-colors disabled:opacity-50"
              >
                {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-gold" />}
                {checking ? 'Checking...' : checkResult ? 'Re-run' : 'Run check'}
              </button>
            </div>

            {checkError && (
              <p className="text-red-400 text-xs font-inter mb-3">{checkError}</p>
            )}

            {!checkResult && !checking && !checkError && (
              <p className="text-muted-foreground text-xs font-source-serif">
                Reviews the book against publishing requirements and consistency across chapters.
              </p>
            )}

            {checkResult && (
              <div className="space-y-2.5">
                {checkResult.flags.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-inter">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Everything looks good — ready to publish.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2 mb-1 text-[11px] font-inter">
                      {checkResult.counts.errors > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                          {checkResult.counts.errors} blocker{checkResult.counts.errors !== 1 ? 's' : ''}
                        </span>
                      )}
                      {checkResult.counts.warnings > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          {checkResult.counts.warnings} warning{checkResult.counts.warnings !== 1 ? 's' : ''}
                        </span>
                      )}
                      {checkResult.counts.hints > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          {checkResult.counts.hints} hint{checkResult.counts.hints !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {checkResult.flags.map((flag, i) => {
                      const meta = SEVERITY_META[flag.severity]
                      return (
                        <div key={i} className={`px-3 py-2.5 rounded-md border ${meta.color}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            {meta.icon}
                            <span className="text-[10px] font-inter font-semibold uppercase tracking-wider">{meta.label} · {flag.category}</span>
                          </div>
                          <p className="text-cream/90 text-xs font-source-serif leading-relaxed">{flag.message}</p>
                          {flag.suggestion && (
                            <p className="text-cream/55 text-[11px] font-source-serif italic leading-relaxed mt-1">
                              {flag.suggestion}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {checkResult && !checkResult.canPublish && (
            <p className="text-amber-400 text-xs font-inter">
              Publishing is disabled until blockers are resolved.
            </p>
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href={`/book/${book.id}/preview`}
              className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors"
            >
              Preview Flipbook
            </Link>
            {checkResult && !checkResult.canPublish ? (
              <button
                disabled
                title="Resolve pre-publish blockers first"
                className="px-5 py-2.5 bg-gold/40 text-canvas/60 font-inter text-sm font-semibold rounded-md cursor-not-allowed"
              >
                Publish
              </button>
            ) : (
              <Link
                href={`/book/${book.id}/publish`}
                className="px-5 py-2.5 bg-gold hover:bg-gold/90 text-canvas font-inter text-sm font-semibold rounded-md transition-colors"
              >
                Publish
              </Link>
            )}
            <a
              href={`/api/books/${book.id}/export-pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-5 py-2.5 border border-[#333] hover:border-[#444] text-muted-foreground hover:text-cream font-inter text-sm rounded-md transition-colors"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </a>
            <a
              href={`/api/books/${book.id}/export-html`}
              className="flex items-center gap-1.5 px-5 py-2.5 border border-[#333] hover:border-[#444] text-muted-foreground hover:text-cream font-inter text-sm rounded-md transition-colors"
            >
              <Download className="w-4 h-4" />
              Export HTML
            </a>
          </div>

          {/* Forward step in the new stage order — Back Matter is the
              final polish after the pre-publish review. Surfaced as a
              quiet outlined button under the primary export/publish row
              so it doesn't compete with Publish for attention. */}
          {onContinueToBackMatter && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onContinueToBackMatter}
                className="text-xs font-inter text-cream/70 hover:text-cream transition-colors underline underline-offset-4 decoration-cream/30 hover:decoration-cream/60"
              >
                Continue to Back Matter →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto">
            <ImageIcon className="w-8 h-8 text-gold" />
          </div>
          <div>
            <h2 className="font-playfair text-3xl text-cream mb-2">
              {missingImageCount > 0 ? 'A few illustrations to go.' : 'All chapters approved.'}
            </h2>
            <p className="text-muted-foreground font-source-serif text-sm max-w-sm mx-auto">
              {missingImageCount > 0
                ? `${missingImageCount} chapter${missingImageCount !== 1 ? 's' : ''} still need illustrations. Open each chapter from the sidebar to generate or upload its image, then come back here to publish.`
                : 'Generate an illustration for every chapter to enable export and publishing.'}
            </p>
          </div>

          <div className="bg-[#222] border border-[#333] rounded-xl p-6 text-left space-y-3">
            <div className="flex items-center gap-2 text-sm font-inter text-cream/80">
              <ImageIcon className="w-4 h-4 text-gold" />
              <span>
                {missingImageCount > 0
                  ? `${missingImageCount} of ${pages.length} chapter${pages.length !== 1 ? 's' : ''} still need an illustration`
                  : `${approvedCount} chapter illustration${approvedCount !== 1 ? 's' : ''} ready`}
              </span>
            </div>
            <p className="text-xs font-source-serif text-muted-foreground">
              Style: {book.visual_style?.replace(/_/g, ' ')} · Persona: {book.persona}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
