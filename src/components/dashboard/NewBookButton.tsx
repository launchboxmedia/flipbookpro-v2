'use client'

import { useState } from 'react'
import { Plus, X, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { createBook } from '@/app/dashboard/actions'

export function NewBookButton() {
  const [loading, setLoading]   = useState(false)
  const [showGate, setShowGate] = useState(false)
  const [gateInfo, setGateInfo] = useState<{ plan: string; used: number; limit: number } | null>(null)

  async function handleClick() {
    setLoading(true)
    try {
      const res  = await fetch('/api/books/check-limit')
      const data = await res.json()
      if (!data.allowed) {
        setGateInfo({ plan: data.plan, used: data.used, limit: data.limit })
        setShowGate(true)
        return
      }
      await createBook()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-inter text-sm font-semibold rounded-lg shadow-[0_4px_18px_-6px_rgba(201,168,76,0.5)] transition-colors disabled:opacity-60"
      >
        <Plus className="w-4 h-4" />
        {loading ? 'Creating…' : 'New Book'}
      </button>

      {showGate && gateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-8 max-w-sm w-full mx-4 relative">
            <button
              onClick={() => setShowGate(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-cream transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-5">
              <p className="text-xs font-inter text-muted-foreground uppercase tracking-widest mb-2">Book limit reached</p>
              <h2 className="font-playfair text-xl text-cream">
                You&apos;ve used {gateInfo.used} of {gateInfo.limit} book{gateInfo.limit !== 1 ? 's' : ''} this month
              </h2>
              <p className="text-sm font-source-serif text-muted-foreground mt-2">
                Your <span className="text-cream capitalize">{gateInfo.plan}</span> plan allows {gateInfo.limit} book{gateInfo.limit !== 1 ? 's' : ''} per month. Upgrade to create more.
              </p>
            </div>

            <div className="space-y-2">
              <Link
                href="/settings/billing"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-accent hover:bg-accent/90 text-cream font-inter text-sm font-semibold rounded-lg transition-colors"
              >
                Upgrade Plan
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setShowGate(false)}
                className="w-full py-2.5 text-muted-foreground font-inter text-sm hover:text-cream transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
