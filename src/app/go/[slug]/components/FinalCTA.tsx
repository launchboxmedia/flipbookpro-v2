'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

const SUB = 'text-white/30 text-xs text-center mt-2'

/** Bottom-of-page CTA. Free → straight to the reader. Email → reveal the
 *  email form inline right here (local state, no scroll jump back to the
 *  hero). Paid → trigger checkout right here so the buyer doesn't have to
 *  scroll back up. */
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
    return <FinalEmailCTA slug={slug} />
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

/** Bottom email gate. State lives here so clicking the button reveals the
 *  form inline at the foot of the page — no anchor jump, no scroll change.
 *  Same grant-email contract as the hero AccessCTA. */
function FinalEmailCTA({ slug }: { slug: string }) {
  const router = useRouter()
  const readHref = `/read/${slug}`
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot — must stay empty
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={BTN}>
        Get Free Access →
      </button>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/read/${slug}/grant-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), website }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong.')
      router.push(readHref)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto space-y-3 text-left">
      {/* Honeypot — visually hidden from real users; auto-fill bots populate it. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', opacity: 0 }}
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="w-full px-4 py-3 rounded-lg bg-ink-2 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-gold/50 transition-colors"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        className="w-full px-4 py-3 rounded-lg bg-ink-2 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-gold/50 transition-colors"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button type="submit" disabled={loading} className={BTN}>
        {loading ? 'Unlocking…' : 'Get Free Access →'}
      </button>
      <p className={SUB}>No spam. Unsubscribe anytime.</p>
    </form>
  )
}
