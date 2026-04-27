'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, Wand2, Check, ChevronLeft, ChevronRight, Send, Lock, ImageIcon, RefreshCw, X } from 'lucide-react'
import type { Book, BookPage } from '@/types/database'
import type { ImageStatus } from './CoauthorShell'
import { STYLE_OPTIONS } from '@/lib/imageStyles'
import { PALETTES } from '@/lib/palettes'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
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
  onNext: () => void
  onPrev: () => void
}

export function ChapterStage({
  book, page, pageIndex, totalPages,
  imageStatus, imageError, visualStyle, onChangeStyle,
  palette, onChangePalette,
  onPageUpdate, onGenerateImage,
  onNext, onPrev,
}: Props) {
  const [draft, setDraft] = useState(page?.content ?? '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(page?.approved ?? false)
  const [showImagePrompt, setShowImagePrompt] = useState(false)
  const [customImagePrompt, setCustomImagePrompt] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(page?.content ?? '')
    setApproved(page?.approved ?? false)
    setMessages([])
    setShowImagePrompt(false)
    setCustomImagePrompt('')
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
    onGenerateImage(customImagePrompt.trim() || undefined)
    setShowImagePrompt(false)
    setCustomImagePrompt('')
  }

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
            {(imageUrl || hasImageError) && !isGeneratingImage && (
              <button
                onClick={() => setShowImagePrompt((v) => !v)}
                className="p-1 text-muted-foreground hover:text-cream transition-colors"
                title="Regenerate with custom prompt"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
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

          {showImagePrompt && (
            <div className="mt-2 space-y-2">
              <textarea
                value={customImagePrompt}
                onChange={(e) => setCustomImagePrompt(e.target.value)}
                placeholder="Optional: describe what you want…"
                rows={2}
                className="w-full px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-muted-foreground text-xs font-inter focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage}
                  className="flex-1 py-1.5 bg-accent hover:bg-accent/90 text-cream text-xs font-inter rounded-md transition-colors disabled:opacity-50"
                >
                  Generate
                </button>
                <button
                  onClick={() => { setShowImagePrompt(false); setCustomImagePrompt('') }}
                  className="p-1.5 text-muted-foreground hover:text-cream transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {!imageUrl && !isGeneratingImage && !showImagePrompt && (
            <button
              onClick={() => setShowImagePrompt(true)}
              className="mt-2 w-full py-1.5 border border-[#333] hover:border-accent/40 text-muted-foreground hover:text-cream text-xs font-inter rounded-md transition-colors flex items-center justify-center gap-1.5"
            >
              <Wand2 className="w-3 h-3" />
              Generate now
            </button>
          )}
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
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder="Ask for changes..."
              disabled={!draft || approved}
              className="flex-1 px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-muted-foreground text-xs font-inter focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || chatLoading || !draft || approved}
              className="p-2 bg-accent hover:bg-accent/90 text-cream rounded-md transition-colors disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right panel — draft */}
      <div className="flex-1 flex flex-col bg-canvas overflow-hidden">
        <div className="px-8 py-5 border-b border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={generateDraft}
              disabled={generating || approved}
              className="flex items-center gap-2 px-4 py-2 bg-[#2A2A2A] hover:bg-[#333] border border-[#333] text-cream text-sm font-inter rounded-md transition-colors disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-gold" />}
              {generating ? 'Generating...' : 'Generate Draft'}
            </button>
          </div>

          <button
            onClick={toggleApprove}
            disabled={approving || !draft}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-inter font-medium rounded-md transition-colors disabled:opacity-40 ${
              approved
                ? 'bg-accent/20 text-accent border border-accent/30 hover:bg-red-900/20 hover:text-red-400 hover:border-red-400/30'
                : 'bg-accent hover:bg-accent/90 text-cream'
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

        <div className="flex-1 overflow-y-auto px-8 py-8">
          {approved && (
            <div className="mb-4 flex items-center gap-2 text-accent text-xs font-inter">
              <Lock className="w-3.5 h-3.5" />
              Chapter locked. Unapprove to edit.
            </div>
          )}
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              onPageUpdate({ id: page.id, content: e.target.value })
            }}
            readOnly={approved}
            placeholder="Click 'Generate Draft' to create the chapter, or type directly..."
            className="w-full min-h-[500px] bg-transparent text-cream/90 font-source-serif text-base leading-relaxed resize-none focus:outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
        </div>

        <div className="px-8 py-4 border-t border-[#333] flex justify-between items-center">
          <button onClick={onPrev} className="flex items-center gap-1.5 text-sm font-inter text-muted-foreground hover:text-cream transition-colors">
            <ChevronLeft className="w-4 h-4" />
            {pageIndex === 0 ? 'Outline' : `Chapter ${pageIndex}`}
          </button>
          <span className="text-xs font-inter text-muted-foreground">
            {draft ? `${draft.split(/\s+/).filter(Boolean).length} words` : ''}
          </span>
          <button onClick={onNext} className="flex items-center gap-1.5 text-sm font-inter text-muted-foreground hover:text-cream transition-colors">
            {pageIndex === totalPages - 1 ? 'Back Matter' : `Chapter ${pageIndex + 2}`}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
