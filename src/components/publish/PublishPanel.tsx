'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Globe, Copy, Check, ExternalLink, Loader2 } from 'lucide-react'
import type { Book, PublishedBook } from '@/types/database'

interface Props {
  book: Book
  publishedBook: PublishedBook | null
}

export function PublishPanel({ book, publishedBook: initial }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [published, setPublished] = useState<PublishedBook | null>(initial)
  const [gateType, setGateType] = useState<'email' | 'none'>(initial?.gate_type as 'email' | 'none' ?? 'email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const shareUrl = published
    ? `${window?.location?.origin ?? ''}/read/${published.slug}`
    : null

  async function handlePublish() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/books/${book.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      // Reload to get full published_book record
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed')
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-xl mx-auto px-6 py-10">
        <Link
          href={`/book/${book.id}/coauthor`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-cream font-inter transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Co-Author
        </Link>

        <h1 className="font-playfair text-3xl text-cream mb-1">Publish</h1>
        <p className="text-muted-foreground font-source-serif text-sm mb-8">
          Share your flipbook with a public link.
        </p>

        {/* Cover preview */}
        <div className="flex gap-5 mb-8">
          {book.cover_image_url ? (
            <img src={book.cover_image_url} alt="" className="w-24 rounded-lg shadow-lg" style={{ aspectRatio: '3/4', objectFit: 'cover' }} />
          ) : (
            <div className="w-24 rounded-lg bg-[#1E1E1E] border border-[#333] flex items-center justify-center" style={{ aspectRatio: '3/4' }}>
              <span className="font-playfair text-[10px] text-cream/30 text-center px-2">{book.title}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-playfair text-cream text-lg leading-tight">{book.title}</p>
            {book.subtitle && <p className="text-muted-foreground font-source-serif text-sm mt-1 italic">{book.subtitle}</p>}
            {book.author_name && <p className="text-cream/50 font-inter text-xs mt-2 tracking-widest uppercase">{book.author_name}</p>}
          </div>
        </div>

        {/* Gate type */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 mb-5">
          <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider mb-3">Access Type</p>
          <div className="space-y-2">
            {(['email', 'none'] as const).map((gt) => (
              <label key={gt} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="gateType"
                  value={gt}
                  checked={gateType === gt}
                  onChange={() => setGateType(gt)}
                  className="accent-accent"
                />
                <span className="font-inter text-sm text-cream">
                  {gt === 'email' ? 'Email gate — collect leads before access' : 'Open access — no gate'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 font-inter text-xs mb-4">{error}</p>}

        {/* Published URL */}
        {published && shareUrl && (
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 mb-5">
            <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider mb-3">Share Link</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[#111] border border-[#333] rounded-lg px-3 py-2 font-mono text-xs text-accent truncate">
                {shareUrl}
              </code>
              <button onClick={copyLink} className="p-2 text-muted-foreground hover:text-cream transition-colors">
                {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
              </button>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-muted-foreground hover:text-cream transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        <button
          onClick={handlePublish}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-accent hover:bg-accent/90 text-cream font-inter font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          {loading ? 'Publishing…' : published ? 'Update Published Book' : 'Publish Now'}
        </button>
      </div>
    </div>
  )
}
