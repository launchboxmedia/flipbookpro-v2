'use client'

import { useState } from 'react'
import { Loader2, X, Check, Wand2, ChevronRight, RefreshCw, AlertTriangle, GitMerge, Layout, GripVertical, Sparkles } from 'lucide-react'
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
    // Two-column 60/40 layout via grid-cols-5. Left chapter list (col-span-3
    // = 60%), right critique panel (col-span-2 = 40%). The critique panel
    // gets enough width to show flag cards with breathing room.
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 px-6 py-8 bg-cream-1 min-h-screen">
      {/* Left — chapter list (60%) */}
      <div className="md:col-span-3 min-w-0">
        <div className="mb-6">
          <p className="text-[10px] font-inter font-semibold text-gold-dim uppercase tracking-[0.2em] mb-2">
            Manuscript
          </p>
          <h2 className="font-playfair text-3xl text-ink-1 font-semibold">Outline</h2>
          <p className="text-ink-1/70 text-sm font-source-serif mt-1">
            Review your chapter structure before writing.
          </p>
        </div>

        <div className="space-y-2.5">
          {pages.map((page, i) => (
            <div
              key={page.id}
              className="flex items-start gap-3 p-4 bg-white border border-cream-3 rounded-xl group hover:border-gold/40 hover:shadow-[0_4px_18px_-6px_rgba(201,168,76,0.18)] transition-all cursor-default"
            >
              {/* Reorder handle — visible on hover, non-functional placeholder
                  for future drag/drop wiring. text-ink-1/30 keeps it visually
                  quiet on the white surface. */}
              <span
                aria-hidden="true"
                className="opacity-0 group-hover:opacity-100 text-ink-1/30 cursor-grab transition-opacity mt-1.5 shrink-0"
              >
                <GripVertical className="w-4 h-4" />
              </span>

              {/* Number badge — gold pill instead of muted text so the index
                  reads as deliberate metadata. */}
              <span className="w-7 h-7 rounded-md bg-gold text-ink-1 font-inter font-bold text-sm flex items-center justify-center shrink-0">
                {i + 1}
              </span>

              <div className="flex-1 min-w-0">
                <p className="font-inter font-semibold text-ink-1 text-base leading-snug">
                  {page.chapter_title}
                </p>
                {page.chapter_brief && (
                  // Bumped from /70 to /85 — at /70 on pure white the brief
                  // read as too muted. /85 keeps the visual hierarchy below
                  // the title while staying clearly legible.
                  <p className="text-ink-1/85 text-sm font-source-serif mt-1.5 leading-relaxed line-clamp-2">
                    {page.chapter_brief}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {page.approved && (
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                    title="Approved"
                  />
                )}
                <button
                  onClick={() => onNavigateChapter(i)}
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1 rounded-md bg-cream-2 hover:bg-gold/15 text-xs font-inter font-medium text-ink-1 transition-all"
                >
                  Write <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — critique panel (40%, ink-2 with gold header) */}
      <div className="md:col-span-2 min-w-0">
        <div className="sticky top-20 bg-ink-2 border border-ink-3 rounded-2xl overflow-hidden flex flex-col">
          {/* Header — gold accent so it reads as a distinct workspace,
              not a passing widget */}
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-ink-3 bg-ink-1/40">
            <Sparkles className="w-4 h-4 text-gold" />
            <h3 className="font-playfair text-cream text-lg font-semibold">AI Critique</h3>
            {visibleFlags.length > 0 && (
              <span className="ml-auto text-[11px] font-inter font-medium px-2 py-0.5 rounded-full bg-gold/15 text-gold">
                {visibleFlags.length} flag{visibleFlags.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="px-6 py-5 flex flex-col gap-4">
            {error && (
              <p className="text-rose-400 text-xs font-inter">{error}</p>
            )}

            {!hasCritiqued && !critiquing && (
              <p className="text-ink-subtle text-sm font-source-serif leading-relaxed">
                Run an AI structural critique to surface chapter overlap, gaps,
                and reordering opportunities before you start writing.
              </p>
            )}

            {critiquing && (
              <div className="flex items-center gap-2 py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-gold" />
                <span className="text-ink-subtle text-sm font-inter">Analysing structure…</span>
              </div>
            )}

            {!critiquing && visibleFlags.length > 0 && (
              <div className="space-y-3">
                {visibleFlags.map((flag) => {
                  const originalIndex = flags.indexOf(flag)
                  const flagType: FlagType = (flag.type as FlagType) ?? 'STRUCTURE'
                  const meta = FLAG_META[flagType] ?? FLAG_META.STRUCTURE
                  return (
                    <div
                      key={originalIndex}
                      className="bg-ink-3/70 border border-ink-4 rounded-xl p-4"
                    >
                      <div className="flex items-center gap-2 mb-2.5">
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
                      <p className="text-cream text-sm font-source-serif mb-1.5 leading-relaxed">
                        {flag.issue}
                      </p>
                      <p className="text-cream/60 text-xs font-source-serif italic mb-3 leading-relaxed">
                        {flag.suggestion}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => applyFlag(flag, originalIndex)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-inter font-medium rounded-md transition-colors press-scale"
                        >
                          <Check className="w-3 h-3" />
                          Apply
                        </button>
                        <button
                          onClick={() => dismissFlag(originalIndex)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-4 hover:bg-ink-3 text-ink-subtle hover:text-cream text-xs font-inter rounded-md transition-colors press-scale"
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
              <p className="text-emerald-400 text-sm font-inter py-2 flex items-center gap-2">
                <Check className="w-4 h-4" />
                No structural issues found.
              </p>
            )}

            {/* Action buttons — pinned at the bottom of the inner column */}
            <div className="flex flex-col gap-2 pt-2 border-t border-ink-3 -mx-6 px-6 -mb-5 pb-5 mt-1">
              <button
                onClick={runCritique}
                disabled={critiquing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-ink-3 hover:bg-ink-4 border border-ink-4 text-cream text-sm font-inter rounded-md transition-colors disabled:opacity-50 press-scale"
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
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 text-sm font-inter font-semibold rounded-md transition-colors press-scale"
                >
                  Proceed to Writing <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
