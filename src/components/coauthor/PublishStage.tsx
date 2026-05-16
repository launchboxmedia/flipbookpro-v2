'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Globe, Copy, Check, ExternalLink, Loader2, Lock, Mail, BookOpen,
  AlertTriangle, Megaphone, Download, FileText,
} from 'lucide-react'
import type { AccessType, Book, PublishedBook } from '@/types/database'

interface Props {
  book: Book
  publishedBook: PublishedBook | null
  hasStripeConnect: boolean
  /** True when the book has a closing CTA chapter (chapter_index === 99).
   *  Drives the warning if a paid/gated book is being published without a
   *  destination URL — the closing chapter would point at nothing. */
  hasCtaChapter: boolean
}

const ACCESS_OPTIONS: ReadonlyArray<{
  id: AccessType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'free',  label: 'Free',       description: 'Anyone with the link can read — no gate.',           icon: BookOpen },
  { id: 'email', label: 'Email Gate', description: 'Free with email capture — readers join your list.',  icon: Mail },
  { id: 'paid',  label: 'Paid',       description: 'Buyer must pay before accessing the book.',          icon: Lock },
]

function initialAccessType(p: PublishedBook | null): AccessType {
  if (!p) return 'email'
  if (p.access_type) return p.access_type
  if (p.gate_type === 'none')    return 'free'
  if (p.gate_type === 'payment') return 'paid'
  return 'email'
}

