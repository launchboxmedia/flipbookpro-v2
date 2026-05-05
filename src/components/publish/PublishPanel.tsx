'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Globe, Copy, Check, ExternalLink, Loader2, Lock, Mail, BookOpen, AlertTriangle, Megaphone } from 'lucide-react'
import type { AccessType, Book, PublishedBook } from '@/types/database'

interface Props {
  book: Book
  publishedBook: PublishedBook | null
  hasStripeConnect?: boolean
  /** True when book_pages contains a chapter at index 99 (the CTA sentinel).
   *  Drives the warning that publishing without a back_cover_cta_url leaves
   *  the closing chapter pointing at nothing. */
  hasCtaChapter?: boolean
}

const ACCESS_OPTIONS: ReadonlyArray<{
  id: AccessType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'free',  label: 'Free',        description: 'Anyone with the link can read — no gate.',                icon: BookOpen },
  { id: 'email', label: 'Email Gate',  description: 'Free with email capture — readers join your list.',       icon: Mail },
  { id: 'paid',  label: 'Paid',        description: 'Buyer must pay before accessing the book.',               icon: Lock },
]

// Derive an initial access type from either the new column (preferred) or
// the legacy gate_type, so historical published_books rows still display
// correctly until they're saved with the new flow.
function initialAccessType(p: PublishedBook | null): AccessType {
  if (!p) return 'email'
  if (p.access_type) return p.access_type
  if (p.gate_type === 'none')    return 'free'
  if (p.gate_type === 'payment') return 'paid'
  return 'email'
}

export function PublishPanel({ book, publishedBook: initial, hasStripeConnect = false, hasCtaChapter = false }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [published, setPublished] = useState<PublishedBook | null>(initial)
  const [accessType, setAccessType] = useState<AccessType>(initialAccessType(initial))
  // Price displayed as dollars in the input; persisted as cents on save.
  const [priceDollars, setPriceDollars] = useState<string>(
    initial?.price_cents && initial.price_cents > 0
      ? (initial.price_cents / 100).toFixed(2)
      : '7.00',
  )
  // CTA URL — drives where the closing CTA chapter and back-cover button
  // point. Saved to books.back_cover_cta_url alongside publish.
  const [ctaUrl, setCtaUrl] = useState<string>(book.back_cover_cta_url ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const shareUrl = published
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/read/${published.slug}`
    : null

  async function handlePublish() {
    setLoading(true)
    setError('')
    try {
      const priceCents = accessType === 'paid'
        ? Math.round(parseFloat(priceDollars || '0') * 100)
        : 0

      if (accessType === 'paid' && (!Number.isFinite(priceCents) || priceCents < 100)) {
        throw new Error('Paid books require a price of at least $1.')
      }

      // Light client-side URL check before save — avoids a round-trip just
      // to bounce a typo. The back-cover route validates again server-side.
      const trimmedCta = ctaUrl.trim()
      if (trimmedCta) {
        try {
          const u = new URL(trimmedCta)
          if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad-protocol')
        } catch {
          throw new Error('CTA URL must be a valid http(s) URL.')
        }
      }

      // Persist the CTA URL first so the share link reflects it. Failure
      // here aborts publish — the user expects the URL they typed to land.
      const ctaRes = await fetch(`/api/books/${book.id}/back-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ back_cover_cta_url: trimmedCta || null }),
      })
      if (!ctaRes.ok) {
        const j = await ctaRes.json().catch(() => ({}))
        throw new Error(j?.error || 'Could not save CTA URL.')
      }

      const res = await fetch(`/api/books/${book.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessType, priceCents }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
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

        {/* Access type — three options */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 mb-5">
          <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider mb-3">Access Type</p>
          <div className="space-y-2">
            {ACCESS_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const selected = accessType === opt.id
              return (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected
                      ? 'border-gold/50 bg-gold/5'
                      : 'border-[#2A2A2A] hover:border-[#3A3A3A]'
                  }`}
                >
                  <input
                    type="radio"
                    name="accessType"
                    value={opt.id}
                    checked={selected}
                    onChange={() => setAccessType(opt.id)}
                    className="mt-0.5 accent-gold"
                  />
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${selected ? 'text-gold' : 'text-muted-foreground'}`} />
                  <div className="flex-1">
                    <p className={`font-inter text-sm font-medium ${selected ? 'text-cream' : 'text-cream/80'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs font-source-serif text-muted-foreground mt-0.5 leading-snug">
                      {opt.description}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>

          {/* Price input — only when paid */}
          {accessType === 'paid' && (
            <div className="mt-4 pt-4 border-t border-[#2A2A2A]">
              <label className="block text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Price (USD, minimum $1)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/60 font-inter text-sm">$</span>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                  className="w-32 pl-7 pr-3 py-2 rounded-md bg-[#111] border border-[#333] text-cream font-inter text-sm focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40"
                />
              </div>
              <p className="text-[11px] font-inter text-muted-foreground mt-2">
                FlipBookPro takes a 10% platform fee. Net to you per sale: ${' '}
                {((parseFloat(priceDollars || '0') * 0.9) || 0).toFixed(2)}.
              </p>

              {!hasStripeConnect && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/30">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-amber-200 font-inter text-xs leading-relaxed">
                      Connect Stripe to receive payments. Without it, sales will go to the platform.
                    </p>
                    <Link
                      href="/settings/billing"
                      className="inline-block mt-1 text-amber-300 hover:text-amber-200 font-inter text-xs underline underline-offset-2"
                    >
                      Connect Stripe in Billing →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Closing CTA — points the back cover button + the optional CTA
            chapter at the URL the author wants readers to land on. The
            warning surfaces only when the book has a CTA chapter but no URL
            yet; otherwise the field is optional. */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone className="w-3.5 h-3.5 text-gold" />
            <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">
              Reader Next Step
            </p>
          </div>

          <label className="block text-xs font-inter text-cream/80 mb-2">
            Where should readers go after the book?
          </label>
          <input
            type="url"
            inputMode="url"
            placeholder="https://yoursite.com/book-readers"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-[#111] border border-[#333] text-cream font-inter text-sm placeholder:text-cream/30 focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40"
          />
          <p className="text-[11px] font-inter text-muted-foreground mt-2 leading-relaxed">
            Drives the button on your back cover and the closing CTA chapter
            (if you added one). Leave blank to publish without a link.
          </p>

          {hasCtaChapter && !ctaUrl.trim() && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-200 font-inter text-xs leading-relaxed">
                Your book has a closing CTA chapter but no destination URL.
                Readers will reach a chapter that asks them to take action with
                nowhere to go. Add a link or remove the CTA chapter before
                publishing.
              </p>
            </div>
          )}
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
