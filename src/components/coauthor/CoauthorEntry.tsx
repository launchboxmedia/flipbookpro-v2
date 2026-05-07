'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Book, BookPage, RadarAppliedSelections } from '@/types/database'
import { AppShell } from '@/components/layout/AppShell'
import { CoauthorShell, type CoauthorStage } from './CoauthorShell'
import { RadarInterstitial } from './RadarInterstitial'
import { createClient } from '@/lib/supabase/client'

interface Props {
  book: Book
  pages: BookPage[]
  userEmail: string
  isPremium?: boolean
  isAdmin?: boolean
  radarPlan?: 'free' | 'standard' | 'pro'
  initialStage?: CoauthorStage
}

/** Client wrapper that gates entry to the coauthor flow.
 *
 *  Three possible mounts:
 *    1. RadarInterstitial — when radar_applied_at is null AND there's
 *       either creator_radar_data on the row OR a deep-radar fetch is
 *       still in flight (the wizard fired one in the background).
 *    2. CoauthorShell — once the interstitial completes, or whenever
 *       radar_applied_at is already set, or when no radar data exists.
 *
 *  The interstitial's onComplete callback re-fetches the book and
 *  swaps in the shell. The shell receives the freshly-fetched book so
 *  downstream stages (OutlineStage, etc.) see the applied radar
 *  context immediately. */
export function CoauthorEntry(props: Props) {
  const [book, setBook] = useState<Book>(props.book)
  const [pages, setPages] = useState<BookPage[]>(props.pages)

  // Interstitial gate: radar data exists but hasn't been acted on.
  const showInterstitial = !book.radar_applied_at && !!book.creator_radar_data

  async function handleInterstitialComplete() {
    // Re-fetch the book + pages — the route updated radar_context,
    // back_cover_*, and possibly target_audience. The shell needs
    // these for OutlineStage's auto-generation prompt.
    try {
      const supabase = createClient()
      const [{ data: freshBook }, { data: freshPages }] = await Promise.all([
        supabase.from('books').select('*').eq('id', book.id).maybeSingle<Book>(),
        supabase.from('book_pages').select('*').eq('book_id', book.id).order('chapter_index', { ascending: true }),
      ])
      if (freshBook) setBook(freshBook)
      if (freshPages) setPages(freshPages as BookPage[])
    } catch {
      // If the re-fetch fails, fall through anyway — the shell will
      // eventually re-render with the in-memory book; the user can
      // refresh the page if something looks stale.
    }
  }

  // Skip = mark all selections false and persist via apply-radar so the
  // route still records radar_applied_at, dismissing the interstitial
  // permanently. Lifted out of RadarInterstitial so the AppShell header
  // Skip button (which lives outside the component) can trigger the
  // same code path.
  async function handleSkip() {
    try {
      const all: RadarAppliedSelections = {
        targetAudience: false, chapterStructure: false, backCover: false,
        openingHook: false, monetization: false,
      }
      await fetch(`/api/books/${book.id}/apply-radar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ selections: all }),
      })
    } catch {
      // Fail silently — the route sets radar_applied_at on success, and
      // even on partial failure the user proceeds via the re-fetch below.
    }
    await handleInterstitialComplete()
  }

  if (showInterstitial) {
    return (
      <AppShell
        userEmail={props.userEmail}
        isPremium={props.isPremium}
        isAdmin={props.isAdmin}
        pageTitle={book.title || 'Market Intelligence'}
        headerRight={
          <button
            type="button"
            onClick={() => void handleSkip()}
            className="inline-flex items-center gap-1 text-xs font-inter text-ink-subtle hover:text-cream-1 transition-colors"
          >
            Skip
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        }
      >
        <RadarInterstitial
          book={book}
          onComplete={handleInterstitialComplete}
          onSkip={handleSkip}
        />
      </AppShell>
    )
  }

  return (
    <CoauthorShell
      book={book}
      pages={pages}
      userEmail={props.userEmail}
      isPremium={props.isPremium}
      isAdmin={props.isAdmin}
      radarPlan={props.radarPlan}
      initialStage={props.initialStage}
    />
  )
}
