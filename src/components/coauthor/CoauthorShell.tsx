'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { OutlineStage } from './OutlineStage'
import { ChapterStage } from './ChapterStage'
import { BookDesignStage } from './BookDesignStage'
import { PrePublishStage } from './PrePublishStage'
import { PublishStage } from './PublishStage'
import { CreatorRadarStage } from './CreatorRadarStage'
import type { Book, BookPage, BookResource, PublishedBook } from '@/types/database'

export type CoauthorStage =
  | 'outline'
  | 'radar'
  | 'chapter'
  | 'book-design'
  | 'pre-publish'
  | 'publish'
export type ImageStatus = 'idle' | 'generating' | 'done' | 'error'

interface Props {
  book: Book
  pages: BookPage[]
  /** Resources for this book, hydrated server-side. ChapterStage uses
   *  them to mark already-generated `[[RESOURCE]]` markers as "view-only"
   *  rather than offering Generate again. */
  initialResources?: BookResource[]
  /** Published row from public.published_books, or null if the book has
   *  never been published. Drives the PublishStage's "Your book is live"
   *  state and the access-type defaults. */
  publishedBook?: PublishedBook | null
  /** Whether the author has a Stripe Connect account — gates the paid
   *  publish path with a warning when missing. */
  hasStripeConnect?: boolean
  /** True when book_pages contains a chapter at index 99 (the closing CTA
   *  sentinel). Drives the publish-time warning about a CTA chapter with
   *  no destination URL. */
  hasCtaChapter?: boolean
  /** Profile's display_name (preferred) or full_name, used as a
   *  placeholder hint on the BookDesignStage author-name input. Empty
   *  string when the profile has neither. */
  authorNamePlaceholder?: string
  /** Public URL of the uploaded author photo (profiles.avatar_url).
   *  null when no photo is set — disables the "Photo Cover" pill in
   *  Book Design. */
  authorPhotoUrl?: string | null
  /** Public URL of the uploaded brand mascot (profiles.mascot_url).
   *  null when no mascot is set — disables the "Mascot Cover" pill. */
  mascotUrl?: string | null
  userEmail: string
  isPremium?: boolean
  isAdmin?: boolean
  /** Plan tier as Creator Radar sees it (admin collapsed to 'pro'). */
  radarPlan?: 'free' | 'standard' | 'pro'
  initialStage?: CoauthorStage
}

