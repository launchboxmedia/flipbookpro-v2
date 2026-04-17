'use client'

import { useState } from 'react'
import { Loader2, X, Check, Wand2, GripVertical, ChevronRight } from 'lucide-react'
import type { Book, BookPage } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface CritiqueFlag {
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

export function OutlineStage({ book, pages, onPagesChange, onNavigateChapter }: Props) {
  const [critiquing, setCritiquing] = useState(false)
  const [flags, setFlags] = useState<CritiqueFlag[]>([])
  const [dismissedFlags, setDismissedFlags] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')

  async function runCritique() {
    setCritiquing(true)
    setError('')
    setFlags([])
    try {
      const res = await fetch(`/api/books/${book.id}/critique`, { method: 'POST' })
      const json = await res.json()
      setFlags(json.flags ?? [])
    } catch {
      setError('Critique failed. Check your API key.')
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
    const newBrief = flag.suggestion
    await supabase
      .from('book_pages')
      .update({ chapter_brief: newBrief })
      .eq('id', page.id)

    const updatedPages = pages.map((p, i) =>
      i === flag.chapterIndex ? { ...p, chapter_brief: newBrief } : p
    )
    onPagesChange(updatedPages)
    dismissFlag(flagIndex)
  }

  function dismissFlag(i: number) {
    setDismissedFlags((prev) => new Set(Array.from(prev).concat(i)))
  }

  const visibleFlags = flags.filter((_, i) => !dismissedFlags.has(i))

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-playfair text-3xl text-cream">Outline</h2>
          <p className="text-muted-foreground text-sm font-source-serif mt-1">
            Review your chapter structure before writing.
          </p>
        </div>
        <button
          onClick={runCritique}
          disabled={critiquing}
          className="flex items-center gap-2 px-4 py-2 bg-[#2A2A2A] hover:bg-[#333] border border-[#333] text-cream text-sm font-inter rounded-md transition-colors disabled:opacity-60"
        >
          {critiquing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-gold" />}
          {critiquing ? 'Analysing...' : 'AI Critique'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm font-inter mb-4">{error}</p>}

      {visibleFlags.length > 0 && (
        <div className="mb-6 space-y-3">
          <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">
            Structural Feedback
          </p>
          {visibleFlags.map((flag, i) => {
            const originalIndex = flags.indexOf(flag)
            return (
              <div
                key={originalIndex}
                className="bg-gold/5 border border-gold/20 rounded-xl p-4"
              >
                {flag.chapterIndex !== null && (
                  <p className="text-xs font-inter text-gold/70 mb-1">
                    Chapter {flag.chapterIndex + 1}
                  </p>
                )}
                <p className="text-cream/80 text-sm font-source-serif mb-1">{flag.issue}</p>
                <p className="text-cream/60 text-xs font-source-serif italic mb-3">{flag.suggestion}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => applyFlag(flag, originalIndex)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 hover:bg-accent/30 text-accent text-xs font-inter rounded-md transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    Apply
                  </button>
                  <button
                    onClick={() => dismissFlag(originalIndex)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#333] text-muted-foreground text-xs font-inter rounded-md transition-colors"
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

      <div className="space-y-2">
        {pages.map((page, i) => (
          <div
            key={page.id}
            className="flex items-start gap-3 p-4 bg-[#222] border border-[#333] rounded-xl group hover:border-[#444] transition-colors"
          >
            <span className="text-muted-foreground font-inter text-sm w-6 shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-inter font-medium text-cream text-sm">{page.chapter_title}</p>
              {page.chapter_brief && (
                <p className="text-muted-foreground text-xs font-source-serif mt-1 leading-relaxed">
                  {page.chapter_brief}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {page.approved && (
                <span className="w-2 h-2 rounded-full bg-accent" title="Approved" />
              )}
              <button
                onClick={() => onNavigateChapter(i)}
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs font-inter text-accent hover:text-accent/80 transition-all"
              >
                Write <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {pages.length > 0 && (
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => onNavigateChapter(0)}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors"
          >
            Start Writing <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
