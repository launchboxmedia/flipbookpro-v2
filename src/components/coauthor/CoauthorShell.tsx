'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { OutlineStage } from './OutlineStage'
import { ChapterStage } from './ChapterStage'
import { BackMatterStage } from './BackMatterStage'
import { CompleteStage } from './CompleteStage'
import type { Book, BookPage } from '@/types/database'

export type CoauthorStage = 'outline' | 'chapter' | 'back-matter' | 'complete'
export type ImageStatus = 'idle' | 'generating' | 'done' | 'error'

interface Props {
  book: Book
  pages: BookPage[]
  userEmail: string
  isPremium?: boolean
  isAdmin?: boolean
  initialStage?: CoauthorStage
}

export function CoauthorShell({ book, pages: initialPages, userEmail, isPremium, isAdmin, initialStage = 'outline' }: Props) {
  const [pages, setPages] = useState<BookPage[]>(initialPages)
  const [stage, setStage] = useState<CoauthorStage>(initialStage)
  const [activeChapterIndex, setActiveChapterIndex] = useState(0)
  const [imageStatuses, setImageStatuses] = useState<Record<string, ImageStatus>>({})
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({})
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(book.cover_image_url)
  const [coverImageStatus, setCoverImageStatus] = useState<ImageStatus>('idle')
  const [coverImageError, setCoverImageError] = useState<string | null>(null)
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

  const generateCoverImage = useCallback(async (customPrompt?: string) => {
    setCoverImageStatus('generating')
    setCoverImageError(null)
    try {
      const res = await fetch(`/api/books/${book.id}/generate-cover-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt }),
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

  const currentPage = chapterPages[activeChapterIndex]
  const currentImageStatus = currentPage
    ? (imageStatuses[currentPage.id] ?? (currentPage.image_url ? 'done' : 'idle'))
    : 'idle'
  const currentImageError = currentPage ? (imageErrors[currentPage.id] ?? null) : null

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <AppSidebar
        userEmail={userEmail}
        isPremium={isPremium}
        isAdmin={isAdmin}
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
          hasDiscover: false,
          onStageChange: setStage,
          onChapterSelect: navigateChapter,
          onGenerateCover: generateCoverImage,
          onCoverUpload: handleCoverUpload,
        }}
      />

      <main className="flex-1 overflow-auto">
        {stage === 'outline' && (
          <OutlineStage
            book={book}
            pages={chapterPages}
            onPagesChange={(updated) => {
              // Merge updated chapter pages back into the full pages state,
              // preserving back-matter pages and any image_url values.
              const updatedById = Object.fromEntries(updated.map((p) => [p.id, p]))
              setPages((prev) => prev.map((p) => {
                if (!updatedById[p.id]) return p
                const merged = { ...p, ...updatedById[p.id] }
                if (!updatedById[p.id].image_url && p.image_url) merged.image_url = p.image_url
                return merged
              }))
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
            imageStatus={currentImageStatus}
            imageError={currentImageError}
            visualStyle={visualStyle}
            onChangeStyle={changeVisualStyle}
            palette={palette}
            onChangePalette={changePalette}
            onPageUpdate={(changes) => updatePage(changes)}
            onGenerateImage={(customPrompt) => generateChapterImage(currentPage.id, customPrompt)}
            onUploadImage={(file) => uploadChapterImage(currentPage.id, file)}
            onNext={() => {
              if (activeChapterIndex < chapterPages.length - 1) {
                navigateChapter(activeChapterIndex + 1)
              } else {
                setStage('back-matter')
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
        {stage === 'back-matter' && (
          <BackMatterStage
            book={book}
            onComplete={() => setStage(allApproved ? 'complete' : 'outline')}
          />
        )}
        {stage === 'complete' && (
          <CompleteStage book={book} pages={chapterPages} />
        )}
      </main>
    </div>
  )
}
