'use client'

import { useState } from 'react'
import { Loader2, X, Check, Wand2, ChevronRight, RefreshCw, AlertTriangle, GitMerge, Layout } from 'lucide-react'
import type { Book, BookPage } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

type FlagType = 'OVERLAP' | 'GAP' | 'STRUCTURE'

interface CritiqueFlag {
  type?: FlagType
  issue: string
  suggestion: string
  chapterIndex: number | null
}

interface Props {
  book: Book
  pages: BookPage[]
  onPagesChange: (pages: BookPage[]) => void
  onNavigateChapter: (index: number) => void
}

const FLAG_META: Record<FlagType, { label: string; color: string; icon: React.ReactNode }> = {
  OVERLAP: {
    label: 'OVERLAP',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <GitMerge className="w-3 h-3" />,
  },
  GAP: {
    label: 'GAP',
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  STRUCTURE: {
    label: 'STRUCTURE',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Layout className="w-3 h-3" />,
  },
}

export function OutlineStage({ book, pages, onPagesChange, onNavigateChapter }: Props) {
  const [critiquing, setCritiquing] = useState(false)
  const [flags, setFlags] = useState<CritiqueFlag[]>([])
  const [dismissedFlags, setDismissedFlags] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [hasCritiqued, setHasCritiqued] = useState(false)

  async function runCritique() {
    setCritiquing(true)
    setError('')
    setFlags([])
    setDismissedFlags(new Set())
    try {
      const res = await fetch(`/api/books/${book.id}/critique`, { method: 'POST' })
      const json = await res.json()
      setFlags(json.flags ?? [])
      setHasCritiqued(true)
    } catch {
      setError('Critique failed. Please try again.')
    } finally {
      setCritiquing(false)
    }
  }

  async function applyFlag(flag: CritiqueFlag, flagIndex: number) {
    if (flag.chapterIndex === null || flag.chapterIndex >= pages.length) {
      dismissFlag(flagIndex)
      return
    }
    const page = pages[flag.chapterIndex]
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('book_pages')
      .update({ chapter_brief: flag.suggestion })
      .eq('id', page.id)

    if (updateError) {
      setError('Could not apply this suggestion. Try again.')
      return
    }

    const updatedPages = pages.map((p, i) =>
      i === flag.chapterIndex ? { ...p, chapter_brief: flag.suggestion } : p,
    )
    onPagesChange(updatedPages)
    dismissFlag(flagIndex)
  }

  function dismissFlag(i: number) {
    setDismissedFlags((prev) => {
      const next = new Set(prev)
      next.add(i)
      return next
    })
  }

  const visibleFlags = flags.filter((_, i) => !dismissedFlags.has(i))

  return (
    <div className="flex gap-6 px-6 py-8 min-h-0 bg-cream-1 min-h-screen">
      {/* Left — chapter list */}
      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <p className="text-[10px] font-inter font-semibold text-gold-dim uppercase tracking-[0.2em] mb-2">
            Manuscript
          </p>
          <h2 className="font-playfair text-3xl text-ink-1">Outline</h2>
          <p className="text-ink-1/60 text-sm font-source-serif mt-1">
            Review your chapter structure before writing.
          </p>
        </div>

        <div className="space-y-2">
          {pages.map((page, i) => (
            <div
              key={page.id}
              className="flex items-start gap-3 p-4 bg-white border border-cream-3 rounded-xl group hover:border-gold/40 hover:shadow-[0_4px_18px_-6px_rgba(201,168,76,0.18)] transition-all cursor-default"
            >
              <span className="text-gold-dim font-inter font-semibold text-sm w-6 shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-inter font-medium text-ink-1 text-sm">{page.chapter_title}</p>
                {page.chapter_brief && (
                  <p className="text-ink-1/60 text-xs font-source-serif mt-1 leading-relaxed line-clamp-2">
                    {page.chapter_brief}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {page.approved && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600" title="Approved" />
                )}
                <button
                  onClick={() => onNavigateChapter(i)}
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs font-inter text-gold-dim hover:text-ink-1 transition-all"
                >
                  Write <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — critique panel (dark for contrast) */}
      <div className="w-80 shrink-0 flex flex-col">
        <div className="sticky top-8 flex flex-col gap-3 bg-ink-1 border border-ink-3 rounded-2xl p-5">
          <p className="font-inter font-semibold text-cream text-sm">AI Critique</p>

          {error && (
            <p className="text-rose-400 text-xs font-inter">{error}</p>
          )}

          {/* Empty / initial state */}
          {!hasCritiqued && !critiquing && (
            <p className="text-ink-subtle text-xs font-source-serif leading-relaxed py-2">
              Click <span className="text-cream font-inter font-medium">Critique Outline</span> when
              you&apos;re ready for structural feedback.
            </p>
          )}

          {/* Loading */}
          {critiquing && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-gold" />
              <span className="text-ink-subtle text-xs font-inter">Analysing structure…</span>
            </div>
          )}

          {/* Flags */}
          {!critiquing && visibleFlags.length > 0 && (
            <div className="space-y-3">
              {visibleFlags.map((flag) => {
                const originalIndex = flags.indexOf(flag)
                const flagType: FlagType = (flag.type as FlagType) ?? 'STRUCTURE'
                const meta = FLAG_META[flagType] ?? FLAG_META.STRUCTURE
                return (
                  <div
                    key={originalIndex}
                    className="bg-ink-2 border border-ink-3 rounded-xl p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-inter font-semibold border ${meta.color}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                      {flag.chapterIndex !== null && (
                        <span className="text-[10px] font-inter text-ink-subtle">
                          Ch. {flag.chapterIndex + 1}
                        </span>
                      )}
                    </div>
                    <p className="text-cream/85 text-xs font-source-serif mb-1 leading-relaxed">
                      {flag.issue}
                    </p>
                    <p className="text-cream/50 text-[11px] font-source-serif italic mb-3 leading-relaxed">
                      {flag.suggestion}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => applyFlag(flag, originalIndex)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-inter rounded-md transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Apply
                      </button>
                      <button
                        onClick={() => dismissFlag(originalIndex)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-3 hover:bg-ink-4 text-ink-subtle text-[11px] font-inter rounded-md transition-colors"
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

          {!critiquing && hasCritiqued && visibleFlags.length === 0 && (
            <p className="text-emerald-400 text-xs font-inter py-2 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              No structural issues found.
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={runCritique}
              disabled={critiquing}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-ink-3 hover:bg-ink-4 border border-ink-4 text-cream text-xs font-inter rounded-md transition-colors disabled:opacity-50"
            >
              {critiquing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : hasCritiqued ? (
                <RefreshCw className="w-3.5 h-3.5 text-gold" />
              ) : (
                <Wand2 className="w-3.5 h-3.5 text-gold" />
              )}
              {hasCritiqued ? 'Update Critique' : 'Critique Outline'}
            </button>

            {pages.length > 0 && (
              <button
                onClick={() => onNavigateChapter(0)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 text-xs font-inter font-semibold rounded-md transition-colors"
              >
                Proceed to Writing <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
