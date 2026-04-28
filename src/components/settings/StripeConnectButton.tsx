'use client'

import { useState } from 'react'

interface StripeConnectButtonProps {
  stripeConnectId: string | null
  stripeConnectStatus: string | null
}

export default function StripeConnectButton({
  stripeConnectId,
  stripeConnectStatus,
}: StripeConnectButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConnected = stripeConnectId && stripeConnectStatus === 'active'
  const isPending = stripeConnectId && stripeConnectStatus === 'pending'

  async function handleConnect() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Failed to start Stripe Connect')

      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Stripe Connected
        </span>
        <span className="text-sm text-ink-1/60">
          {stripeConnectId}
        </span>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            Setup Incomplete
          </span>
        </div>
        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Redirecting…' : 'Complete Stripe Setup'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-fit rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Redirecting…' : 'Connect Stripe'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