export function CoauthorShell({
  book,
  pages: initialPages,
  initialResources = [],
  publishedBook = null,
  hasStripeConnect = false,
  hasCtaChapter = false,
  authorNamePlaceholder = '',
  authorPhotoUrl = null,
  mascotUrl = null,
  userEmail,
  isPremium,
  isAdmin,
  radarPlan = 'free',
  initialStage = 'outline',
}: Props) {
  const [pages, setPages] = useState<BookPage[]>(initialPages)
  const [resources, setResources] = useState<BookResource[]>(initialResources)
  const [stage, setStage] = useState<CoauthorStage>(initialStage)
  const [activeChapterIndex, setActiveChapterIndex] = useState(0)
  const [imageStatuses, setImageStatuses] = useState<Record<string, ImageStatus>>({})
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({})
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(book.cover_image_url)
  const [coverImageStatus, setCoverImageStatus] = useState<ImageStatus>('idle')
  const [coverImageError, setCoverImageError] = useState<string | null>(null)
  const [coverHasText, setCoverHasText] = useState<boolean>(book.cover_has_text ?? false)
  const [visualStyle, setVisualStyle] = useState<string | null>(book.visual_style)
  const [palette, setPalette] = useState<string | null>(book.palette)

  // Track in-flight image generation requests so they can be aborted on
  // unmount or page navigation.
  const inflightControllers = useRef<Map<string, AbortController>>(new Map())
  useEffect(() => {
    const controllers = inflightControllers.current
    return () => {
      controllers.forEach((c) => c.abort())
      controllers.clear()
    }
  }, [])

  const chapterPages = pages
    .filter((p) => p.chapter_index >= 0)
    .sort((a, b) => a.chapter_index - b.chapter_index)

  function updatePage(changes: { id: string } & Partial<BookPage>) {
    setPages((prev) => prev.map((p) => {
      if (p.id !== changes.id) return p
      const merged = { ...p, ...changes }
      // Never clear image fields through a non-image update
      if (!changes.image_url && p.image_url) merged.image_url = p.image_url
      return merged
    }))
  }

  function upsertResource(resource: BookResource) {
    setResources((prev) => {
      const idx = prev.findIndex((r) => r.id === resource.id)
      if (idx === -1) return [...prev, resource]
      const next = prev.slice()
      next[idx] = resource
      return next
    })
  }

  function navigateChapter(index: number) {
    setActiveChapterIndex(index)
    setStage('chapter')
  }

  const allApproved = chapterPages.length > 0 && chapterPages.every((p) => p.approved)

  const generateChapterImage = useCallback(async (pageId: string, customPrompt?: string) => {
    // Abort any prior in-flight request for this page (deduplication)
    inflightControllers.current.get(pageId)?.abort()
    const controller = new AbortController()
    inflightControllers.current.set(pageId, controller)

    setImageStatuses((prev) => ({ ...prev, [pageId]: 'generating' }))
    try {
      const res = await fetch(`/api/books/${book.id}/generate-chapter-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, customPrompt }),
        signal: controller.signal,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      // Bail if a newer request superseded us
      if (inflightControllers.current.get(pageId) !== controller) return
      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, image_url: json.imageUrl } : p)),
      )
      setImageStatuses((prev) => ({ ...prev, [pageId]: 'done' }))
      setImageErrors((prev) => { const n = { ...prev }; delete n[pageId]; return n })
    } catch (e) {
      // Don't surface AbortError as a user-visible failure
      if (e instanceof DOMException && e.name === 'AbortError') return
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setImageStatuses((prev) => ({ ...prev, [pageId]: 'error' }))
      setImageErrors((prev) => ({ ...prev, [pageId]: msg }))
    } finally {
      if (inflightControllers.current.get(pageId) === controller) {
        inflightControllers.current.delete(pageId)
      }
    }
  }, [book.id])

  const changeVisualStyle = useCallback(async (newStyle: string) => {
    const previous = visualStyle
    setVisualStyle(newStyle)
    // Capture the chapter id at call time so a navigation during the await
    // doesn't regenerate the wrong chapter.
    const current = pages
      .filter((p) => p.chapter_index >= 0)
      .sort((a, b) => a.chapter_index - b.chapter_index)[activeChapterIndex]
    const chapterId = current?.id
    try {
      const res = await fetch(`/api/books/${book.id}/update-style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visualStyle: newStyle }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Failed to update style')
      if (chapterId) await generateChapterImage(chapterId)
    } catch {
      setVisualStyle(previous)
    }
  }, [book.id, visualStyle, pages, activeChapterIndex, generateChapterImage])

  const changePalette = useCallback(async (newPalette: string) => {
    const previous = palette
    setPalette(newPalette)
    const current = pages
      .filter((p) => p.chapter_index >= 0)
      .sort((a, b) => a.chapter_index - b.chapter_index)[activeChapterIndex]
    const chapterId = current?.id
    try {
      const res = await fetch(`/api/books/${book.id}/update-style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palette: newPalette }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Failed to update palette')
      if (chapterId) await generateChapterImage(chapterId)
    } catch {
      setPalette(previous)
    }
  }, [book.id, palette, pages, activeChapterIndex, generateChapterImage])

  const generateCoverImage = useCallback(async (
    arg?: string | { customPrompt?: string; mode?: 'ai' | 'mascot' | 'photo' },
  ) => {
    // Backward-compatible overload: a string arg is treated as a custom
    // prompt (legacy callers in the sidebar still do that). An object
    // arg carries an optional cover mode for Phase 2.
    const customPrompt = typeof arg === 'string' ? arg : arg?.customPrompt
    const mode         = typeof arg === 'object' ? arg.mode : undefined
    setCoverImageStatus('generating')
    setCoverImageError(null)
    try {
      const res = await fetch(`/api/books/${book.id}/generate-cover-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt, mode: mode ?? 'ai' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      setCoverImageUrl(json.imageUrl)
      setCoverImageStatus('done')
    } catch (e) {
      setCoverImageStatus('error')
      setCoverImageError(e instanceof Error ? e.message : 'Cover generation failed')
    }
  }, [book.id])

  const uploadChapterImage = useCallback(async (pageId: string, file: File) => {
    inflightControllers.current.get(pageId)?.abort()
    setImageStatuses((prev) => ({ ...prev, [pageId]: 'generating' }))
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('pageId', pageId)
      const res = await fetch(`/api/books/${book.id}/upload-chapter-image`, {
        method: 'POST',
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status})`)
      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, image_url: json.imageUrl } : p)),
      )
      setImageStatuses((prev) => ({ ...prev, [pageId]: 'done' }))
      setImageErrors((prev) => { const n = { ...prev }; delete n[pageId]; return n })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setImageStatuses((prev) => ({ ...prev, [pageId]: 'error' }))
      setImageErrors((prev) => ({ ...prev, [pageId]: msg }))
    }
  }, [book.id])

  const handleCoverUpload = useCallback(async (file: File) => {
    setCoverImageStatus('generating')
    setCoverImageError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/books/${book.id}/upload-cover`, {
        method: 'POST',
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      setCoverImageUrl(json.imageUrl)
      setCoverImageStatus('done')
    } catch (e) {
      setCoverImageStatus('error')
      setCoverImageError(e instanceof Error ? e.message : 'Upload failed')
    }
  }, [book.id])

  const handleToggleCoverHasText = useCallback(async (next: boolean) => {
    // Optimistic — flip immediately, revert on failure so the preview reflects
    // the new setting without waiting for the server roundtrip.
    const previous = coverHasText
    setCoverHasText(next)
    try {
      const res = await fetch(`/api/books/${book.id}/update-style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverHasText: next }),
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
    } catch {
      setCoverHasText(previous)
    }
  }, [book.id, coverHasText])

  const currentPage = chapterPages[activeChapterIndex]
  const currentImageStatus = currentPage
    ? (imageStatuses[currentPage.id] ?? (currentPage.image_url ? 'done' : 'idle'))
    : 'idle'
  const currentImageError = currentPage ? (imageErrors[currentPage.id] ?? null) : null

  return (
    <AppShell
      userEmail={userEmail}
      isPremium={isPremium}
      isAdmin={isAdmin}
      pageTitle={book.title}
      bookContext={{
        bookId: book.id,
        bookTitle: book.title,
        stage,
        activeChapterIndex,
        pages: chapterPages,
        allApproved,
        imageStatuses,
        coverImageUrl,
        coverImageStatus,
        coverHasText,
        hasDiscover: false,
        onStageChange: setStage,
        onChapterSelect: navigateChapter,
        onGenerateCover: generateCoverImage,
        onCoverUpload: handleCoverUpload,
        onToggleCoverHasText: handleToggleCoverHasText,
      }}
    >
      {/* Animate stage transitions — small slide+fade so switching feels
          deliberate, not abrupt. Key on stage+chapter so changing chapter
          inside the chapter stage also re-mounts (refreshing the writing
          surface). */}
      <div className="h-full relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage === 'chapter' ? `chapter-${activeChapterIndex}` : stage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="h-full"
          >
            {stage === 'outline' && (
              <OutlineStage
                book={book}
                pages={chapterPages}
                onPagesChange={(updated) => {
                  // OutlineStage owns the chapter list (chapter_index >= 0).
                  // Replace those rows wholesale so insertions/renumbers
                  // propagate, while preserving back-matter (chapter_index < 0)
                  // and existing image_url when the updater didn't include one.
                  setPages((prev) => {
                    const backMatter = prev.filter((p) => p.chapter_index < 0)
                    const merged = updated.map((u) => {
                      const old = prev.find((p) => p.id === u.id)
                      if (!old) return u
                      const next = { ...old, ...u }
                      if (!u.image_url && old.image_url) next.image_url = old.image_url
                      return next
                    })
                    return [...backMatter, ...merged]
                  })
                  // Reset the chapter cursor so a stale activeChapterIndex
                  // can't point past the end after a structural change.
                  setActiveChapterIndex((idx) => Math.min(idx, Math.max(0, updated.length - 1)))
                }}
                onNavigateChapter={navigateChapter}
              />
            )}
            {stage === 'chapter' && currentPage && (
              <ChapterStage
                book={book}
                page={currentPage}
                pageIndex={activeChapterIndex}
                totalPages={chapterPages.length}
                chapters={chapterPages}
                onChapterSelect={navigateChapter}
                imageStatus={currentImageStatus}
                imageError={currentImageError}
                visualStyle={visualStyle}
                onChangeStyle={changeVisualStyle}
                palette={palette}
                onChangePalette={changePalette}
                onPageUpdate={(changes) => updatePage(changes)}
                onGenerateImage={(customPrompt) => generateChapterImage(currentPage.id, customPrompt)}
                onUploadImage={(file) => uploadChapterImage(currentPage.id, file)}
                resources={resources}
                onResourceUpserted={upsertResource}
                onNext={() => {
                  if (activeChapterIndex < chapterPages.length - 1) {
                    navigateChapter(activeChapterIndex + 1)
                  } else {
                    // New stage order: Chapters → Book Design → Pre-Publish
                    // → Publish. After the last chapter we drop into the
                    // visual-layer stage (cover, chapter images, back
                    // cover) before the pre-publish review.
                    setStage('book-design')
                  }
                }}
                onPrev={() => {
                  if (activeChapterIndex > 0) {
                    navigateChapter(activeChapterIndex - 1)
                  } else {
                    setStage('outline')
                  }
                }}
              />
            )}
            {stage === 'radar' && (
              <CreatorRadarStage
                book={book}
                plan={radarPlan}
                onStageChange={setStage}
              />
            )}
            {stage === 'book-design' && (
              <BookDesignStage
                book={book}
                chapters={chapterPages}
                coverImageUrl={coverImageUrl}
                coverImageStatus={coverImageStatus}
                coverImageError={coverImageError}
                onGenerateCover={(mode) => generateCoverImage({ mode })}
                onUploadCover={handleCoverUpload}
                imageStatuses={imageStatuses}
                imageErrors={imageErrors}
                onGenerateChapterImage={(pageId) => generateChapterImage(pageId)}
                onUploadChapterImage={(pageId, file) => uploadChapterImage(pageId, file)}
                authorNamePlaceholder={authorNamePlaceholder}
                authorPhotoUrl={authorPhotoUrl}
                mascotUrl={mascotUrl}
                onContinue={() => setStage('pre-publish')}
              />
            )}
            {stage === 'pre-publish' && (
              <PrePublishStage
                book={book}
                onPublish={() => setStage('publish')}
                onNavigate={(target, chapterIndex) => {
                  // When the Fix-It link points at a specific chapter, jump
                  // straight there. Otherwise just switch stage.
                  if (target === 'chapter' && typeof chapterIndex === 'number') {
                    navigateChapter(chapterIndex)
                  } else {
                    setStage(target)
                  }
                }}
              />
            )}
            {stage === 'publish' && (
              <PublishStage
                book={book}
                publishedBook={publishedBook}
                hasStripeConnect={hasStripeConnect}
                hasCtaChapter={hasCtaChapter}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  )
}
