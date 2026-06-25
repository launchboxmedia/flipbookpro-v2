'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Book, BookPage } from '@/types/database'

export type DraftAllStep = 'draft' | 'image' | 'approve'

export interface DraftAllError {
  chapterTitle: string
  message: string
  /** true = draft failed (Skip available); false = approve failed (Stop only) */
  canSkip: boolean
}

export interface DraftAllState {
  running: boolean
  currentIndex: number       // 0-based index in the unapproved-pages array
  totalCount: number
  currentStep: DraftAllStep
  currentChapterTitle: string
  failedImageChapters: string[]   // chapter_title of each chapter whose image failed
  error: DraftAllError | null     // set while loop is paused waiting for Skip/Stop
}

const IDLE: DraftAllState = {
  running: false,
  currentIndex: 0,
  totalCount: 0,
  currentStep: 'draft',
  currentChapterTitle: '',
  failedImageChapters: [],
  error: null,
}

export function useDraftAll() {
  const [state, setState] = useState<DraftAllState>(IDLE)
  const cancelledRef = useRef(false)
  const runningRef = useRef(false)
  const errorResolverRef = useRef<((choice: 'skip' | 'stop') => void) | null>(null)

  function cancel() {
    cancelledRef.current = true
    runningRef.current = false
    errorResolverRef.current?.('stop')
    errorResolverRef.current = null
    setState(IDLE)
  }

  function resolveError(choice: 'skip' | 'stop') {
    errorResolverRef.current?.(choice)
    errorResolverRef.current = null
  }

  async function start(
    book: Book,
    unapprovedPages: BookPage[],
    onPageApproved: (pageId: string) => void,
    onComplete: (failedImageTitles: string[]) => void,
  ): Promise<void> {
    if (runningRef.current || unapprovedPages.length === 0) return
    runningRef.current = true
    cancelledRef.current = false
    const failedImages: string[] = []
    const supabase = createClient()

    setState({
      running: true,
      currentIndex: 0,
      totalCount: unapprovedPages.length,
      currentStep: 'draft',
      currentChapterTitle: unapprovedPages[0].chapter_title,
      failedImageChapters: [],
      error: null,
    })

    for (let i = 0; i < unapprovedPages.length; i++) {
      if (cancelledRef.current) break
      const page = unapprovedPages[i]

      setState(prev => ({
        ...prev,
        currentIndex: i,
        currentChapterTitle: page.chapter_title,
        currentStep: 'draft',
        error: null,
      }))

      // ── Step 1: Generate draft (SSE) ──────────────────────────────────────
      let draftOk = false
      while (!draftOk && !cancelledRef.current) {
        try {
          const res = await fetch(`/api/books/${book.id}/generate-draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageId: page.id }),
          })
          if (!res.ok || !res.body) throw new Error(`Draft failed (${res.status})`)

          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let accumulated = ''

          while (true) {
            if (cancelledRef.current) { void reader.cancel(); break }
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue
              try {
                const data = JSON.parse(line.slice(6)) as Record<string, unknown>
                if (typeof data.delta === 'string') accumulated += data.delta
              } catch { /* partial JSON line */ }
            }
          }

          if (cancelledRef.current) break

          // Save accumulated content to DB — generate-draft streams but does not persist.
          const { error: saveErr } = await supabase
            .from('book_pages')
            .update({ content: accumulated, updated_at: new Date().toISOString() })
            .eq('id', page.id)
            .eq('book_id', book.id)
          if (saveErr) throw new Error(saveErr.message)

          draftOk = true
        } catch (e) {
          if (cancelledRef.current) break
          const msg = e instanceof Error ? e.message : 'Draft failed'

          // Pause loop, surface error, wait for user choice.
          const choice = await new Promise<'skip' | 'stop'>((resolve) => {
            errorResolverRef.current = resolve
            setState(prev => ({
              ...prev,
              error: { chapterTitle: page.chapter_title, message: msg, canSkip: true },
            }))
          })

          setState(prev => ({ ...prev, error: null }))

          if (choice === 'stop') {
            runningRef.current = false
            setState(IDLE)
            return
          }
          // choice === 'skip': break inner while, outer for will continue
          break
        }
      }

      if (cancelledRef.current) break
      if (!draftOk) continue   // skipped — no image or approve for this chapter

      // ── Step 2: Generate image (non-blocking failure) ─────────────────────
      setState(prev => ({ ...prev, currentStep: 'image' }))
      try {
        const imgRes = await fetch(`/api/books/${book.id}/generate-chapter-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: page.id }),
        })
        if (!imgRes.ok) throw new Error(`Image failed (${imgRes.status})`)
      } catch {
        failedImages.push(page.chapter_title)
        setState(prev => ({ ...prev, failedImageChapters: [...failedImages] }))
      }

      if (cancelledRef.current) break

      // ── Step 3: Approve ───────────────────────────────────────────────────
      setState(prev => ({ ...prev, currentStep: 'approve' }))
      try {
        const approveRes = await fetch(`/api/books/${book.id}/approve-chapter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: page.id, approved: true }),
        })
        if (!approveRes.ok) {
          const j = await approveRes.json().catch(() => ({})) as Record<string, unknown>
          throw new Error(typeof j.error === 'string' ? j.error : `Approve failed (${approveRes.status})`)
        }
        onPageApproved(page.id)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Approve failed'
        runningRef.current = false
        setState(prev => ({
          ...prev,
          running: false,
          error: { chapterTitle: page.chapter_title, message: msg, canSkip: false },
        }))
        return
      }

      // ── Step 4: Fire-and-forget critique ──────────────────────────────────
      void fetch(`/api/books/${book.id}/critique-chapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: page.id }),
      }).catch(() => {})
    }

    runningRef.current = false
    if (!cancelledRef.current) {
      setState(IDLE)
      onComplete(failedImages)
    }
  }

  return { state, start, cancel, resolveError }
}
