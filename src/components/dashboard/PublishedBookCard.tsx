'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { BookOpen, ExternalLink, Settings, BarChart2, Loader2 } from 'lucide-react'
import { CopyLinkButton } from './CopyLinkButton'

interface SurveyData {
  surveyQuestion: string | null
  surveyOptions: string[]
  surveyCounts: Record<string, number>
  surveyRespondents: number
}

interface Props {
  bookId: string
  title: string
  coverImageUrl: string | null
  leads: number
  slug: string
  landingHref: string
  landingDisplayText: string
  cardIndex: number
}

export function PublishedBookCard({
  bookId,
  title,
  coverImageUrl,
  leads,
  slug,
  landingHref,
  landingDisplayText,
  cardIndex,
}: Props) {
  const [open, setOpen] = useState(false)
  const [survey, setSurvey] = useState<SurveyData | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!open || fetchedRef.current) return
    fetchedRef.current = true
    fetch(`/api/books/${bookId}/analytics`)
      .then(r => (r.ok ? r.json() : null))
      .then(data =>
        setSurvey(
          data ?? { surveyQuestion: null, surveyOptions: [], surveyCounts: {}, surveyRespondents: 0 },
        ),
      )
      .catch(() =>
        setSurvey({ surveyQuestion: null, surveyOptions: [], surveyCounts: {}, surveyRespondents: 0 }),
      )
  }, [open, bookId])

  const maxCount = survey ? Math.max(1, ...Object.values(survey.surveyCounts)) : 1
  const loading = open && survey === null

  return (
    <div
      style={{ '--card-index': cardIndex } as React.CSSProperties}
      className="dash-card flex flex-col bg-cream-2 dark:bg-ink-2 rounded-xl border border-cream-3 dark:border-ink-4 transition-colors duration-220 mb-3 overflow-hidden hover:border-cream-3 dark:hover:border-ink-3"
    >
      {/* ── Main row ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 p-5">
        {/* Cover thumb */}
        {coverImageUrl ? (
          <div className="relative w-10 aspect-[2/3] bg-ink-3 dark:bg-ink-2 rounded overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImageUrl} alt={`${title} cover`} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-10 h-14 rounded bg-cream-3 dark:bg-ink-3 flex items-center justify-center text-gold shrink-0" aria-hidden="true">
            <BookOpen className="w-4 h-4" />
          </div>
        )}

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <h3 className="text-ink-1 dark:text-white font-semibold text-base truncate">{title}</h3>
          {leads > 0 ? (
            <p className="text-gold text-sm">{leads} reader{leads === 1 ? '' : 's'}</p>
          ) : (
            <>
              <p className="text-ink-1/30 dark:text-white/30 text-sm">No readers yet</p>
              <p className="text-ink-1/30 dark:text-white/30 text-xs">Share your link to get your first reader</p>
            </>
          )}
          <p className="text-ink-1/20 dark:text-white/20 text-xs truncate">{landingDisplayText}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 shrink-0">
          <a
            href={`/read/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-ink-1/50 dark:text-white/60 hover:text-ink-1 dark:hover:text-white transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Read
          </a>
          <a
            href={landingHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-ink-1/50 dark:text-white/60 hover:text-ink-1 dark:hover:text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Landing Page
          </a>
          <Link
            href={`/book/${bookId}/publish`}
            className="flex items-center gap-1.5 text-xs text-ink-1/50 dark:text-white/60 hover:text-ink-1 dark:hover:text-white transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Update Publishing
          </Link>
          <CopyLinkButton url={landingHref} prominent={leads === 0} />
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              open
                ? 'text-gold'
                : 'text-ink-1/50 dark:text-white/60 hover:text-ink-1 dark:hover:text-white'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Insights
          </button>
        </div>
      </div>

      {/* ── Expandable insights panel ─────────────────────────────── */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="bg-ink-2 border-t border-ink-3 px-5 py-4">
            {loading ? (
              <div className="flex items-center gap-2 text-white/30 py-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-xs font-inter">Loading…</span>
              </div>
            ) : !survey || survey.surveyOptions.length === 0 ? (
              <p className="text-white/25 text-xs font-inter py-1">No audience data yet</p>
            ) : (
              <div>
                {survey.surveyQuestion && (
                  <p className="text-white/35 text-[10px] font-inter uppercase tracking-wider mb-3">
                    {survey.surveyQuestion}
                  </p>
                )}
                <div className="space-y-3">
                  {survey.surveyOptions.map(opt => {
                    const count = survey.surveyCounts[opt] ?? 0
                    const barPct = Math.round((count / maxCount) * 100)
                    const sharePct =
                      survey.surveyRespondents > 0
                        ? Math.round((count / survey.surveyRespondents) * 100)
                        : 0
                    return (
                      <div key={opt}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-white/60 text-xs font-inter">{opt}</span>
                          <span className="text-white/30 text-xs font-inter tabular-nums">
                            {count} · {sharePct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-ink-4 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gold rounded-full transition-[width] duration-500 ease-out"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {survey.surveyRespondents === 0 && (
                  <p className="text-white/20 text-xs font-inter mt-3">No audience data yet</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
