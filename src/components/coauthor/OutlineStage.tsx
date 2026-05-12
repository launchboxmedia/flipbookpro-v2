'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { BookOpen, Loader2, X, Check, Wand2, ChevronRight, RefreshCw, AlertTriangle, GitMerge, Layout, GripVertical, Sparkles, Plus, ArrowRight, Megaphone, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Book, BookPage } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

type FlagType = 'OVERLAP' | 'GAP' | 'STRUCTURE'

/** Action data drives what the Apply button actually does. The route
 *  asks Sonnet to emit one of these per flag; the OutlineStage
 *  applyFlag handler switches on `action` and dispatches to the
 *  appropriate Supabase RPC (or direct update for `update_brief`).
 *  Each action carries the structured payload it needs — chapter
 *  indices are 0-based and refer to book_pages.chapter_index. */
type CritiqueAction = 'merge' | 'insert' | 'reorder' | 'update_brief'

interface CritiqueFlag {
  type?: FlagType
  issue: string
  suggestion: string
  chapterIndex: number | null
  /** Which mutation to perform on Apply. May be undefined on legacy
   *  flags — the handler treats unknown/missing actions as a no-op
   *  dismiss so old cached results can't crash. */
  action?: CritiqueAction
  // OVERLAP → action: 'merge'
  source_indices?: number[]
  merged_title?: string
  merged_brief?: string
  // GAP → action: 'insert'
  insert_after_index?: number
  new_title?: string
  new_brief?: string
  // STRUCTURE → action: 'reorder' (uses swap_chapters_at — two indices
  // exchange positions; not a multi-position shift) OR 'update_brief'.
  from_index?: number
  to_index?: number
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

/** Default CTA chapter copy seeded by persona. The user can edit the chapter
 *  brief before writing — this just gives Sonnet something on-tone to start
 *  from. Business gets a sales-flavoured CTA; storyteller gets a community
 *  / next-book hook; everyone else gets a generic next-step prompt. */
function ctaSeedFor(persona: string | null): { title: string; brief: string } {
  if (persona === 'business') {
    return {
      title: 'Your Next Step',
      brief: "Wrap the journey by inviting the reader into the next move — schedule a call, request the free guide, or sign up for the offer mentioned earlier. Make the action specific, low-friction, and tied directly to the transformation the book promised.",
    }
  }
  if (persona === 'storyteller') {
    return {
      title: 'Where to Find More',
      brief: "Close the book by pointing readers toward your next story, your community, or the place they can hear from you again. Keep it warm — readers who finish should feel like they're being invited to stay close, not sold to.",
    }
  }
  return {
    title: 'Your Next Step',
    brief: "Close the book by giving the reader a clear, single next action that builds on what they've just learned. Keep it specific and low-friction — one thing they can do today.",
  }
}

export function OutlineStage({ book, pages, onPagesChange, onNavigateChapter }: Props) {
  const [critiquing, setCritiquing] = useState(false)
  const [flags, setFlags] = useState<CritiqueFlag[]>([])
  const [dismissedFlags, setDismissedFlags] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [hasCritiqued, setHasCritiqued] = useState(false)
  // Per-flag Apply state. Holds the index of the flag currently being
  // applied so its row can show a spinner; every other Apply button is
  // disabled while a mutation is in flight to prevent racing two
  // structural changes against the same outline.
  const [applyingFlagIndex, setApplyingFlagIndex] = useState<number | null>(null)

  // Target audience editor — sits above the chapter list. The radar's
  // inferred reader-pain string lives in book.radar_audience_insight (a
  // separate column); this textarea writes to the user-owned
  // target_audience column. Save fires on blur, only when the trimmed
  // value differs from what's persisted, so editing without changing
  // doesn't burn a network round-trip.
  const [targetAudience, setTargetAudience] = useState(book.target_audience ?? '')
  const [audienceSaving, setAudienceSaving] = useState(false)
  const [audienceSaved, setAudienceSaved]   = useState(false)
  const lastSavedAudience = useRef(book.target_audience ?? '')

  async function saveAudienceOnBlur() {
    const trimmed = targetAudience.trim()
    if (trimmed === lastSavedAudience.current) return
    setAudienceSaving(true)
    try {
      const supabase = createClient()
      const { error: updateErr } = await supabase
        .from('books')
        .update({ target_audience: trimmed.length > 0 ? trimmed : null, updated_at: new Date().toISOString() })
        .eq('id', book.id)
      if (!updateErr) {
        lastSavedAudience.current = trimmed
        setAudienceSaved(true)
        // Brief visual confirmation, then fade out. No persisted state —
        // refreshing the page resets the indicator regardless of save.
        window.setTimeout(() => setAudienceSaved(false), 1800)
      }
    } finally {
      setAudienceSaving(false)
    }
  }

  // Pending-review state for chapters auto-generated from radar.
  // Local-only: not persisted, resets on remount. The DB-side signal is
  // book.radar_applied_at + every chapter unapproved; once any chapter
  // gets written and approved, pendingMode flips off and these fall away.
  const [acceptedIds, setAcceptedIds]   = useState<Set<string>>(new Set())
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [removingId, setRemovingId]     = useState<string | null>(null)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editTitle, setEditTitle]       = useState('')
  const [editBrief, setEditBrief]       = useState('')
  const [editSaving, setEditSaving]     = useState(false)
  // When true, the AI Critique column renders even during pendingMode.
  // Set by the launch-banner's "Critique Outline" CTA so the user can
  // pull the critique up alongside the banner without leaving the
  // review state. Local-only; resets on remount.
  const [skipPendingGate, setSkipPendingGate] = useState(false)

