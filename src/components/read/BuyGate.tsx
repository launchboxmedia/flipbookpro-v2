'use client'

import { useState } from 'react'
import { Lock, Loader2, ShieldCheck, BookOpen } from 'lucide-react'

interface Props {
  bookId: string
  title: string
  author: string | null
  subtitle: string | null
  description: string | null
  coverImageUrl: string | null
  priceCents: number
  /** Optional error code from a failed grant — surfaces a user-facing
   *  message (e.g. "verification failed, please try again"). */
  errorCode?: string | null
}

const ERROR_COPY: Record<string, string> = {
  'unpaid':         'That payment did not complete. Please try again.',
  'verify-failed':  'We could not verify your purchase. Please try again or contact support.',
  'no-email':       'No email address was returned by the payment provider. Please try again.',
  'slug-mismatch':  'That payment was for a different book. Please try again.',
  'missing-session': '',
}

export function BuyGate({
  bookId, title, author, subtitle, description, coverImageUrl, priceCents, errorCode,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    errorCode ? (ERROR_COPY[errorCode] ?? null) : null,
  )

  const priceDollars = (priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2)

  async function handleBuy() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/books/${bookId}/checkout`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Could not start checkout.')
      window.location.href = json.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden shadow-2xl">
        {/* Cover at top */}
        <div className="aspect-[3/4] max-h-[260px] bg-[#0F0F0F] relative overflow-hidden border-b border-[#2A2A2A]">
          {coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- public read page; next/image cost not warranted
            <img
              src={coverImageUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="w-16 h-16 text-cream/15" />
            </div>
          )}
          {/* Bottom gradient + lock overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />
          <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/10">
            <Lock className="w-4 h-4 text-gold" />
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <p className="text-[10px] font-inter font-semibold text-gold uppercase tracking-[0.18em] mb-2">
              Premium Book
            </p>
            <h1 className="font-playfair text-2xl text-cream leading-tight">{title}</h1>
            {subtitle && (
              <p className="font-source-serif italic text-sm text-cream/60 mt-1">{subtitle}</p>
            )}
            {author && (
              <p className="font-inter text-[10px] text-cream/50 tracking-[0.18em] uppercase mt-3">
                by {author}
              </p>
            )}
          </div>

          {description && (
            <p className="font-source-serif text-sm text-cream/70 leading-relaxed">
              {description}
            </p>
          )}

          {/* Price + buy */}
          <div className="pt-4 border-t border-[#2A2A2A] flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-inter font-medium text-cream/40 uppercase tracking-wider mb-1">
                One-time purchase
              </p>
              <p className="font-playfair text-3xl text-cream">
                ${priceDollars}
              </p>
            </div>
            <button
              onClick={handleBuy}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-3 bg-gold hover:bg-gold-soft text-ink-1 font-inter font-semibold text-sm rounded-lg shadow-[0_4px_18px_-6px_rgba(201,168,76,0.5)] transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {loading ? 'Starting checkout…' : 'Buy Now'}
            </button>
          </div>

          {error && (
            <p className="text-[12px] font-inter text-red-400 text-center pt-1">{error}</p>
          )}

          <div className="pt-3 flex items-center justify-center gap-1.5 text-[11px] font-inter text-cream/40">
            <ShieldCheck className="w-3 h-3" />
            Secure payment via Stripe
          </div>
        </div>
      </div>
    </div>
  )
}
