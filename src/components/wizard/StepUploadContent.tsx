'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, ChevronRight, RotateCcw } from 'lucide-react'
import type { WizardData } from './WizardShell'

const MIN_CONTENT_LENGTH = 50

interface DetectedChapter {
  title: string
  brief: string
  content?: string | null
}

interface Props {
  data: WizardData
  bookId: string
  onNext: (patch: Partial<WizardData>) => void
}

type Phase = 'paste' | 'review'

export function StepUploadContent({ data, bookId, onNext }: Props) {
  const [text, setText] = useState(data.outline ?? '')
  const [phase, setPhase] = useState<Phase>(
    data.chapters.length > 0 ? 'review' : 'paste',
  )
  const [chapters, setChapters] = useState<DetectedChapter[]>(data.chapters)
  const [niche, setNiche] = useState(data.niche ?? '')
  const [detecting, setDetecting] = useState(false)
  const [importDrafts, setImportDrafts] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [detectError, setDetectError] = useState('')
  const [splitError, setSplitError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 480)}px`
  }, [text])

  async function detectChapters() {
    setDetecting(true)
    setDetectError('')
    try {
      const res = await fetch('/api/detect-chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outline: text, mode: 'upload' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Detection failed')
      if (!Array.isArray(json.chapters) || json.chapters.length === 0) {
        throw new Error('No chapters detected. Try adding chapter headings to your content.')
      }
      setChapters(json.chapters)
      setNiche(json.chapters[0]?.title ?? '')
      setPhase('review')
    } catch (e) {
      setDetectError(e instanceof Error ? e.message : 'Detection failed')
    } finally {
      setDetecting(false)
    }
  }

  async function handleImportToggle(checked: boolean) {
    setImportDrafts(checked)
    setSplitError('')

    if (!checked) {
      // ponytail: strip content field without mutating — spread omit
      setChapters(ch => ch.map(({ content: _c, ...rest }) => rest))
      return
    }

    setSplitting(true)
    try {
      const res = await fetch(`/api/books/${bookId}/split-chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, chapters }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Split failed')
      setChapters(json.chapters)
    } catch (e) {
      setSplitError(
        e instanceof Error ? e.message : 'Draft import failed — you can continue without it',
      )
      setImportDrafts(false)
    } finally {
      setSplitting(false)
    }
  }

  function handleContinue() {
    // ponytail: strip content before passing to onNext — WizardData.chapters is { title, brief } only
    const sanitised = chapters.map(({ content: _c, ...rest }) => rest)
    onNext({ outline: text, chapters: sanitised, niche: niche.trim() })
  }

  const canDetect = !detecting && text.trim().length >= MIN_CONTENT_LENGTH
  const canContinue = phase === 'review' && chapters.length > 0 && niche.trim().length >= 3

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Upload your content</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          Paste your manuscript, outline, or table of contents. AI will detect your chapters.
        </p>
      </div>

      {/* Paste phase */}
      {phase === 'paste' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-inter text-ink-1/50 mb-1.5">
              Your content
            </label>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste your table of contents, outline, or full manuscript…"
              className="w-full min-h-[220px] resize-none px-4 py-3 rounded-xl bg-white border border-cream-3 focus:outline-none focus:ring-2 focus:ring-gold/40 font-source-serif text-sm text-ink-1 placeholder:text-ink-1/30 transition-shadow"
              style={{ maxHeight: '480px' }}
            />
            <p className="text-xs text-ink-1/30 font-inter mt-1 text-right">
              {text.trim().length.toLocaleString()} chars
            </p>
          </div>

          {detectError && (
            <p className="text-sm text-red-500 font-inter">{detectError}</p>
          )}

          <button
            onClick={detectChapters}
            disabled={!canDetect}
            className="flex items-center gap-2 px-6 py-2.5 bg-gold hover:bg-gold-soft disabled:opacity-40 disabled:cursor-not-allowed text-ink-1 font-inter text-sm font-semibold rounded-lg transition-colors"
          >
            {detecting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Detecting chapters…</>
            ) : (
              <>Detect Chapters <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      )}

      {/* Review phase */}
      {phase === 'review' && (
        <div className="space-y-5">
          {/* Chapter list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-inter text-ink-1/50">
                {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} detected
              </label>
              <button
                onClick={() => { setPhase('paste'); setImportDrafts(false) }}
                className="flex items-center gap-1 text-xs font-inter text-gold hover:text-gold-soft transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Re-paste
              </button>
            </div>
            <div className="rounded-xl border border-cream-3 bg-white overflow-hidden">
              {chapters.map((ch, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-cream-3 last:border-0">
                  <span className="text-xs font-inter text-ink-1/30 mt-0.5 w-5 shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-inter text-ink-1 font-medium leading-snug">{ch.title}</p>
                    {ch.brief && (
                      <p className="text-xs font-source-serif text-ink-1/50 mt-0.5 line-clamp-2">{ch.brief}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Import drafts toggle */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-cream-2 border border-cream-3">
            <button
              role="checkbox"
              aria-checked={importDrafts}
              onClick={() => !splitting && handleImportToggle(!importDrafts)}
              disabled={splitting}
              className={`mt-0.5 w-10 h-5 rounded-full transition-colors shrink-0 relative ${importDrafts ? 'bg-gold' : 'bg-ink-1/20'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${importDrafts ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-inter text-ink-1 font-medium">
                Import existing text as chapter drafts
              </p>
              <p className="text-xs font-source-serif text-ink-1/50 mt-0.5">
                AI will split your manuscript into per-chapter drafts you can edit in the writing stage.
              </p>
              {splitting && (
                <p className="flex items-center gap-1.5 text-xs font-inter text-gold mt-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Splitting chapters…
                </p>
              )}
              {splitError && (
                <p className="text-xs font-inter text-red-500 mt-1.5">{splitError}</p>
              )}
            </div>
          </div>

          {/* Niche input */}
          <div className="space-y-1">
            <label className="block text-xs font-inter text-ink-1/50">
              What&apos;s this book about? <span className="text-ink-1/30">(one line)</span>
            </label>
            <input
              type="text"
              value={niche}
              onChange={e => setNiche(e.target.value)}
              placeholder="e.g. Practical guide to youth football tryouts"
              className="w-full px-4 py-2.5 rounded-lg bg-white border border-cream-3 focus:outline-none focus:ring-2 focus:ring-gold/40 font-inter text-sm text-ink-1 placeholder:text-ink-1/30"
            />
          </div>

          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="flex items-center gap-2 px-6 py-2.5 bg-gold hover:bg-gold-soft disabled:opacity-40 disabled:cursor-not-allowed text-ink-1 font-inter text-sm font-semibold rounded-lg transition-colors"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