  // Split chapters into the regular sequence (0..N) and the CTA sentinel
  // chapter (index 99). Regular chapters render in the main list; the CTA
  // sits below in its own card.
  const regularPages = pages.filter((p) => p.chapter_index < 99)
  const ctaPage      = pages.find((p) => p.chapter_index === 99) ?? null

  // Radar-suggested-chapters review mode. Active when the user has
  // applied the radar (so chapters were auto-generated from radar
  // context) AND none of those chapters has been approved yet (which
  // happens when the user writes content in ChapterStage). The first
  // approval flips this off and the per-card pending actions vanish.
  const pendingMode = !!book.radar_applied_at
    && regularPages.length > 0
    && regularPages.every((p) => !p.approved)
  // Banner visible whenever the user is in radar-review mode. It changes
  // copy + CTA based on whether every chapter has been locally accepted:
  // before that, it's a review prompt with Accept All; after, it's a
  // launch prompt with Start Writing. Removed chapters drop out of
  // regularPages, so the every() naturally narrows as the user works
  // through the list.
  const showPendingBanner = pendingMode && regularPages.length > 0
  const allChaptersAccepted = regularPages.length > 0
    && regularPages.every((p) => acceptedIds.has(p.id))

  // Auto-outline state. Fires once when the user lands on the outline stage
  // with no chapters at all — radar context already on book.radar_context
  // (or nothing) seeds the prompt server-side.
  const [autoGenerating, setAutoGenerating] = useState(false)
  const [autoError, setAutoError] = useState('')
  // When the user opts out of auto-generation (or after timeout), we
  // stop spinning and show the manual-build empty state. Also the
  // escape hatch from the loading panel.
  const [manualMode, setManualMode] = useState(false)
  // Hard ceiling on generation. The server route's maxDuration is 60s and
  // Sonnet at 4000 tokens routinely takes 15-30s, occasionally longer on
  // cold starts. 55s here gives the server room to actually finish before
  // the client gives up — previously we were aborting at 20s while the
  // route was still mid-Sonnet, dropping perfectly good responses on the
  // floor.
  const GENERATION_TIMEOUT_MS = 55_000
  // Tracks whether a fetch is currently in flight. Replaces the old
  // ref-based "autoFiredRef" gate which interacted badly with React 18
  // strict-mode double-invoke (the ref persisted across the second
  // mount, blocking the re-fire and leaving autoGenerating wedged).
  // Using `autoGenerating` state directly here means each effect mount
  // re-evaluates the guard on the latest render's state.
  const inflightRef = useRef(false)

