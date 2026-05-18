'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

/** Manual trigger for Pro books that have no welcome sequence yet (e.g.
 *  published before the feature shipped, or where the auto-generation on
 *  publish failed). POSTs to the generate route, then refreshes so the
 *  server re-fetches the now-present sequence and the status card swaps in. */
export function GenerateSequenceButton({ bookId }: { bookId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/books/${bookId}/generate-email-sequence`, {
        method: 'POST',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error || 'Failed — try again')
        return
      }
      router.refresh()
    } catch {
      toast.error('Failed — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 bg-gold text-ink-1 text-xs font-semibold px-3 py-1.5 rounded-lg mt-3 hover:bg-gold-soft transition-colors disabled:opacity-60"
    >
      {loading
        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
        : <><Sparkles className="w-3.5 h-3.5" /> Generate Sequence</>}
    </button>
  )
}
