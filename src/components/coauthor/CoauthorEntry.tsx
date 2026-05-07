'use client'

import { useEffect, useRef, useState } from 'react'
import type { Book, BookPage } from '@/types/database'
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
 *    1. RadarInterstitial in 'waiting' phase — radar has never run on
 *       this book, so we fire the per-book Creator Radar here (where
 *       every wizard field is fully saved to the DB) and let the
 *       interstitial poll books.creator_radar_data until it lands.
 *    2. RadarInterstitial in 'ready' phase — radar data exists on the
 *       row but the user hasn't acted on it yet (radar_applied_at is null).
 *    3. CoauthorShell — once the interstitial completes, whenever
 *       radar_applied_at is already set, or for legacy books without
 *       any radar data and no firing capability (e.g. missing API key).
 *
 *  The interstitial's onComplete callback re-fetches the book and
 *  swaps in the shell. The shell receives the freshly-fetched book so
 *  downstream stages (OutlineStage, etc.) see the applied radar
 *  context immediately. */
export function CoauthorEntry(props: Props) {
  const [book, setBook] = useState<Book>(props.book)
  const [pages, setPages] = useState<BookPage[]>(props.pages)

  // Track whether we've kicked off the deep radar fire from this client
  // mount. Without this we'd re-fire on every render. Local-only — the
  // interstitial polls the DB to detect the result regardless of whether
  // this flag is set.
  const radarFireInitiatedRef = useRef(false)

  // First-entry deep radar fire. Triggers when the book has never run
  // radar (creator_radar_ran_at is null) AND the user hasn't already
  // dismissed the interstitial in a prior visit (radar_applied_at is
  // null). Fire-and-forget — the SSE drains in the background and lands
  // creator_radar_data on the row; the interstitial's polling loop
  // picks it up and transitions from 'waiting' to 'ready'.
  useEffect(() => {
    if (radarFireInitiatedRef.current) return
    if (book.radar_applied_at) return
    if (book.creator_radar_ran_at) return
    radarFireInitiatedRef.current = true
    void (async () => {
      try {
        const res = await fetch(`/api/books/${book.id}/creator-radar`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refresh: false }),
        })
        const reader = res.body?.getReader()
        if (!reader) return
        // Drain — we only need the route's persistence side-effect to
        // complete (intelligence_cache + books.creator_radar_data).
        // The interstitial reads books.creator_radar_data on its poll.
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      } catch {
        // Silent — radar enhances but doesn't gate. If the fire fails,
        // the interstitial's poll will time out and fall through to
        // CoauthorShell with no per-book context.
      }
    })()
  }, [book.id, book.radar_applied_at, book.creator_radar_ran_at])

  // Interstitial gate. Show whenever the user hasn't acted on radar yet,
  // regardless of whether data has landed. The interstitial itself
  // distinguishes 'waiting' (no data yet) from 'ready' (data present)
  // and polls books.creator_radar_data for the transition.
  const showInterstitial = !book.radar_applied_at

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

  if (showInterstitial) {
    return (
      <RadarInterstitial
        book={book}
        onComplete={handleInterstitialComplete}
      />
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
