'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  publishedBookId: string
  slug: string
  bookTitle: string
}

export function LeadCaptureForm({ publishedBookId, slug, bookTitle }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

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
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Something went wrong.')
      }
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md text-center animate-in fade-in duration-500">
        <div className="bg-muted/50 border border-accent/30 rounded-2xl p-8 sm:p-10 backdrop-blur-sm">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-accent/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-playfair text-2xl sm:text-3xl text-cream font-bold mb-3">
            You&apos;re In!
          </h2>
          <p className="font-source-serif text-cream/60 text-base mb-8 leading-relaxed">
            Check your email for a confirmation. In the meantime, start reading right now.
          </p>
          <Link
            href={`/read/${slug}`}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent hover:bg-accent/90 text-cream font-inter font-semibold text-sm rounded-xl transition-colors shadow-lg shadow-accent/20"
          >
            Read {bookTitle}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-muted/50 border border-border rounded-2xl p-8 sm:p-10 backdrop-blur-sm">
        <h2 className="font-playfair text-xl text-cream text-center mb-1.5">
          Get Free Access
        </h2>
        <p className="text-muted-foreground font-inter text-xs text-center mb-7">
          Enter your details to start reading instantly.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-inter text-cream/60 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-xl bg-canvas border border-border text-cream placeholder:text-muted-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
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
              className="w-full px-4 py-3 rounded-xl bg-canvas border border-border text-cream placeholder:text-muted-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
            />
          </div>

          {error && (
            <p className="text-red-400 font-inter text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-accent hover:bg-accent/90 text-cream font-inter font-semibold text-sm rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-accent/20 hover:shadow-accent/30"
          >
            {loading ? 'Just a moment\u2026' : 'Read Now \u2014 It\u2019s Free'}
          </button>

          <p className="text-center text-[10px] font-inter text-muted-foreground pt-1">
            No spam. Unsubscribe anytime.
          </p>
        </form>
      </div>
    </div>
  )
}
