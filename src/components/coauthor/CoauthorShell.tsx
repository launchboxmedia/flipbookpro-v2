'use client'

import { useState } from 'react'
import { CoauthorSidebar } from './CoauthorSidebar'
import { OutlineStage } from './OutlineStage'
import { ChapterStage } from './ChapterStage'
import { BackMatterStage } from './BackMatterStage'
import { CompleteStage } from './CompleteStage'
import type { Book, BookPage } from '@/types/database'

export type CoauthorStage = 'outline' | 'chapter' | 'back-matter' | 'complete'

interface Props {
  book: Book
  pages: BookPage[]
}

export function CoauthorShell({ book, pages: initialPages }: Props) {
  const [pages, setPages] = useState<BookPage[]>(initialPages)
  const [stage, setStage] = useState<CoauthorStage>('outline')
  const [activeChapterIndex, setActiveChapterIndex] = useState(0)

  const chapterPages = pages
    .filter((p) => p.chapter_index >= 0)
    .sort((a, b) => a.chapter_index - b.chapter_index)

  function updatePage(updated: BookPage) {
    setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  function navigateChapter(index: number) {
    setActiveChapterIndex(index)
    setStage('chapter')
  }

  const allApproved = chapterPages.length > 0 && chapterPages.every((p) => p.approved)

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <CoauthorSidebar
        book={book}
        pages={chapterPages}
        stage={stage}
        activeChapterIndex={activeChapterIndex}
        onStageChange={setStage}
        onChapterSelect={navigateChapter}
        allApproved={allApproved}
      />

      <main className="flex-1 overflow-auto">
        {stage === 'outline' && (
          <OutlineStage
            book={book}
            pages={chapterPages}
            onPagesChange={setPages}
            onNavigateChapter={navigateChapter}
          />
        )}
        {stage === 'chapter' && (
          <ChapterStage
            book={book}
            page={chapterPages[activeChapterIndex]}
            pageIndex={activeChapterIndex}
            totalPages={chapterPages.length}
            onPageUpdate={updatePage}
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
