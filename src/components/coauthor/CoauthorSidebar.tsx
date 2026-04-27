'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, List, BookOpen, FileText, Eye, CheckCircle2, ImageIcon, Loader2, RefreshCw, Upload, X, Wand2, ZoomIn } from 'lucide-react'
import { ImageLightboxOverlay } from '@/components/ui/ImageLightbox'
import type { Book, BookPage } from '@/types/database'
import type { CoauthorStage } from './CoauthorShell'
import type { ImageStatus } from './CoauthorShell'

interface Props {
  book: Book
  pages: BookPage[]
  stage: CoauthorStage
  activeChapterIndex: number
  allApproved: boolean
  imageStatuses: Record<string, ImageStatus>
  coverImageUrl: string | null
  coverImageStatus: ImageStatus
  onStageChange: (stage: CoauthorStage) => void
  onChapterSelect: (index: number) => void
  onGenerateCover: (customPrompt?: string) => void
  onCoverUpload: (file: File) => void
}

export function CoauthorSidebar({
  book, pages, stage, activeChapterIndex, allApproved,
  imageStatuses, coverImageUrl, coverImageStatus,
  onStageChange, onChapterSelect, onGenerateCover, onCoverUpload,
}: Props) {
  const [showCoverPrompt, setShowCoverPrompt] = useState(false)
  const [coverPrompt, setCoverPrompt] = useState('')
  const [coverLightboxOpen, setCoverLightboxOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleGenerateCover() {
    onGenerateCover(coverPrompt.trim() || undefined)
    setShowCoverPrompt(false)
    setCoverPrompt('')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onCoverUpload(file)
    e.target.value = ''
  }

  const isCoverGenerating = coverImageStatus === 'generating'

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
        {/* Cover image section */}
        <div>
          <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Cover
          </p>

          {isCoverGenerating ? (
            <div className="mx-2 aspect-[2/3] bg-[#2A2A2A] rounded-md flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
              <span className="text-xs text-muted-foreground font-inter">Generating…</span>
            </div>
          ) : coverImageUrl ? (
            <div className="relative mx-2 group">
              <img
                src={coverImageUrl}
                alt="Cover"
                className="w-full aspect-[2/3] object-cover rounded-md"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
                <button
                  onClick={() => setCoverLightboxOpen(true)}
                  className="p-1.5 bg-[#1E1E1E]/80 rounded-md text-cream hover:text-accent transition-colors"
                  title="View enlarged"
                  aria-label="View enlarged cover"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowCoverPrompt((v) => !v)}
                  className="p-1.5 bg-[#1E1E1E]/80 rounded-md text-cream hover:text-accent transition-colors"
                  title="Regenerate cover"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 bg-[#1E1E1E]/80 rounded-md text-cream hover:text-accent transition-colors"
                  title="Upload image"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
              </div>
              <ImageLightboxOverlay
                src={coverImageUrl}
                alt={`${book.title} — cover`}
                open={coverLightboxOpen}
                onClose={() => setCoverLightboxOpen(false)}
              />
            </div>
          ) : (
            <div className="mx-2 aspect-[2/3] bg-[#2A2A2A] rounded-md flex flex-col items-center justify-center gap-2 border border-dashed border-[#444]">
              <ImageIcon className="w-5 h-5 text-[#555]" />
              <span className="text-xs text-muted-foreground font-inter text-center px-3">
                {coverImageStatus === 'error' ? 'Generation failed' : 'No cover yet'}
              </span>
            </div>
          )}

          {showCoverPrompt && (
            <div className="mx-2 mt-2 space-y-2">
              <textarea
                value={coverPrompt}
                onChange={(e) => setCoverPrompt(e.target.value)}
                placeholder="Optional: describe the cover…"
                rows={2}
                className="w-full px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-muted-foreground text-xs font-inter focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateCover}
                  disabled={isCoverGenerating}
                  className="flex-1 py-1.5 bg-accent hover:bg-accent/90 text-cream text-xs font-inter rounded-md transition-colors disabled:opacity-50"
                >
                  Generate
                </button>
                <button
                  onClick={() => { setShowCoverPrompt(false); setCoverPrompt('') }}
                  className="p-1.5 text-muted-foreground hover:text-cream transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {!coverImageUrl && !isCoverGenerating && !showCoverPrompt && (
            <div className="mx-2 mt-2 flex gap-2">
              <button
                onClick={() => setShowCoverPrompt(true)}
                className="flex-1 py-1.5 border border-[#333] hover:border-accent/40 text-muted-foreground hover:text-cream text-xs font-inter rounded-md transition-colors flex items-center justify-center gap-1"
              >
                <Wand2 className="w-3 h-3" />
                Generate
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-1.5 border border-[#333] hover:border-accent/40 text-muted-foreground hover:text-cream text-xs font-inter rounded-md transition-colors flex items-center justify-center gap-1"
              >
                <Upload className="w-3 h-3" />
                Upload
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

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
                {pages.map((page, i) => {
                  const imgStatus = imageStatuses[page.id] ?? (page.image_url ? 'done' : 'idle')
                  return (
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
                      <span className="truncate flex-1">{page.chapter_title}</span>
                      {imgStatus === 'generating' && (
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-accent shrink-0" />
                      )}
                      {imgStatus === 'done' && (
                        <ImageIcon className="w-2.5 h-2.5 text-accent/60 shrink-0" />
                      )}
                    </button>
                  )
                })}
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
