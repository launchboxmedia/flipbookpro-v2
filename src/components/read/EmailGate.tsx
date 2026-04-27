'use client'

import { useState, ReactNode } from 'react'
import type { Book } from '@/types/database'

interface Props {
  publishedBookId: string
  book: Book
  coverImageUrl: string | null
  title: string
  author: string | null
  description: string | null
  children: ReactNode
}

export function EmailGate({ publishedBookId, coverImageUrl, title, author, description, children }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), publishedBookId }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Failed')
      }
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  if (submitted) return <>{children}</>

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Cover thumbnail */}
        <div className="flex justify-center mb-8">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={title}
              className="w-36 rounded-lg shadow-2xl"
              style={{ aspectRatio: '3/4', objectFit: 'cover' }}
            />
          ) : (
            <div className="w-36 rounded-lg shadow-2xl bg-[#1E1E1E] flex items-center justify-center" style={{ aspectRatio: '3/4' }}>
              <span className="font-playfair text-cream/40 text-xs text-center px-3">{title}</span>
            </div>
          )}
        </div>

        <div className="text-center mb-8">
          <h1 className="font-playfair text-3xl text-cream font-bold leading-tight mb-2">{title}</h1>
          {author && <p className="text-muted-foreground font-inter text-sm tracking-widest uppercase mb-4">{author}</p>}
          {description && <p className="text-cream/60 font-source-serif text-sm leading-relaxed">{description}</p>}
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-8">
          <h2 className="font-playfair text-xl text-cream text-center mb-1">Get Free Access</h2>
          <p className="text-muted-foreground font-inter text-xs text-center mb-6">
            Enter your details to read this flipbook instantly.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-inter text-cream/70 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2.5 rounded-lg bg-[#111] border border-[#333] text-cream placeholder:text-muted-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-inter text-cream/70 mb-1.5">Email <span className="text-red-400">*</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3 py-2.5 rounded-lg bg-[#111] border border-[#333] text-cream placeholder:text-muted-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {error && <p className="text-red-400 font-inter text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent hover:bg-accent/90 text-cream font-inter font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Just a moment…' : 'Read Now — It\'s Free'}
            </button>

            <p className="text-center text-[10px] font-inter text-muted-foreground">
              No spam. Unsubscribe anytime.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