export function PublishStage({ book, publishedBook: initial, hasStripeConnect, hasCtaChapter }: Props) {
  const [published]  = useState<PublishedBook | null>(initial)
  const [accessType, setAccessType] = useState<AccessType>(initialAccessType(initial))
  const [priceDollars, setPriceDollars] = useState<string>(
    initial?.price_cents && initial.price_cents > 0
      ? (initial.price_cents / 100).toFixed(2)
      : '7.00',
  )
  const [ctaUrl, setCtaUrl] = useState<string>(book.back_cover_cta_url ?? '')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [copied,  setCopied]  = useState(false)

  // Derive the share URL only on the client — SSR can't read window.origin.
  const shareUrl = published
    ? (typeof window !== 'undefined' ? `${window.location.origin}/read/${published.slug}` : `/read/${published.slug}`)
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
      // Mirror the legacy PublishPanel behaviour — reload so the new
      // published_books row hydrates everywhere (stage props, sidebar
      // counts, etc.). A targeted re-fetch would be cleaner but the
      // refactor brief says no API changes, and the publish endpoint
      // already accommodates this reload pattern.
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed')
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Best-effort; older browsers silently fail.
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <h2 className="font-playfair text-3xl text-ink-1 dark:text-cream mb-1">Publish</h2>
      <p className="text-muted-foreground font-source-serif text-sm mb-8">
        Share your flipbook with a public link.
      </p>

      {/* Cover + metadata preview ─────────────────────────────────────── */}
      <div className="flex gap-5 mb-8">
        {book.cover_image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={book.cover_image_url}
            alt=""
            className="w-24 rounded-lg shadow-lg"
            style={{ aspectRatio: '3/4', objectFit: 'cover' }}
          />
        ) : (
          <div
            className="w-24 rounded-lg bg-cream-2 dark:bg-[#1E1E1E] border border-cream-3 dark:border-[#333] flex items-center justify-center"
            style={{ aspectRatio: '3/4' }}
          >
            <span className="font-playfair text-[10px] text-ink-1/30 dark:text-cream/30 text-center px-2">{book.title}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-playfair text-ink-1 dark:text-cream text-lg leading-tight">{book.title}</p>
          {book.subtitle && (
            <p className="text-muted-foreground font-source-serif text-sm mt-1 italic">{book.subtitle}</p>
          )}
          {book.author_name && (
            <p className="text-ink-1/50 dark:text-cream/50 font-inter text-xs mt-2 tracking-widest uppercase">{book.author_name}</p>
          )}
        </div>
      </div>

      {/* Access type ──────────────────────────────────────────────────── */}
      <div className="bg-cream-1 dark:bg-[#1A1A1A] border border-cream-3 dark:border-[#2A2A2A] rounded-xl p-5 mb-5">
        <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Access Type
        </p>
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
                    : 'border-cream-3 dark:border-[#2A2A2A] hover:border-[#E8E0D0] dark:hover:border-[#3A3A3A]'
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
                  <p className={`font-inter text-sm font-medium ${selected ? 'text-ink-1 dark:text-cream' : 'text-ink-1/80 dark:text-cream/80'}`}>
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

        {accessType === 'paid' && (
          <div className="mt-4 pt-4 border-t border-cream-3 dark:border-[#2A2A2A]">
            <label className="block text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Price (USD, minimum $1)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-1/60 dark:text-cream/60 font-inter text-sm">$</span>
              <input
                type="number"
                min={1}
                step="0.01"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                className="w-32 pl-7 pr-3 py-2 rounded-md bg-cream-1 dark:bg-[#111] border border-cream-3 dark:border-[#333] text-ink-1 dark:text-cream font-inter text-sm focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40"
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

      {/* CTA URL ──────────────────────────────────────────────────────── */}
      <div className="bg-cream-1 dark:bg-[#1A1A1A] border border-cream-3 dark:border-[#2A2A2A] rounded-xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="w-3.5 h-3.5 text-gold" />
          <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">
            Reader Next Step
          </p>
        </div>
        <label className="block text-xs font-inter text-ink-1/80 dark:text-cream/80 mb-2">
          Where should readers go after the book?
        </label>
        <input
          type="url"
          inputMode="url"
          placeholder="https://yoursite.com/book-readers"
          value={ctaUrl}
          onChange={(e) => setCtaUrl(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-cream-1 dark:bg-[#111] border border-cream-3 dark:border-[#333] text-ink-1 dark:text-cream font-inter text-sm placeholder:text-ink-1/30 dark:placeholder:text-cream/30 focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40"
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

      {/* Live URL (post-publish) ──────────────────────────────────────── */}
      {published && shareUrl && (
        <div className="bg-cream-1 dark:bg-[#1A1A1A] border border-emerald-500/30 rounded-xl p-5 mb-5">
          <p className="text-[11px] font-inter font-semibold text-emerald-400 uppercase tracking-wider mb-2">
            Your book is live
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-cream-1 dark:bg-[#111] border border-cream-3 dark:border-[#333] rounded-lg px-3 py-2 font-mono text-xs text-accent truncate">
              {shareUrl}
            </code>
            <button onClick={copyLink} className="p-2 text-muted-foreground hover:text-ink-1 dark:hover:text-cream transition-colors" title="Copy link">
              {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-muted-foreground hover:text-ink-1 dark:hover:text-cream transition-colors"
              title="View book"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* Publish button ──────────────────────────────────────────────── */}
      <button
        onClick={handlePublish}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 bg-gold hover:bg-gold-soft text-ink-1 font-inter font-semibold text-sm rounded-lg transition-colors disabled:opacity-50 shadow-[0_8px_24px_-12px_rgba(201,168,76,0.5)]"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
        {loading
          ? 'Publishing…'
          : published
            ? 'Update Published Book'
            : 'Publish Book'}
      </button>

      {/* Export — secondary actions ─────────────────────────────────── */}
      <div className="mt-8 pt-6 border-t border-cream-3 dark:border-[#2A2A2A]">
        <p className="text-[11px] font-inter font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Export
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/books/${book.id}/export-pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-cream-3 dark:border-[#333] hover:border-[#E8E0D0] dark:hover:border-[#444] text-ink-1/70 dark:text-cream/70 hover:text-ink-1 dark:hover:text-cream font-inter text-xs rounded-md transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Export PDF
          </a>
          <a
            href={`/api/books/${book.id}/export-html`}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-cream-3 dark:border-[#333] hover:border-[#E8E0D0] dark:hover:border-[#444] text-ink-1/70 dark:text-cream/70 hover:text-ink-1 dark:hover:text-cream font-inter text-xs rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export HTML
          </a>
        </div>
      </div>
    </div>
  )
}
