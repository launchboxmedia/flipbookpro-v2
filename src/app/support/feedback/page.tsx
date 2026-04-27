'use client'

import { useState } from 'react'
import { Send, Check } from 'lucide-react'

export default function FeedbackPage() {
  const [type, setType] = useState<'idea' | 'bug' | 'other'>('idea')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    // Simulate send — wire to a real endpoint when ready
    await new Promise((r) => setTimeout(r, 800))
    setSent(true)
    setSending(false)
  }

  return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="font-playfair text-3xl text-cream">Feedback</h2>
        <p className="text-muted-foreground text-sm font-source-serif mt-1">
          Share ideas, report bugs, or tell us anything. We read every message.
        </p>
      </div>

      {sent ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center mb-4">
            <Check className="w-6 h-6 text-accent" />
          </div>
          <h3 className="font-playfair text-xl text-cream mb-2">Thanks for the feedback</h3>
          <p className="text-muted-foreground text-sm font-source-serif">We&apos;ll review it and get back to you if needed.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 bg-[#222] border border-[#333] rounded-xl p-6">
          <div className="flex gap-2">
            {(['idea', 'bug', 'other'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-4 py-1.5 rounded-full text-xs font-inter font-medium capitalize transition-colors ${
                  type === t ? 'bg-accent text-cream' : 'bg-[#2A2A2A] text-muted-foreground hover:text-cream'
                }`}
              >
                {t === 'idea' ? '💡 Idea' : t === 'bug' ? '🐛 Bug' : '💬 Other'}
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what's on your mind…"
            rows={6}
            required
            className="w-full px-3 py-3 rounded-lg bg-[#1A1A1A] border border-[#333] text-cream placeholder:text-muted-foreground font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {sending ? 'Sending…' : <><Send className="w-3.5 h-3.5" /> Send Feedback</>}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
