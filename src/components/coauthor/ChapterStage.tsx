'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, Wand2, Check, ChevronLeft, ChevronRight, Send, Lock, ImageIcon, RefreshCw, X, Sparkles, AlertTriangle, Eye, MessageSquareWarning, FileText, Lightbulb, Upload } from 'lucide-react'
import type { Book, BookPage } from '@/types/database'
import type { ImageStatus } from './CoauthorShell'
import { STYLE_OPTIONS } from '@/lib/imageStyles'
import { PALETTES } from '@/lib/palettes'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

type ChapterFlagType = 'OPENING' | 'CLARITY' | 'VOICE' | 'FLOW' | 'EXAMPLE' | 'CLOSING' | 'BRIEF_DRIFT'

interface ChapterFlag {
  type: ChapterFlagType
  issue: string
  suggestion: string
  severity: 'low' | 'medium' | 'high'
}

// Quick prompt modifiers — appended to the user's prompt with ". " between
// them. Designed to be additive (each tweaks one dimension) so users can
// stack a few before hitting Regenerate.
const CHAPTER_PROMPT_MODS: ReadonlyArray<string> = [
  'more dramatic lighting',
  'tighter framing',
  'wider, more atmospheric',
  'warmer tone',
  'cooler tone',
  'different angle',
  'more minimal',
  'more detailed',
  'softer mood',
  'more graphic / abstract',
]

