'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, Wand2, Check, ChevronLeft, ChevronRight, Send, Lock } from 'lucide-react'
import type { Book, BookPage } from '@/types/database'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  book: Book
  page: BookPage
  pageIndex: number
  totalPages: number
  onPageUpdate: (page: BookPage) => void
  onNext: () => void
  onPrev: () => void
}

export function ChapterStage({ book, page, pageIndex, totalPages, onPageUpdate, onNext, onPrev }: Props) {
  const [draft, setDraft] = useState(page?.content ?? '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(page?.approved ?? false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(page?.content ?? '')
    setApproved(page?.approved ?? false)
    setMessages([])
  }, [page?.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function generateDraft() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/books/${book.id}/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: page.id }),
      })
      const json = await res.json()
      if (json.content) {
        setDraft(json.content)
        onPageUpdate({ ...page, content: json.content })
        setMessages([{
          role: 'assistant',
          content: "Draft generated. Tell me what to change — I can adjust the tone, expand any section, or rewrite from a different angle.",
        }])
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
      const json = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: json.reply }])
      if (json.draftUpdated) {
        setDraft(json.reply)
        onPageUpdate({ ...page, content: json.reply })
      }
    } finally {
      setChatLoading(false)
    }
  }

  async function toggleApprove() {
    setApproving(true)
    try {
      const res = await fetch(`/api/books/${book.id}/approve-chapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: page.id, approved: !approved }),
      })
      const json = await res.json()
      setApproved(!approved)
      onPageUpdate({ ...page, approved: !approved })
    } finally {
      setApproving(false)
    }
  }

  if (!page) return null

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
              <button onClick={onPrev} disabled={pageIndex === 0 && true} className="p-1 text-muted-foreground hover:text-cream disabled:opacity-30 transition-colors">
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
              onPageUpdate({ ...page, content: e.target.value })
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
