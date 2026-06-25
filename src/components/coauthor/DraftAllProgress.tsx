'use client'

import { Loader2, X } from 'lucide-react'
import type { DraftAllState } from '@/hooks/useDraftAll'

const STEP_LABELS: Record<string, string> = {
  draft:   'Writing draft...',
  image:   'Generating illustration...',
  approve: 'Approving...',
}

interface Props {
  state: DraftAllState
  onCancel: () => void
  onResolveError: (choice: 'skip' | 'stop') => void
}

export function DraftAllProgress({ state, onCancel, onResolveError }: Props) {
  const { currentIndex, totalCount, currentStep, currentChapterTitle, error } = state
  const pct = totalCount > 0 ? Math.round((currentIndex / totalCount) * 100) : 0

  return (
    <div className="rounded-xl border border-cream-3 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between mb-4">
        <p className="font-playfair text-lg text-ink-1 font-semibold">Drafting your book...</p>
        {!error && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel drafting"
            className="p-1.5 rounded-md text-ink-1/50 hover:text-ink-1 hover:bg-cream-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error ? (
        <div className="space-y-3">
          <p className="text-rose-700 text-sm font-inter font-semibold">
            {error.canSkip
              ? `Draft failed on "${error.chapterTitle}". Fix it manually or skip and continue.`
              : `Could not approve "${error.chapterTitle}". Try again later.`}
          </p>
          <p className="text-rose-600/70 text-xs font-source-serif">{error.message}</p>
          <div className="flex gap-2">
            {error.canSkip && (
              <button
                type="button"
                onClick={() => onResolveError('skip')}
                className="px-3 py-1.5 bg-cream-2 hover:bg-cream-3 text-ink-1 text-xs font-inter font-semibold rounded-md transition-colors"
              >
                Skip Chapter
              </button>
            )}
            <button
              type="button"
              onClick={() => onResolveError('stop')}
              className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-inter font-semibold rounded-md transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-inter text-sm text-ink-1/70">
              Chapter {currentIndex + 1} of {totalCount}
            </span>
            <span className="font-inter text-sm text-ink-1/70">{pct}%</span>
          </div>
          <div className="h-2 bg-cream-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-gold animate-spin shrink-0" />
            <p className="text-ink-1/70 text-sm font-source-serif">
              <span className="font-inter font-medium text-ink-1">
                &ldquo;{currentChapterTitle}&rdquo;
              </span>
              {' — '}
              {STEP_LABELS[currentStep] ?? 'Working...'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