const FLAG_META: Record<ChapterFlagType, { label: string; icon: React.ReactNode; color: string }> = {
  OPENING:     { label: 'Opening',      icon: <Sparkles className="w-3 h-3" />,            color: 'bg-amber-100 text-amber-800 border-amber-200' },
  CLARITY:     { label: 'Clarity',      icon: <Eye className="w-3 h-3" />,                 color: 'bg-blue-100 text-blue-800 border-blue-200' },
  VOICE:       { label: 'Voice',        icon: <MessageSquareWarning className="w-3 h-3"/>, color: 'bg-purple-100 text-purple-800 border-purple-200' },
  FLOW:        { label: 'Flow',         icon: <FileText className="w-3 h-3" />,            color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  EXAMPLE:     { label: 'Example',      icon: <Lightbulb className="w-3 h-3" />,           color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  CLOSING:     { label: 'Closing',      icon: <FileText className="w-3 h-3" />,            color: 'bg-orange-100 text-orange-800 border-orange-200' },
  BRIEF_DRIFT: { label: 'Brief drift',  icon: <AlertTriangle className="w-3 h-3" />,       color: 'bg-rose-100 text-rose-800 border-rose-200' },
}

interface Props {
  book: Book
  page: BookPage
  pageIndex: number
  totalPages: number
  imageStatus: ImageStatus
  imageError: string | null
  visualStyle: string | null
  onChangeStyle: (newStyle: string) => void | Promise<void>
  palette: string | null
  onChangePalette: (newPalette: string) => void | Promise<void>
  onPageUpdate: (changes: { id: string } & Partial<BookPage>) => void
  onGenerateImage: (customPrompt?: string) => void
  onUploadImage: (file: File) => void
  onNext: () => void
  onPrev: () => void
}

export function ChapterStage({
  book, page, pageIndex, totalPages,
  imageStatus, imageError, visualStyle, onChangeStyle,
  palette, onChangePalette,
  onPageUpdate, onGenerateImage, onUploadImage,
  onNext, onPrev,
}: Props) {
  const [draft, setDraft] = useState(page?.content ?? '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(page?.approved ?? false)
  const [imagePrompt, setImagePrompt] = useState('')
  const imageFileInputRef = useRef<HTMLInputElement>(null)
  const [flags, setFlags] = useState<ChapterFlag[]>([])
  const [dismissedFlags, setDismissedFlags] = useState<Set<number>>(new Set())
  const [analyzing, setAnalyzing] = useState(false)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [applyingFlag, setApplyingFlag] = useState<number | null>(null)
  const [analyzeError, setAnalyzeError] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(page?.content ?? '')
    setApproved(page?.approved ?? false)
    setMessages([])
    setImagePrompt('')
    setFlags([])
    setDismissedFlags(new Set())
    setHasAnalyzed(false)
    setAnalyzeError('')
  }, [page?.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function generateDraft() {
    setGenerating(true)
    setDraft('')
    try {
      const res = await fetch(`/api/books/${book.id}/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: page.id }),
      })
      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.delta) {
              accumulated += data.delta
              setDraft(accumulated)
            }
            if (data.done) {
              onPageUpdate({ id: page.id, content: accumulated })
              setMessages([{
                role: 'assistant',
                content: "Draft generated. Tell me what to change — I can adjust the tone, expand any section, or rewrite from a different angle.",
              }])
            }
          } catch {
            // partial JSON line, skip
          }
        }
      }
    } finally {
      setGenerating(false)
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return
    const userMsg: ChatMessage = { role: 'user', content: chatInput }
    setMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch(`/api/books/${book.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: page.id,
          messages: [...messages, userMsg],
          currentDraft: draft,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || typeof json.reply !== 'string') {
        throw new Error(json.error ?? `Chat failed (${res.status})`)
      }
      setDraft(json.reply)
      onPageUpdate({ id: page.id, content: json.reply })
      setMessages((prev) => [...prev, { role: 'assistant', content: '✓ Draft updated.' }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Chat failed'
      // Roll back the optimistic user message and show the error
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: `⚠ ${msg}` }])
    } finally {
      setChatLoading(false)
    }
  }

  async function toggleApprove() {
    if (approving) return
    setApproving(true)
    const newApproved = !approved
    try {
      const res = await fetch(`/api/books/${book.id}/approve-chapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: page.id, approved: newApproved }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Approve failed (${res.status})`)
      }
      setApproved(newApproved)
      onPageUpdate({ id: page.id, approved: newApproved })

      // Auto-trigger image generation when approving if no image has been generated yet.
      // Use imageStatus (not page.image_url) to avoid stale-closure false triggers.
      if (newApproved && imageStatus === 'idle') {
        onGenerateImage()
      }
    } catch (e) {
      console.error('[toggleApprove]', e)
    } finally {
      setApproving(false)
    }
  }

  function handleGenerateImage() {
    onGenerateImage(imagePrompt.trim() || undefined)
  }

  function appendModifier(mod: string) {
    setImagePrompt((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return mod
      // Avoid duplicate modifiers
      if (trimmed.toLowerCase().includes(mod.toLowerCase())) return prev
      return `${trimmed}. ${mod}`
    })
  }

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onUploadImage(file)
    e.target.value = ''
  }

  async function runAnalysis() {
    if (analyzing) return
    setAnalyzing(true)
    setAnalyzeError('')
    setFlags([])
    setDismissedFlags(new Set())
    try {
      const res = await fetch(`/api/books/${book.id}/critique-chapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: page.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Analysis failed (${res.status})`)
      setFlags(Array.isArray(json.flags) ? json.flags : [])
      setHasAnalyzed(true)
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function applyFlag(flagIndex: number) {
    const flag = flags[flagIndex]
    if (!flag || approved || applyingFlag !== null) return
    setApplyingFlag(flagIndex)
    setChatLoading(true)
    // Append a synthetic chat exchange so the user sees what was applied
    const feedback = `${flag.issue} — ${flag.suggestion}`
    const userMsg: ChatMessage = { role: 'user', content: `[Apply: ${FLAG_META[flag.type].label}] ${feedback}` }
    setMessages((prev) => [...prev, userMsg])
    try {
      const res = await fetch(`/api/books/${book.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: page.id,
          messages: [...messages, userMsg],
          currentDraft: draft,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || typeof json.reply !== 'string') {
        throw new Error(json.error ?? `Apply failed (${res.status})`)
      }
      setDraft(json.reply)
      onPageUpdate({ id: page.id, content: json.reply })
      setMessages((prev) => [...prev, { role: 'assistant', content: '✓ Draft updated.' }])
      dismissFlag(flagIndex)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Apply failed'
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: `⚠ ${msg}` }])
    } finally {
      setApplyingFlag(null)
      setChatLoading(false)
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

  if (!page) return null

  const imageUrl = page.image_url
  const isGeneratingImage = imageStatus === 'generating'
  const hasImageError = imageStatus === 'error'
  const selectedStyle = STYLE_OPTIONS.some((o) => o.id === visualStyle)
    ? (visualStyle as string)
    : STYLE_OPTIONS[0].id
  const selectedPalette = palette ?? 'teal-cream'

  return (
    <div className="flex h-full">
      {/* Left panel — brief + chat */}
      <div className="w-80 border-r border-[#333] bg-[#1E1E1E] flex flex-col shrink-0">
        <div className="p-5 border-b border-[#333]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-inter text-muted-foreground uppercase tracking-wider">
              Chapter {pageIndex + 1} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button onClick={onPrev} className="p-1 text-muted-foreground hover:text-cream transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={onNext} className="p-1 text-muted-foreground hover:text-cream transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <h3 className="font-playfair text-cream text-lg leading-tight">{page.chapter_title}</h3>
          {page.chapter_brief && (
            <p className="text-muted-foreground text-xs font-source-serif mt-2 leading-relaxed">
              {page.chapter_brief}
            </p>
          )}
        </div>

        {/* Illustration section */}
        <div className="p-4 border-b border-[#333]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">
              Illustration
            </span>
          </div>

          <div className="mb-2">
            <label className="block text-[10px] font-inter text-muted-foreground uppercase tracking-wider mb-1">
              Style (whole book)
            </label>
            <select
              value={selectedStyle}
              onChange={(e) => onChangeStyle(e.target.value)}
              disabled={isGeneratingImage}
              className="w-full px-2 py-1.5 rounded-md bg-[#2A2A2A] border border-[#333] text-cream text-xs font-inter focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
            >
              {STYLE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="mb-2">
            <label className="block text-[10px] font-inter text-muted-foreground uppercase tracking-wider mb-1">
              Palette (whole book)
            </label>
            <select
              value={selectedPalette}
              onChange={(e) => onChangePalette(e.target.value)}
              disabled={isGeneratingImage}
              className="w-full px-2 py-1.5 rounded-md bg-[#2A2A2A] border border-[#333] text-cream text-xs font-inter focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
            >
              {PALETTES.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="brand">Use my brand colors</option>
            </select>
          </div>

          {isGeneratingImage ? (
            <div className="w-full aspect-video bg-[#2A2A2A] rounded-md flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span className="text-xs text-muted-foreground font-inter">Generating…</span>
            </div>
          ) : imageUrl ? (
            <ImageLightbox src={imageUrl} alt={page.chapter_title}>
              <img
                src={imageUrl}
                alt={page.chapter_title}
                className="w-full aspect-video object-cover rounded-md"
              />
            </ImageLightbox>
          ) : (
            <div className="w-full aspect-video bg-[#2A2A2A] rounded-md flex flex-col items-center justify-center gap-2 border border-dashed border-[#444]">
              <ImageIcon className="w-5 h-5 text-[#555]" />
              <span className="text-xs text-muted-foreground font-inter text-center px-4">
                {hasImageError ? 'Generation failed' : 'Auto-generates on approve'}
              </span>
              {imageError && (
                <span className="text-[10px] text-red-400/70 font-inter text-center px-4 leading-tight">
                  {imageError}
                </span>
              )}
              {hasImageError && (
                <button
                  onClick={() => onGenerateImage()}
                  className="text-xs text-accent hover:text-accent/80 font-inter underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* ── Always-visible prompt window ─────────────────────────── */}
          <div className="mt-3 space-y-2">
            <label className="block text-[10px] font-inter text-muted-foreground uppercase tracking-wider">
              Image prompt
              <span className="ml-1 normal-case tracking-normal text-cream/40 text-[10px]">— leave blank for AI auto-scene</span>
            </label>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Describe what you want, or leave blank to let the AI pick a scene from the chapter…"
              rows={3}
              disabled={isGeneratingImage}
              className="w-full px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-muted-foreground text-xs font-inter focus:outline-none focus:ring-1 focus:ring-accent resize-none disabled:opacity-50"
            />

            <div className="flex flex-wrap gap-1">
              {CHAPTER_PROMPT_MODS.map((mod) => (
                <button
                  key={mod}
                  onClick={() => appendModifier(mod)}
                  disabled={isGeneratingImage}
                  className="px-2 py-0.5 text-[10px] font-inter text-cream/60 bg-[#2A2A2A] hover:bg-[#333] hover:text-cream border border-[#333] rounded-full transition-colors disabled:opacity-40"
                  title={`Append: ${mod}`}
                >
                  + {mod}
                </button>
              ))}
              {imagePrompt && (
                <button
                  onClick={() => setImagePrompt('')}
                  disabled={isGeneratingImage}
                  className="px-2 py-0.5 text-[10px] font-inter text-cream/40 hover:text-red-400 transition-colors disabled:opacity-40"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-accent hover:bg-accent/90 text-cream text-xs font-inter rounded-md transition-colors disabled:opacity-50"
              >
                {isGeneratingImage ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : imageUrl ? (
                  <RefreshCw className="w-3 h-3" />
                ) : (
                  <Wand2 className="w-3 h-3" />
                )}
                {isGeneratingImage ? 'Generating…' : imageUrl ? 'Regenerate' : 'Generate Image'}
              </button>
              <button
                onClick={() => imageFileInputRef.current?.click()}
                disabled={isGeneratingImage}
                title="Upload your own image (PNG, JPEG, or WebP, up to 5 MB)"
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-[#333] hover:border-accent/40 text-muted-foreground hover:text-cream text-xs font-inter rounded-md transition-colors disabled:opacity-50"
              >
                <Upload className="w-3 h-3" />
                Upload
              </button>
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageFileChange}
                className="hidden"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-muted-foreground text-xs font-source-serif text-center py-8 px-4">
              Generate a draft, then use the chat to refine it.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`text-xs font-source-serif leading-relaxed rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-accent/10 text-cream/90 ml-4'
                  : 'bg-[#2A2A2A] text-cream/70 mr-4'
              }`}
            >
              {msg.content}
            </div>
          ))}
          {chatLoading && (
            <div className="bg-[#2A2A2A] rounded-lg p-3 mr-4 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Writing...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 border-t border-[#333]">
          <div className="flex gap-2 items-end">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendChat()
                }
              }}
              placeholder="Ask for changes…  (Enter to send, Shift+Enter for new line)"
              disabled={!draft || approved}
              rows={3}
              className="flex-1 px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-muted-foreground text-xs font-inter focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40 resize-y min-h-[64px] max-h-[200px] leading-relaxed"
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || chatLoading || !draft || approved}
              className="p-2 bg-accent hover:bg-accent/90 text-cream rounded-md transition-colors disabled:opacity-40 shrink-0"
              title="Send (Enter)"
              aria-label="Send"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right panel — cream writing surface (the manuscript) */}
      <div className="flex-1 flex flex-col bg-cream-1 overflow-hidden">
        <div className="px-8 py-5 border-b border-cream-3 flex items-center justify-between bg-cream-2">
          <div className="flex items-center gap-3">
            <button
              onClick={generateDraft}
              disabled={generating || approved}
              className="flex items-center gap-2 px-4 py-2 bg-ink-1 hover:bg-ink-2 text-cream text-sm font-inter rounded-md transition-colors disabled:opacity-50 shadow-sm"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-gold" />}
              {generating ? 'Generating…' : 'Generate Draft'}
            </button>
            <button
              onClick={runAnalysis}
              disabled={analyzing || !draft || draft.trim().length < 50}
              title={!draft || draft.trim().length < 50 ? 'Generate or paste a draft first' : 'AI analysis of the draft'}
              className="flex items-center gap-2 px-4 py-2 bg-cream-3 hover:bg-cream-3/80 border border-cream-3 text-ink-1 text-sm font-inter rounded-md transition-colors disabled:opacity-50"
            >
              {analyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasAnalyzed ? (
                <RefreshCw className="w-4 h-4 text-gold-dim" />
              ) : (
                <Sparkles className="w-4 h-4 text-gold-dim" />
              )}
              {analyzing ? 'Analyzing…' : hasAnalyzed ? 'Re-analyze' : 'Analyze Draft'}
            </button>
          </div>

          <button
            onClick={toggleApprove}
            disabled={approving || !draft}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-inter font-medium rounded-md transition-colors disabled:opacity-40 ${
              approved
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
            }`}
          >
            {approving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : approved ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {approved ? 'Approved — click to unapprove' : 'Approve Chapter'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-10 py-10">
          {approved && (
            <div className="mb-4 flex items-center gap-2 text-emerald-700 text-xs font-inter">
              <Lock className="w-3.5 h-3.5" />
              Chapter locked. Unapprove to edit.
            </div>
          )}

          {analyzeError && (
            <div className="mb-4 px-3 py-2 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-inter">
              {analyzeError}
            </div>
          )}

          {hasAnalyzed && !analyzing && visibleFlags.length === 0 && flags.length === 0 && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-inter">
              <Check className="w-3.5 h-3.5" />
              No issues found — draft looks solid.
            </div>
          )}

          {visibleFlags.length > 0 && (
            <div className="mb-6 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-inter font-medium text-ink-1/70 uppercase tracking-wider">
                  AI Analysis · {visibleFlags.length} flag{visibleFlags.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => setDismissedFlags(new Set(flags.map((_, i) => i)))}
                  className="text-[11px] font-inter text-ink-1/50 hover:text-ink-1 transition-colors"
                >
                  Dismiss all
                </button>
              </div>
              {visibleFlags.map((flag) => {
                const originalIndex = flags.indexOf(flag)
                const meta = FLAG_META[flag.type]
                const isApplying = applyingFlag === originalIndex
                return (
                  <div
                    key={originalIndex}
                    className="bg-white border border-cream-3 rounded-xl p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-inter font-semibold border ${meta.color}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                      <span className={`text-[10px] font-inter px-1.5 py-0.5 rounded ${
                        flag.severity === 'high'   ? 'bg-rose-100 text-rose-700'
                        : flag.severity === 'medium' ? 'bg-amber-100 text-amber-700'
                        : 'bg-ink-1/10 text-ink-1/60'
                      }`}>
                        {flag.severity}
                      </span>
                    </div>
                    <p className="text-ink-1 text-sm font-source-serif mb-1.5 leading-relaxed">
                      {flag.issue}
                    </p>
                    <p className="text-ink-1/60 text-xs font-source-serif italic mb-3 leading-relaxed">
                      {flag.suggestion}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => applyFlag(originalIndex)}
                        disabled={approved || applyingFlag !== null || chatLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-inter rounded-md transition-colors"
                        title={approved ? 'Unapprove to apply changes' : 'Send this suggestion to the chat to revise the draft'}
                      >
                        {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        {isApplying ? 'Applying…' : 'Apply'}
                      </button>
                      <button
                        onClick={() => dismissFlag(originalIndex)}
                        disabled={isApplying}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cream-3 hover:bg-cream-3/70 text-ink-1/60 text-[11px] font-inter rounded-md transition-colors disabled:opacity-40"
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

          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              onPageUpdate({ id: page.id, content: e.target.value })
            }}
            readOnly={approved}
            placeholder="Click 'Generate Draft' to create the chapter, or type directly…"
            className="w-full min-h-[500px] bg-transparent text-ink-1 font-source-serif text-base leading-relaxed resize-none focus:outline-none placeholder:text-ink-1/30 disabled:opacity-60"
          />
        </div>

        <div className="px-8 py-4 border-t border-cream-3 bg-cream-2 flex justify-between items-center">
          <button onClick={onPrev} className="flex items-center gap-1.5 text-sm font-inter text-ink-1/60 hover:text-ink-1 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            {pageIndex === 0 ? 'Outline' : `Chapter ${pageIndex}`}
          </button>
          <span className="text-xs font-inter text-ink-1/40">
            {draft ? `${draft.split(/\s+/).filter(Boolean).length} words` : ''}
          </span>
          <button onClick={onNext} className="flex items-center gap-1.5 text-sm font-inter text-ink-1/60 hover:text-ink-1 transition-colors">
            {pageIndex === totalPages - 1 ? 'Back Matter' : `Chapter ${pageIndex + 2}`}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