  function runAutoGeneration(): () => void {
    if (inflightRef.current) return () => {}
    inflightRef.current = true
    let cancelled = false
    const controller = new AbortController()
    // 20s hard timeout — aborts the fetch and surfaces the error panel.
    const timeoutId = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log('[outline] timeout fired', Date.now())
      controller.abort()
    }, GENERATION_TIMEOUT_MS)

    ;(async () => {
      setAutoGenerating(true)
      setAutoError('')
      try {
        // eslint-disable-next-line no-console
        console.log('[outline] fetch start', Date.now(), 'book:', book.id)
        const res = await fetch(`/api/books/${book.id}/generate-outline`, {
          method: 'POST',
          signal: controller.signal,
        })
        // eslint-disable-next-line no-console
        console.log('[outline] fetch end', Date.now(), 'status:', res.status)
        if (!res.ok) {
          // 409 = chapters already exist; just refetch and move on. Any
          // other error surfaces a retry button.
          if (res.status !== 409) {
            const j = await res.json().catch(() => ({}))
            throw new Error(j?.error || `Generation failed (${res.status})`)
          }
        }
        const j = await res.json().catch(() => ({}))
        const newPages = (j?.pages ?? []) as BookPage[]
        if (cancelled) return
        if (newPages.length > 0) {
          // Preserve the CTA chapter if it already exists in pages — the
          // server only returns chapters with index < 99.
          const existingCta = pages.filter((p) => p.chapter_index >= 99)
          onPagesChange([...newPages, ...existingCta])
        } else {
          // Server returned 409 (or empty) — refetch from supabase to pick
          // up whatever chapters are there.
          const supabase = createClient()
          const { data } = await supabase
            .from('book_pages')
            .select('*')
            .eq('book_id', book.id)
            .order('chapter_index', { ascending: true })
          if (data && !cancelled) onPagesChange(data as BookPage[])
        }
      } catch (e) {
        // Always surface a recoverable error state — including when
        // `cancelled` is true (effect cleanup ran). Silently bailing
        // here used to drop the user into an empty outline column with
        // no spinner, no error, no recovery button. Better to land on
        // a clear "try again" panel even if the cause was a re-mount.
        const aborted = e instanceof DOMException && e.name === 'AbortError'
        if (aborted) {
          // eslint-disable-next-line no-console
          console.log('[outline] aborted', Date.now(), 'cancelled:', cancelled)
        }
        const msg = aborted
          ? 'Generation interrupted — try again.'
          : (e instanceof Error ? e.message : 'Generation failed')
        // eslint-disable-next-line no-console
        console.warn('[outline] generate-outline failed:', msg)
        setAutoError(msg)
      } finally {
        clearTimeout(timeoutId)
        // Always reset state when the IIFE exits, regardless of
        // cancelled. Calling setState on an unmounted component is a
        // no-op in React 18+; this is what unwedges the spinner when
        // strict-mode double-invoke cancels the first fetch.
        setAutoGenerating(false)
        inflightRef.current = false
      }
    })()

    // Caller cleans up via the returned function — used by useEffect's
    // cleanup to abort an in-flight fetch on unmount or dependency change.
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timeoutId)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[outline] mount, chapters:', regularPages.length, Date.now())
    // Gate: only fire when there are zero regular chapters, when nothing
    // is already in flight, and when the user hasn't opted into manual
    // mode. The radar interstitial gates upstream so by the time we
    // land here either radar_applied_at is set or the user explicitly
    // skipped — radar enhances but never gates outline.
    if (regularPages.length > 0) return
    if (manualMode) return
    if (inflightRef.current) return
    return runAutoGeneration()
  // We intentionally key only on book.id, regularPages.length, and
  // manualMode: once chapters exist the effect short-circuits, and we
  // don't want pages-array-identity changes from the critique flow to
  // retrigger generation. inflightRef guards against double-fires
  // within the same dependency-stable window (e.g. strict-mode).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, regularPages.length, manualMode])

  function buildManually() {
    setManualMode(true)
    setAutoError('')
    setAutoGenerating(false)
    inflightRef.current = false
  }

  function retryAutoGeneration() {
    setAutoError('')
    runAutoGeneration()
  }

  const ctaCreatingRef = useRef(false)
  const [ctaCreating, setCtaCreating] = useState(false)
  const [ctaError, setCtaError] = useState('')

  async function createCtaChapter() {
    if (ctaCreatingRef.current || ctaPage) return
    ctaCreatingRef.current = true
    setCtaCreating(true)
    setCtaError('')
    const supabase = createClient()
    try {
      const seed = ctaSeedFor(book.persona)
      const { data, error: insertErr } = await supabase
        .from('book_pages')
        .insert({
          book_id:       book.id,
          chapter_index: 99,
          chapter_title: seed.title,
          chapter_brief: seed.brief,
        })
        .select('*')
        .single()
      if (insertErr) throw new Error(insertErr.message)
      onPagesChange([...pages, data as BookPage])
      toast.success('CTA chapter added.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not add CTA chapter.'
      setCtaError(msg)
      toast.error(msg)
    } finally {
      setCtaCreating(false)
      ctaCreatingRef.current = false
    }
  }

  // Insert-chapter modal state. insertAt = the chapter_index the new chapter
  // will occupy; null when the modal is closed.
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [insertTitle, setInsertTitle] = useState('')
  const [insertBrief, setInsertBrief] = useState('')
  const [insertError, setInsertError] = useState('')
  const [inserting, setInserting] = useState(false)

  function openInsertAt(idx: number) {
    setInsertAt(idx)
    setInsertTitle('')
    setInsertBrief('')
    setInsertError('')
  }

  function closeInsert() {
    setInsertAt(null)
    setInsertError('')
  }

  async function confirmInsert() {
    if (insertAt === null || inserting) return
    const title = insertTitle.trim()
    const brief = insertBrief.trim()
    if (!title) { setInsertError('Title is required.'); return }
    if (!brief) { setInsertError('Brief is required.'); return }

    setInserting(true)
    setInsertError('')
    const supabase = createClient()
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw new Error('Not authenticated')

      const { error: rpcError } = await supabase.rpc('insert_chapter_at', {
        p_book_id: book.id,
        p_user_id: user.id,
        p_insert_at: insertAt,
        p_title: title,
        p_brief: brief,
      })
      if (rpcError) throw new Error(rpcError.message)

      // Refresh the chapter list from the DB so chapter_index values reflect
      // the post-shift state. RPC isn't transactional with the client; we have
      // to re-read.
      const { data: refreshed, error: fetchError } = await supabase
        .from('book_pages')
        .select('*')
        .eq('book_id', book.id)
        .gte('chapter_index', 0)
        .order('chapter_index', { ascending: true })
      if (fetchError) throw new Error(fetchError.message)

      onPagesChange(refreshed ?? [])
      toast.success('Chapter inserted — existing chapters renumbered.')
      closeInsert()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Insert failed'
      setInsertError(msg)
      toast.error(msg)
    } finally {
      setInserting(false)
    }
  }

  // ── Pending-review handlers ────────────────────────────────────────────
  // Accept/Refresh/Remove/Edit all act on a single chapter at a time. The
  // banner's Accept All is a fan-out over the current regularPages array.

  function handleAccept(pageId: string) {
    setAcceptedIds((prev) => {
      const next = new Set(prev)
      next.add(pageId)
      return next
    })
  }

  function handleAcceptAll() {
    setAcceptedIds(new Set(regularPages.map((p) => p.id)))
  }

  async function handleRemoveChapter(page: BookPage) {
    if (removingId) return
    setRemovingId(page.id)
    const supabase = createClient()
    try {
      const { error: deleteErr } = await supabase
        .from('book_pages')
        .delete()
        .eq('id', page.id)
        .eq('book_id', book.id)
      if (deleteErr) throw new Error(deleteErr.message)
      // Optimistic local update — drop the row from the parent's list.
      // We don't renumber surviving chapter_index values; the DB unique
      // index allows gaps, and the next outline regeneration would
      // re-pack them anyway. Removing during review is a "this chapter
      // doesn't belong" action, not a reorder.
      onPagesChange(pages.filter((p) => p.id !== page.id))
      // Drop from acceptedIds too in case it was already accepted.
      setAcceptedIds((prev) => {
        if (!prev.has(page.id)) return prev
        const next = new Set(prev)
        next.delete(page.id)
        return next
      })
      toast.success('Chapter removed.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemovingId(null)
    }
  }

  async function handleRefreshChapter(page: BookPage) {
    if (refreshingId) return
    setRefreshingId(page.id)
    try {
      const res = await fetch(`/api/books/${book.id}/suggest-chapter`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          chapter_index: page.chapter_index,
          current_title: page.chapter_title,
          current_brief: page.chapter_brief,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Suggest failed (${res.status})`)
      const newTitle = typeof json.chapter_title === 'string' ? json.chapter_title : page.chapter_title
      const newBrief = typeof json.chapter_brief === 'string' ? json.chapter_brief : page.chapter_brief
      // Patch in place. The route already updated the DB row; we mirror
      // the change into the local pages array so the card re-renders
      // without a refetch.
      onPagesChange(
        pages.map((p) => p.id === page.id ? { ...p, chapter_title: newTitle, chapter_brief: newBrief } : p),
      )
      // A refreshed chapter resets to "needs another look" — drop the
      // accepted flag if the user had previously accepted this card.
      setAcceptedIds((prev) => {
        if (!prev.has(page.id)) return prev
        const next = new Set(prev)
        next.delete(page.id)
        return next
      })
      toast.success('Chapter refreshed.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Refresh failed')
    } finally {
      setRefreshingId(null)
    }
  }

  function handleEditStart(page: BookPage) {
    setEditingId(page.id)
    setEditTitle(page.chapter_title)
    setEditBrief(page.chapter_brief ?? '')
  }

  function handleEditCancel() {
    setEditingId(null)
    setEditTitle('')
    setEditBrief('')
  }

  async function handleEditSave(page: BookPage) {
    if (editSaving) return
    const title = editTitle.trim()
    const brief = editBrief.trim()
    if (!title) {
      toast.error('Title is required.')
      return
    }
    setEditSaving(true)
    const supabase = createClient()
    try {
      const { error: updateErr } = await supabase
        .from('book_pages')
        .update({ chapter_title: title, chapter_brief: brief, updated_at: new Date().toISOString() })
        .eq('id', page.id)
        .eq('book_id', book.id)
      if (updateErr) throw new Error(updateErr.message)
      onPagesChange(
        pages.map((p) => p.id === page.id ? { ...p, chapter_title: title, chapter_brief: brief } : p),
      )
      handleEditCancel()
      toast.success('Chapter updated.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setEditSaving(false)
    }
  }

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
    if (applyingFlagIndex !== null) return  // serialize Apply clicks
    setApplyingFlagIndex(flagIndex)
    setError('')
    const supabase = createClient()
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw new Error('Not authenticated')
      const userId = user.id

      // Pull a fresh chapter list from the DB after structural changes
      // (merge / insert / reorder) since the affected indices shift in
      // ways the optimistic local update can't track precisely.
      const refetchPages = async (): Promise<void> => {
        const { data: refreshed, error: fetchErr } = await supabase
          .from('book_pages')
          .select('*')
          .eq('book_id', book.id)
          .order('chapter_index', { ascending: true })
        if (fetchErr) throw new Error(fetchErr.message)
        if (refreshed) onPagesChange(refreshed as BookPage[])
      }

      switch (flag.action) {
        case 'merge': {
          if (!flag.source_indices || flag.source_indices.length !== 2) break
          const [a, b] = flag.source_indices
          const keep   = Math.min(a, b)
          const remove = Math.max(a, b)
          const { error: rpcErr } = await supabase.rpc('merge_chapters_at', {
            p_book_id:      book.id,
            p_user_id:      userId,
            p_keep_index:   keep,
            p_delete_index: remove,
            p_merged_title: flag.merged_title ?? 'Merged Chapter',
            p_merged_brief: flag.merged_brief ?? '',
          })
          if (rpcErr) throw new Error(rpcErr.message)
          await refetchPages()
          toast.success('Chapters merged.')
          break
        }

        case 'insert': {
          // insert_after_index = -1 means "insert at the very top".
          // insert_chapter_at takes the insertion position as the new
          // chapter's chapter_index, so add 1 to the after-index.
          const after = flag.insert_after_index
          if (after === undefined || after < -1) break
          const insertAt = after + 1
          const { error: rpcErr } = await supabase.rpc('insert_chapter_at', {
            p_book_id:    book.id,
            p_user_id:    userId,
            p_insert_at:  insertAt,
            p_title:      flag.new_title ?? 'New Chapter',
            p_brief:      flag.new_brief ?? '',
          })
          if (rpcErr) throw new Error(rpcErr.message)
          await refetchPages()
          toast.success('Chapter inserted.')
          break
        }

        case 'reorder': {
          if (flag.from_index === undefined || flag.to_index === undefined) break
          if (flag.from_index === flag.to_index) break
          const { error: rpcErr } = await supabase.rpc('swap_chapters_at', {
            p_book_id:    book.id,
            p_user_id:    userId,
            p_from_index: flag.from_index,
            p_to_index:   flag.to_index,
          })
          if (rpcErr) throw new Error(rpcErr.message)
          await refetchPages()
          toast.success('Chapters reordered.')
          break
        }

        case 'update_brief': {
          if (flag.chapterIndex === null || flag.chapterIndex === undefined) break
          if (!flag.new_brief) break
          const page = pages.find((p) => p.chapter_index === flag.chapterIndex)
          if (!page) break
          const newBrief = flag.new_brief
          const { error: updateErr } = await supabase
            .from('book_pages')
            .update({ chapter_brief: newBrief, updated_at: new Date().toISOString() })
            .eq('id', page.id)
            .eq('book_id', book.id)
          if (updateErr) throw new Error(updateErr.message)
          // Optimistic — single row update, no index shift, safe to
          // patch in place rather than refetch.
          onPagesChange(pages.map((p) =>
            p.id === page.id ? { ...p, chapter_brief: newBrief } : p,
          ))
          toast.success('Chapter brief updated.')
          break
        }

        default: {
          // Unknown / missing action — dismiss only, no DB change. The
          // route's normaliser strips invalid actions, so this branch
          // mostly catches legacy cached results from the old shape.
          break
        }
      }

      dismissFlag(flagIndex)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Apply failed'
      console.error('[outline] applyFlag error:', msg)
      setError(msg)
      toast.error('Could not apply this change. Try again.')
    } finally {
      setApplyingFlagIndex(null)
    }
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
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 px-4 sm:px-6 py-8 bg-cream-1 min-h-screen">
      {/* Left — chapter list. Spans 60% by default, full-width during
          pendingMode since the AI Critique column is hidden until the
          user has finished reviewing the radar-suggested chapters. The
          launch-banner's "Critique Outline" CTA can re-reveal the right
          column mid-review (skipPendingGate); when that fires the left
          column collapses back to its 60% slot. */}
      <div className={(pendingMode && !skipPendingGate) ? 'md:col-span-5 min-w-0' : 'md:col-span-3 min-w-0'}>
        <div className="mb-6">
          <p className="text-[10px] font-inter font-semibold text-gold-dim uppercase tracking-[0.2em] mb-2">
            Manuscript
          </p>
          <h2 className="font-playfair text-3xl text-ink-1 font-semibold">Outline</h2>
          <p className="text-ink-1/70 text-sm font-source-serif mt-1">
            Review your chapter structure before writing.
          </p>
        </div>

        {/* Target audience editor — deliberate user input, separate from
            the radar's inferred reader (which lives on
            book.radar_audience_insight and never overwrites this field).
            Save fires on blur only when the value actually changed. */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <label
              htmlFor="outline-target-audience"
              className="font-inter text-xs uppercase tracking-widest text-ink-subtle"
            >
              Who is this book for?
            </label>
            {audienceSaving && (
              <Loader2 className="w-3 h-3 text-gold animate-spin" aria-hidden="true" />
            )}
            {audienceSaved && !audienceSaving && (
              <span className="text-[10px] font-inter text-emerald-700 inline-flex items-center gap-1">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
          </div>
          <textarea
            id="outline-target-audience"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            onBlur={() => void saveAudienceOnBlur()}
            rows={2}
            placeholder="e.g. Funding brokers with 1-3 years experience who want to grow their client pipeline using social media"
            className="w-full px-3 py-2.5 rounded-md bg-cream-2 border border-cream-3 text-ink-1 placeholder:text-ink-subtle font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
          />
        </div>

        {autoGenerating && regularPages.length === 0 && (
          // Full-bleed loading panel takes the place of the chapter list while
          // Sonnet is drafting. BookOpen + slow-spin loader for visual weight.
          // The "Build Manually" link is always present so the user is never
          // trapped in the spinner — even if the timeout fails to fire.
          <div className="flex flex-col items-center justify-center text-center bg-white border border-cream-3 rounded-2xl p-12 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
            <div className="relative mb-5">
              <BookOpen className="w-12 h-12 text-gold" strokeWidth={1.5} />
              <Loader2 className="w-5 h-5 absolute -bottom-1 -right-1 text-gold animate-spin" />
            </div>
            <p className="font-playfair text-xl text-ink-1 font-semibold mb-1">
              Drafting your outline
            </p>
            <p className="text-ink-1/70 text-sm font-source-serif max-w-sm leading-relaxed mb-4">
              Pulling together your radar intelligence, persona, and audience to
              propose a chapter sequence. Takes about 20 seconds.
            </p>
            <button
              type="button"
              onClick={buildManually}
              className="text-ink-1/60 hover:text-ink-1 font-inter text-xs underline underline-offset-4 transition-colors"
            >
              Build manually instead
            </button>
          </div>
        )}

        {!autoGenerating && autoError && regularPages.length === 0 && !manualMode && (
          <div className="bg-white border border-rose-200 rounded-2xl p-6">
            <p className="font-inter font-semibold text-rose-700 text-sm mb-1">
              Couldn&rsquo;t generate your outline automatically
            </p>
            <p className="text-ink-1/70 text-xs font-source-serif mb-4">{autoError}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={retryAutoGeneration}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink-1 hover:bg-ink-2 text-cream text-xs font-inter font-medium rounded-md transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Try Again
              </button>
              <button
                type="button"
                onClick={buildManually}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-ink-3 hover:bg-cream-2 text-ink-1 text-xs font-inter font-medium rounded-md transition-colors"
              >
                <Plus className="w-3 h-3" />
                Build Manually
              </button>
            </div>
          </div>
        )}

        {!autoGenerating && !autoError && !manualMode && regularPages.length === 0 && (
          // Recovery empty state — fires when the page lands with zero
          // chapters AND nothing's been kicked off (auto-gen idle, no
          // error, no manual override). Without this branch, the user
          // would see an empty column with no recoverable next step;
          // the auto-gen useEffect already ran but didn't fire (e.g.
          // the run completed without persisting, or this is a fresh
          // mount where regularPages.length started at 0 but no effect
          // was queued for some reason). Generate Outline calls the
          // same runAutoGeneration the effect would have, so a click
          // here is the deliberate retry.
          <div className="flex flex-col items-center justify-center text-center bg-white border border-cream-3 rounded-2xl p-12 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
            <BookOpen className="w-12 h-12 text-gold mb-5" strokeWidth={1.5} />
            <p className="font-playfair text-xl text-ink-1 font-semibold mb-1">
              Ready to build your outline
            </p>
            <p className="text-ink-1/70 text-sm font-source-serif max-w-sm leading-relaxed mb-6">
              Your chapter structure will be generated using your market intelligence and book context.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={() => runAutoGeneration()}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 text-sm font-inter font-semibold rounded-md transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Outline
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={buildManually}
                className="text-ink-subtle hover:text-ink-1 font-inter text-xs underline underline-offset-4 transition-colors"
              >
                Build Manually
              </button>
            </div>
          </div>
        )}

        {!autoGenerating && !autoError && manualMode && regularPages.length === 0 && (
          // Manual-build empty state — the auto-gen path was bypassed and
          // there are no chapters yet. Single CTA into the existing insert
          // flow at index 0.
          <div className="flex flex-col items-center justify-center text-center bg-white border border-dashed border-cream-3 rounded-2xl p-12">
            <p className="font-playfair text-xl text-ink-1 font-semibold mb-1">
              Build your outline
            </p>
            <p className="text-ink-1/70 text-sm font-source-serif max-w-sm leading-relaxed mb-5">
              Add chapters one at a time. You can always run the AI outline
              again later.
            </p>
            <button
              type="button"
              onClick={() => openInsertAt(0)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold hover:bg-gold-soft text-ink-1 text-sm font-inter font-semibold rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add your first chapter
            </button>
          </div>
        )}

        {/* Pending-review banner. Surfaces whenever the radar drove an
            outline auto-generation (radar_applied_at set, no chapters
            approved yet) AND there's at least one chapter on screen.
            Two states:
              - Review:  Accept All shortcut + "Review each one…" copy.
              - Launch:  Start Writing CTA + "All chapters reviewed…"
                         copy, fires once every regularPages row is in
                         acceptedIds. The launch click navigates to the
                         first chapter; pendingMode flips off once the
                         user writes content there and approves it,
                         which removes the banner naturally. */}
        {showPendingBanner && (
          allChaptersAccepted ? (
            <div className="mb-4 rounded-lg border-l-4 border-emerald-400 bg-ink-3 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="font-source-serif text-sm text-cream-1">
                  All chapters reviewed. Ready to start.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    // Reveal the right column (overrides the pendingMode
                    // hide) AND fire the same critique handler the panel's
                    // own button uses. One click → critique runs and its
                    // results render alongside the banner.
                    setSkipPendingGate(true)
                    void runCritique()
                  }}
                  disabled={critiquing}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-gold/60 hover:border-gold text-gold hover:bg-gold/10 text-xs font-inter font-semibold rounded-md transition-colors disabled:opacity-50"
                >
                  {critiquing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  Critique Outline
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateChapter(0)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-gold-soft text-ink-1 text-xs font-inter font-semibold rounded-md transition-colors"
                >
                  Start Writing
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-lg border-l-4 border-gold bg-ink-3 px-4 py-3 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-inter text-sm font-semibold text-cream-1">
                  Creator Radar suggested these chapters
                </p>
                <p className="font-source-serif text-xs text-cream-1/75 mt-0.5">
                  Review each one before you start writing.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-gold-soft text-ink-1 text-xs font-inter font-semibold rounded-md transition-colors"
              >
                <Check className="w-3 h-3" />
                Accept All
              </button>
            </div>
          )
        )}

        <div className="flex flex-col">
          {/* Insert slot above the first chapter — new chapter takes index 0 */}
          {regularPages.length > 0 && (
            <button
              type="button"
              onClick={() => openInsertAt(0)}
              aria-label="Insert chapter at position 1"
              className="relative h-3 group/gap focus:outline-none"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-0 group-hover/gap:opacity-100 group-focus-visible/gap:opacity-100 transition-opacity"
              >
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink-4 text-gold text-[11px] font-inter font-medium shadow-sm">
                  <Plus className="w-3 h-3" />
                  Insert chapter here
                </span>
              </span>
            </button>
          )}

          {regularPages.map((page, i) => {
            const isEditing = editingId === page.id
            const isAccepted = acceptedIds.has(page.id)
            return (
            <Fragment key={page.id}>
            <div
              className={`flex items-start gap-3 p-4 bg-white border rounded-xl group transition-all cursor-default ${
                isAccepted
                  ? 'border-emerald-300/70 hover:border-emerald-400 hover:shadow-[0_4px_18px_-6px_rgba(16,185,129,0.22)]'
                  : 'border-cream-3 hover:border-gold/40 hover:shadow-[0_4px_18px_-6px_rgba(201,168,76,0.18)]'
              }`}
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

              {/* Number badge — gold normally; emerald-tinted when locally
                  accepted as a visual confirmation that the user has
                  signed off on this card. */}
              <span className={`w-7 h-7 rounded-md font-inter font-bold text-sm flex items-center justify-center shrink-0 ${
                isAccepted ? 'bg-emerald-500 text-white' : 'bg-gold text-ink-1'
              }`}>
                {isAccepted ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>

              {isEditing ? (
                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Chapter title"
                    disabled={editSaving}
                    className="w-full px-3 py-2 rounded-md bg-cream-1 border border-cream-3 text-ink-1 placeholder:text-ink-1/30 text-sm font-inter font-semibold focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-50"
                  />
                  <textarea
                    value={editBrief}
                    onChange={(e) => setEditBrief(e.target.value)}
                    placeholder="Chapter brief"
                    rows={3}
                    disabled={editSaving}
                    className="w-full px-3 py-2 rounded-md bg-cream-1 border border-cream-3 text-ink-1 placeholder:text-ink-1/30 text-sm font-source-serif focus:outline-none focus:ring-2 focus:ring-gold/40 resize-y disabled:opacity-50"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleEditCancel}
                      disabled={editSaving}
                      className="px-3 py-1.5 text-ink-1/60 hover:text-ink-1 text-xs font-inter transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleEditSave(page)}
                      disabled={editSaving || !editTitle.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold hover:bg-gold-soft text-ink-1 text-xs font-inter font-semibold rounded-md transition-colors disabled:opacity-50"
                    >
                      {editSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
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
              )}

              {!isEditing && (
                <div className="flex items-center gap-1 shrink-0">
                  {pendingMode ? (
                    <>
                      {/* Accept (✓) — local-only confirmation. Disabled once
                          accepted; the user clears it implicitly by clicking
                          Refresh, which drops the accepted flag. */}
                      <button
                        type="button"
                        onClick={() => handleAccept(page.id)}
                        disabled={isAccepted}
                        title={isAccepted ? 'Confirmed' : 'Accept this chapter'}
                        aria-label={isAccepted ? 'Chapter accepted' : 'Accept this chapter'}
                        className={`p-1.5 rounded-md transition-colors ${
                          isAccepted
                            ? 'bg-emerald-50 text-emerald-600 cursor-default'
                            : 'text-ink-1/50 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      {/* Refresh — calls /suggest-chapter to regenerate just
                          this chapter's title+brief. */}
                      <button
                        type="button"
                        onClick={() => void handleRefreshChapter(page)}
                        disabled={refreshingId === page.id}
                        title="Suggest a different angle"
                        aria-label="Suggest a different angle"
                        className="p-1.5 rounded-md text-ink-1/50 hover:text-gold-dim hover:bg-gold/10 transition-colors disabled:opacity-50"
                      >
                        {refreshingId === page.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                      {/* Edit — opens inline editor for title + brief. */}
                      <button
                        type="button"
                        onClick={() => handleEditStart(page)}
                        title="Edit title and brief"
                        aria-label="Edit title and brief"
                        className="p-1.5 rounded-md text-ink-1/50 hover:text-ink-1 hover:bg-cream-2 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {/* Remove — deletes the row. Optimistic local update. */}
                      <button
                        type="button"
                        onClick={() => void handleRemoveChapter(page)}
                        disabled={removingId === page.id}
                        title="Remove this chapter"
                        aria-label="Remove this chapter"
                        className="p-1.5 rounded-md text-ink-1/50 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                      >
                        {removingId === page.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Insert slot after this chapter — new chapter takes index i+1 */}
            <button
              type="button"
              onClick={() => openInsertAt(i + 1)}
              aria-label={`Insert chapter at position ${i + 2}`}
              className="relative h-3 group/gap focus:outline-none"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-0 group-hover/gap:opacity-100 group-focus-visible/gap:opacity-100 transition-opacity"
              >
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink-4 text-gold text-[11px] font-inter font-medium shadow-sm">
                  <Plus className="w-3 h-3" />
                  Insert chapter here
                </span>
              </span>
            </button>
            </Fragment>
            )
          })}

          {/* CTA chapter card — sentinel chapter at index 99. Renders below
              the regular chapter list so authors can opt into a closing
              call-to-action without it counting toward their plan's chapter
              limit. Two states:
                1. ctaPage exists → render as a styled chapter card with gold
                   accent and the Megaphone icon, click "Write" navigates to it.
                2. No ctaPage → render an "Add a Closing CTA" prompt card. */}
          {regularPages.length > 0 && ctaPage && (
            <div
              className="mt-3 flex items-start gap-3 p-4 bg-gradient-to-br from-gold/10 via-white to-white border border-gold/40 rounded-xl group hover:border-gold/60 hover:shadow-[0_4px_18px_-6px_rgba(201,168,76,0.28)] transition-all cursor-default"
            >
              <span
                aria-label="CTA chapter"
                className="w-7 h-7 rounded-md bg-ink-1 text-gold font-inter font-bold text-sm flex items-center justify-center shrink-0"
              >
                <Megaphone className="w-3.5 h-3.5" />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-inter font-semibold text-ink-1 text-base leading-snug">
                    {ctaPage.chapter_title}
                  </p>
                  <span className="text-[10px] font-inter font-semibold uppercase tracking-wider text-gold-dim bg-gold/15 px-1.5 py-0.5 rounded">
                    CTA
                  </span>
                </div>
                {ctaPage.chapter_brief && (
                  <p className="text-ink-1/85 text-sm font-source-serif mt-1.5 leading-relaxed line-clamp-2">
                    {ctaPage.chapter_brief}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {ctaPage.approved && (
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                    title="Approved"
                  />
                )}
                <button
                  onClick={() => onNavigateChapter(regularPages.length)}
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1 rounded-md bg-cream-2 hover:bg-gold/15 text-xs font-inter font-medium text-ink-1 transition-all"
                >
                  Write <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {regularPages.length > 0 && !ctaPage && (
            <button
              type="button"
              onClick={createCtaChapter}
              disabled={ctaCreating}
              className="mt-3 group flex items-start gap-3 p-4 bg-cream-2/40 border border-dashed border-cream-3 hover:border-gold/40 hover:bg-cream-2 rounded-xl text-left transition-all disabled:opacity-50"
            >
              <span className="w-7 h-7 rounded-md bg-cream-3 group-hover:bg-gold/20 text-ink-1/60 group-hover:text-gold-dim font-inter font-bold text-sm flex items-center justify-center shrink-0 transition-colors">
                <Megaphone className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-inter font-semibold text-ink-1 text-base leading-snug flex items-center gap-2">
                  Add a closing call to action
                  {ctaCreating && <Loader2 className="w-3.5 h-3.5 animate-spin text-gold" />}
                </p>
                <p className="text-ink-1/70 text-sm font-source-serif mt-1.5 leading-relaxed">
                  An optional final chapter that points readers to your next step — a free guide, a call, or wherever you want them to land. We&apos;ll seed it with on-tone copy you can edit.
                </p>
                {ctaError && (
                  <p className="text-rose-600 text-xs font-inter mt-2">{ctaError}</p>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-ink-1/30 group-hover:text-gold mt-1.5 shrink-0 transition-colors" />
            </button>
          )}
        </div>
      </div>

      {/* Right — intelligence column (40%): AI Critique only. Creator Radar
          used to live above this; it's now its own coauthor stage so the
          panel can render at full width and have a top-level sidebar entry.
          Hidden entirely during pendingMode — both the critique and the
          "Proceed to Writing" button (which lives inside this panel)
          should only resurface once the user has reviewed the radar-
          suggested chapters and at least one has been approved. The
          launch-banner's "Critique Outline" CTA overrides this gate via
          skipPendingGate so the user can run the critique at the moment
          they finish review without first having to write a chapter. */}
      {(!pendingMode || skipPendingGate) && (
      <div className="md:col-span-2 min-w-0 space-y-4">
        <div className="sticky top-20 space-y-4">
        <div className="bg-ink-2 border border-ink-3 rounded-2xl overflow-hidden flex flex-col">
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
                          disabled={applyingFlagIndex !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-inter font-medium rounded-md transition-colors press-scale disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {applyingFlagIndex === originalIndex
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> Applying…</>
                            : <><Check className="w-3 h-3" /> Apply</>}
                        </button>
                        <button
                          onClick={() => dismissFlag(originalIndex)}
                          disabled={applyingFlagIndex !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-4 hover:bg-ink-3 text-ink-subtle hover:text-cream text-xs font-inter rounded-md transition-colors press-scale disabled:opacity-50 disabled:cursor-not-allowed"
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
      )}

      {/* Insert chapter modal — fixed overlay, only mounted when insertAt is
          set. Pressing Escape or clicking the backdrop closes; the dialog
          itself stops click propagation so inner clicks don't dismiss. */}
      {insertAt !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeInsert}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Insert chapter"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') closeInsert() }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
          >
            <h3 className="font-playfair text-xl text-ink-1 font-semibold mb-1">Insert chapter</h3>
            <p className="text-ink-1/70 text-sm font-source-serif mb-4">
              New chapter will land at position {insertAt + 1}. Existing chapters from that point onward shift down by one. Approved drafts and images stay attached to their chapters — only the numbers change.
            </p>

            <label className="block text-[11px] font-inter font-semibold text-ink-1/80 uppercase tracking-wider mb-1">
              Chapter title
            </label>
            <input
              type="text"
              value={insertTitle}
              onChange={(e) => setInsertTitle(e.target.value)}
              placeholder="e.g. The Hidden Cost of Inquiries"
              disabled={inserting}
              autoFocus
              className="w-full px-3 py-2 rounded-md bg-cream-1 border border-cream-3 text-ink-1 placeholder:text-ink-1/30 text-sm font-inter focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-50"
            />

            <label className="block text-[11px] font-inter font-semibold text-ink-1/80 uppercase tracking-wider mb-1 mt-4">
              Chapter brief
            </label>
            <textarea
              value={insertBrief}
              onChange={(e) => setInsertBrief(e.target.value)}
              placeholder="One or two sentences describing what this chapter covers."
              rows={3}
              disabled={inserting}
              className="w-full px-3 py-2 rounded-md bg-cream-1 border border-cream-3 text-ink-1 placeholder:text-ink-1/30 text-sm font-source-serif focus:outline-none focus:ring-2 focus:ring-gold/40 resize-y disabled:opacity-50"
            />

            {insertError && (
              <p className="text-rose-600 text-xs font-inter mt-3">{insertError}</p>
            )}

            <div className="flex gap-2 mt-5 justify-end">
              <button
                type="button"
                onClick={closeInsert}
                disabled={inserting}
                className="px-4 py-2 text-sm font-inter text-ink-1/70 hover:text-ink-1 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmInsert}
                disabled={inserting || !insertTitle.trim() || !insertBrief.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-soft text-ink-1 text-sm font-inter font-semibold rounded-md transition-colors disabled:opacity-50 press-scale"
              >
                {inserting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {inserting ? 'Inserting…' : 'Insert chapter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
