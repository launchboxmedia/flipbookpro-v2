'use client'

import Link from 'next/link'
import { ArrowLeft, List, BookOpen, FileText, Eye, Globe, Download, CheckCircle2, Circle, Dot } from 'lucide-react'
import type { Book, BookPage } from '@/types/database'
import type { CoauthorStage } from './CoauthorShell'

interface Props {
  book: Book
  pages: BookPage[]
  stage: CoauthorStage
  activeChapterIndex: number
  allApproved: boolean
  onStageChange: (stage: CoauthorStage) => void
  onChapterSelect: (index: number) => void
}

export function CoauthorSidebar({
  book, pages, stage, activeChapterIndex, allApproved,
  onStageChange, onChapterSelect,
}: Props) {
  return (
    <aside className="w-64 bg-[#1E1E1E] border-r border-[#333] flex flex-col shrink-0 overflow-y-auto">
      <div className="p-4 border-b border-[#333]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-muted-foreground hover:text-cream text-sm font-inter transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Library
        </Link>
        <p className="font-playfair text-cream text-sm mt-3 leading-tight truncate" title={book.title}>
          {book.title}
        </p>
      </div>

      <div className="flex-1 p-3 space-y-6">
        <nav className="space-y-1">
          <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Build
          </p>

          <button
            onClick={() => onStageChange('outline')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-inter transition-colors ${
              stage === 'outline'
                ? 'bg-accent/20 text-accent'
                : 'text-cream/70 hover:text-cream hover:bg-[#2A2A2A]'
            }`}
          >
            <List className="w-4 h-4" />
            Outline
          </button>

          <div>
            <button
              onClick={() => onStageChange('chapter')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-inter transition-colors ${
                stage === 'chapter'
                  ? 'bg-accent/20 text-accent'
                  : 'text-cream/70 hover:text-cream hover:bg-[#2A2A2A]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Chapters
            </button>

            {pages.length > 0 && (
              <div className="ml-7 mt-1 space-y-0.5">
                {pages.map((page, i) => (
                  <button
                    key={page.id}
                    onClick={() => onChapterSelect(i)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-inter transition-colors text-left ${
                      stage === 'chapter' && activeChapterIndex === i
                        ? 'text-gold'
                        : 'text-muted-foreground hover:text-cream'
                    }`}
                  >
                    {page.approved ? (
                      <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                    ) : stage === 'chapter' && activeChapterIndex === i ? (
                      <span className="w-2 h-2 rounded-full bg-gold shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#444] shrink-0" />
                    )}
                    <span className="truncate">{page.chapter_title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onStageChange('back-matter')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-inter transition-colors ${
              stage === 'back-matter'
                ? 'bg-accent/20 text-accent'
                : 'text-cream/70 hover:text-cream hover:bg-[#2A2A2A]'
            }`}
          >
            <FileText className="w-4 h-4" />
            Back Matter
          </button>
        </nav>

        <nav className="space-y-1">
          <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Review & Export
          </p>

          <Link
            href={`/book/${book.id}/preview`}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-inter text-cream/70 hover:text-cream hover:bg-[#2A2A2A] transition-colors"
          >
            <Eye className="w-4 h-4" />
            Preview
          </Link>

          {allApproved && (
            <button
              onClick={() => onStageChange('complete')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-inter transition-colors ${
                stage === 'complete'
                  ? 'bg-gold/20 text-gold'
                  : 'text-cream/70 hover:text-cream hover:bg-[#2A2A2A]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Generate Book
            </button>
          )}
        </nav>
      </div>

      <div className="p-4 border-t border-[#333]">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[#2A2A2A] rounded-full h-1.5">
            <div
              className="bg-accent h-1.5 rounded-full transition-all"
              style={{
                width: `${pages.length > 0 ? (pages.filter((p) => p.approved).length / pages.length) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-xs font-inter text-muted-foreground">
            {pages.filter((p) => p.approved).length}/{pages.length}
          </span>
        </div>
      </div>
    </aside>
  )
}
