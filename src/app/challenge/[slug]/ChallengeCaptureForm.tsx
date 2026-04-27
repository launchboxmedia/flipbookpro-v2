'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  publishedBookId: string
  slug: string
  bookTitle: string
}

export function ChallengeCaptureForm({ publishedBookId, slug, bookTitle }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          publishedBookId,
          source: 'challenge',
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Something went wrong.')
      }
      router.push(`/challenge/${slug}/joined`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-muted/50 border border-gold/15 rounded-2xl p-8 sm:p-10 backdrop-blur-sm">
        <h2 className="font-playfair text-xl text-cream text-center mb-1.5">
          Join the Challenge
        </h2>
        <p className="text-muted-foreground font-inter text-xs text-center mb-7">
          Enter your details to get started with The {bookTitle} Challenge.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-inter text-cream/60 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-xl bg-canvas border border-border text-cream placeholder:text-muted-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-inter text-cream/60 mb-1.5">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 rounded-xl bg-canvas border border-border text-cream placeholder:text-muted-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition-all"
            />
          </div>

          {error && (
            <p className="text-red-400 font-inter text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gold hover:bg-gold/90 text-canvas font-inter font-bold text-sm rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-gold/20 hover:shadow-gold/30"
          >
            {loading ? 'Joining\u2026' : 'Join the Challenge'}
          </button>

          <p className="text-center text-[10px] font-inter text-muted-foreground pt-1">
            Free to join. No credit card required.
          </p>
        </form>
      </div>
    </div>
  )
}
