'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, Image, Sparkles, FileText, Download } from 'lucide-react'
import Link from 'next/link'
import type { Book, BookPage } from '@/types/database'

interface Props {
  book: Book
  pages: BookPage[]
}

export function CompleteStage({ book, pages }: Props) {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(book.status === 'ready')
  const [error, setError] = useState('')

  const approvedCount = pages.filter((p) => p.approved).length

  async function generateImages() {
    setGenerating(true)
    setError('')
    setProgress(0)

    try {
      const res = await fetch(`/api/books/${book.id}/generate-images`, {
        method: 'POST',
      })

      if (!res.ok) throw new Error('Image generation failed')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Stream unavailable')
      const decoder = new TextDecoder()

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.progress !== undefined) setProgress(data.progress)
            if (data.done) { setDone(true); setGenerating(false) }
          } catch {
            // partial JSON line, skip
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-16 text-center">
      {done ? (
        <div className="space-y-6">
          <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-accent" />
          </div>
          <div>
            <h2 className="font-playfair text-3xl text-cream mb-2">Your book is ready.</h2>
            <p className="text-muted-foreground font-source-serif text-sm">
              All illustrations have been generated. Preview, publish, or export below.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href={`/book/${book.id}/preview`}
              className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors"
            >
              Preview Flipbook
            </Link>
            <Link
              href={`/book/${book.id}/publish`}
              className="px-5 py-2.5 bg-gold hover:bg-gold/90 text-canvas font-inter text-sm font-semibold rounded-md transition-colors"
            >
              Publish
            </Link>
            <a
              href={`/api/books/${book.id}/export-pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-5 py-2.5 border border-[#333] hover:border-[#444] text-muted-foreground hover:text-cream font-inter text-sm rounded-md transition-colors"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </a>
            <a
              href={`/api/books/${book.id}/export-html`}
              className="flex items-center gap-1.5 px-5 py-2.5 border border-[#333] hover:border-[#444] text-muted-foreground hover:text-cream font-inter text-sm rounded-md transition-colors"
            >
              <Download className="w-4 h-4" />
              Export HTML
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-gold" />
          </div>
          <div>
            <h2 className="font-playfair text-3xl text-cream mb-2">All chapters approved.</h2>
            <p className="text-muted-foreground font-source-serif text-sm max-w-sm mx-auto">
              Generate one illustration per chapter using the Gemini AI image model. This may take a few minutes.
            </p>
          </div>

          <div className="bg-[#222] border border-[#333] rounded-xl p-6 text-left space-y-3">
            <div className="flex items-center gap-2 text-sm font-inter text-cream/80">
              <Image className="w-4 h-4 text-gold" />
              <span>{approvedCount} chapter illustration{approvedCount !== 1 ? 's' : ''} to generate</span>
            </div>
            <p className="text-xs font-source-serif text-muted-foreground">
              Style: {book.visual_style?.replace(/_/g, ' ')} · Persona: {book.persona}
            </p>
          </div>

          {generating && (
            <div className="space-y-2">
              <div className="bg-[#2A2A2A] rounded-full h-2">
                <div
                  className="bg-gold h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs font-inter text-muted-foreground">
                {progress}% — generating illustrations...
              </p>
            </div>
          )}

          {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

          <button
            onClick={generateImages}
            disabled={generating}
            className="flex items-center gap-2 mx-auto px-8 py-3 bg-gold hover:bg-gold/90 text-canvas font-inter font-semibold rounded-md transition-colors disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating ? 'Generating...' : 'Generate Illustrations'}
          </button>
        </div>
      )}
    </div>
  )
}
