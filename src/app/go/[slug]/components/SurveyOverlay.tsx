'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface Props {
  publishedBookId: string
  email: string
  question: string
  options: string[]
  slug: string
}

export function SurveyOverlay({ publishedBookId, email, question, options, slug }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const readHref = `/read/${slug}`

  async function submit() {
    if (!selected) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leads/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishedBookId, email, surveyResponse: selected }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? 'Submission failed')
      }
      router.push(readHref)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-1/95 backdrop-blur-sm px-5">
      <div className="w-full max-w-md">
        {/* Gold rule */}
        <div className="w-10 h-px bg-gold mb-7" aria-hidden="true" />

        <p className="text-[10px] uppercase tracking-[0.2em] text-gold/60 font-medium mb-3">
          Quick Question
        </p>

        <h2 className="font-playfair text-2xl text-white leading-snug mb-8">
          {question}
        </h2>

        {/* Options */}
        <div className="space-y-3 mb-8">
          {options.map((opt) => {
            const active = selected === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setSelected(opt)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-150 font-inter text-sm ${
                  active
                    ? 'border-gold bg-gold/10 text-white'
                    : 'border-white/10 bg-ink-2/60 text-white/70 hover:border-white/25 hover:text-white'
                }`}
              >
                <span className={`mr-3 text-xs ${active ? 'text-gold' : 'text-white/30'}`}>
                  {active ? '◆' : '◇'}
                </span>
                {opt}
              </button>
            )
          })}
        </div>

        {error && (
          <p className="text-red-400 text-xs mb-4">{error}</p>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={submit}
          disabled={!selected || loading}
          className="w-full py-3.5 rounded-xl bg-gold text-ink-1 font-semibold text-base transition-all duration-200 hover:bg-gold-soft hover:shadow-[0_0_30px_rgba(201,168,76,0.35)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Saving…' : 'Continue to book →'}
        </button>

        {/* Skip */}
        <button
          type="button"
          onClick={() => router.push(readHref)}
          className="block w-full text-center text-white/30 text-xs mt-4 hover:text-white/50 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
