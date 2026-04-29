'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, Image, Sparkles, FileText, Download, ShieldCheck, AlertCircle, Info, Zap } from 'lucide-react'
import Link from 'next/link'
import type { Book, BookPage } from '@/types/database'

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
}

export function CompleteStage({ book, pages }: Props) {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [bulkDone, setBulkDone] = useState(book.status === 'ready')
  const [error, setError] = useState('')

  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [checkError, setCheckError] = useState('')

  const approvedCount = pages.filter((p) => p.approved).length
  // Treat the book as ready for export/publish whenever every chapter has an
  // image — the typical flow now generates images per-chapter from the
  // ChapterStage, so book.status never gets flipped to 'ready'.
  const allHaveImages = pages.length > 0 && pages.every((p) => !!p.image_url)
  const missingImageCount = pages.filter((p) => !p.image_url).length
  const done = bulkDone || allHaveImages

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

  async function generateImages() {
    setGenerating(true)
    setError('')
    setProgress(0)

    try {
      const res = await fetch(`/api/books/${book.id}/generate-images`, {
        method: 'POST',
      })

      if (!res.ok) throw new Error('Image generation failed')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Stream unavailable')
      const decoder = new TextDecoder()

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.progress !== undefined) setProgress(data.progress)
            if (data.done) { setBulkDone(true); setGenerating(false) }
          } catch {
            // partial JSON line, skip
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-16 text-center">
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
        </div>
      ) : (
        <div className="space-y-8">
          <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-gold" />
          </div>
          <div>
            <h2 className="font-playfair text-3xl text-cream mb-2">All chapters approved.</h2>
            <p className="text-muted-foreground font-source-serif text-sm max-w-sm mx-auto">
              {missingImageCount > 0
                ? `${missingImageCount} chapter${missingImageCount !== 1 ? 's' : ''} still need illustrations. Generate them in bulk, or jump back into a chapter to generate or upload one manually.`
                : 'Generate illustrations for every chapter to enable export and publishing.'}
            </p>
          </div>

          <div className="bg-[#222] border border-[#333] rounded-xl p-6 text-left space-y-3">
            <div className="flex items-center gap-2 text-sm font-inter text-cream/80">
              <Image className="w-4 h-4 text-gold" />
              <span>
                {missingImageCount > 0
                  ? `${missingImageCount} chapter illustration${missingImageCount !== 1 ? 's' : ''} to generate`
                  : `${approvedCount} chapter illustration${approvedCount !== 1 ? 's' : ''} to generate`}
              </span>
            </div>
            <p className="text-xs font-source-serif text-muted-foreground">
              Style: {book.visual_style?.replace(/_/g, ' ')} · Persona: {book.persona}
            </p>
          </div>

          {generating && (
            <div className="space-y-2">
              <div className="bg-[#2A2A2A] rounded-full h-2">
                <div
                  className="bg-gold h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs font-inter text-muted-foreground">
                {progress}% — generating illustrations...
              </p>
            </div>
          )}

          {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

          <button
            onClick={generateImages}
            disabled={generating}
            className="flex items-center gap-2 mx-auto px-8 py-3 bg-gold hover:bg-gold/90 text-canvas font-inter font-semibold rounded-md transition-colors disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating ? 'Generating...' : 'Generate Illustrations'}
          </button>
        </div>
      )}
    </div>
  )
}
