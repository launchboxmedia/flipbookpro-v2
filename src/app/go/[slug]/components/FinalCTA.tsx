'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  slug: string
  bookId: string
  accessType: 'free' | 'email' | 'paid'
  priceFormatted?: string | null
}

const BTN =
  'block w-full max-w-sm mx-auto py-4 px-8 rounded-xl bg-[#C9A84C] text-[#0F1623] ' +
  'font-semibold text-lg text-center transition-all duration-200 hover:bg-[#D4B65A] ' +
  'hover:shadow-[0_0_30px_rgba(201,168,76,0.4)] active:scale-[0.98] disabled:opacity-60'

/** Bottom-of-page CTA. Free → straight to the reader. Email → scroll up
 *  to the single hero form (one form, no duplicate). Paid → trigger
 *  checkout right here so the buyer doesn't have to scroll back up. */
export function FinalCTA({ slug, bookId, accessType, priceFormatted }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (accessType === 'free') {
    return (
      <Link href={`/read/${slug}`} className={BTN}>
        Read Now — It&rsquo;s Free →
      </Link>
    )
  }

  if (accessType === 'email') {
    return (
      <a href="#get-access" className={BTN}>
        Get Free Access →
      </a>
    )
  }

  // paid — checkout directly, no scroll-back-up friction.
  const buy = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/books/${bookId}/checkout`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Could not start checkout.')
      window.location.href = json.url as string
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed.')
      setLoading(false)
    }
  }

  return (
    <>
      <button type="button" onClick={buy} disabled={loading} className={BTN}>
        {loading ? 'Processing…' : `Get Instant Access — ${priceFormatted ?? ''} →`.replace(/\s+→$/, ' →')}
      </button>
      {error && <p className="text-red-400 text-xs text-center mt-2">{error}</p>}
    </>
  )
}
