'use client'

import { useState } from 'react'
import { Check, Loader2, ArrowLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/types/database'

interface Props {
  profile: Profile | null
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    interval: '',
    features: ['1 book lifetime', 'Up to 6 chapters', 'HTML export', 'Publishing with email gate'],
    cta: null,
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$9',
    interval: '/mo',
    annual: '$79/yr',
    features: ['3 books per month', 'Up to 8 chapters', 'All export formats', 'Lead capture + MailerLite', 'Priority support'],
    monthly: 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_standard_monthly', // REPLACE WITH REAL STRIPE PRICE ID
    yearly:  'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_standard_annual',  // REPLACE WITH REAL STRIPE PRICE ID
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    interval: '/mo',
    annual: '$399/yr',
    features: ['10 books per month', 'Up to 15 chapters', 'All features', 'Stripe Connect book sales', 'Brand identity', 'Telegram notifications'],
    monthly: 'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_pro_monthly', // REPLACE WITH REAL STRIPE PRICE ID
    yearly:  'price_REPLACE_WITH_REAL_STRIPE_PRICE_ID_pro_annual',  // REPLACE WITH REAL STRIPE PRICE ID
  },
] as const

export function BillingPanel({ profile }: Props) {
  const currentPlan = profile?.plan ?? 'free'
  const [billing, setBilling]   = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading]   = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  async function checkout(priceId: string) {
    setLoading(priceId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } finally {
      setLoading(null)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) window.location.href = url
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-1">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-1/60 hover:text-ink-1 font-inter transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-playfair text-3xl text-ink-1">Billing</h1>
            <p className="text-ink-1/60 font-inter text-sm mt-1">
              Current plan: <span className="text-ink-1 capitalize">{currentPlan}</span>
            </p>
          </div>
          {profile?.stripe_customer_id && (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="flex items-center gap-2 px-4 py-2 border border-cream-3 hover:border-gold/40 text-ink-1/60 hover:text-ink-1 font-inter text-sm rounded-lg transition-colors disabled:opacity-40"
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Manage Subscription
            </button>
          )}
        </div>

        {/* Billing toggle */}
        <div className="flex items-center gap-3 mb-8">
          {(['monthly', 'annual'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`px-4 py-1.5 rounded-full font-inter text-sm transition-colors ${
                billing === b
                  ? 'bg-gold text-ink-1'
                  : 'text-ink-1/60 hover:text-ink-1 border border-cream-3'
              }`}
            >
              {b === 'monthly' ? 'Monthly' : 'Annual (save ~30%)'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id
            const priceId = plan.id !== 'free'
              ? (billing === 'monthly' ? plan.monthly : plan.yearly)
              : null

            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 flex flex-col gap-5 ${
                  plan.id === 'pro'
                    ? 'border-gold bg-gold/5'
                    : 'border-cream-3 bg-white'
                }`}
              >
                <div>
                  <p className="font-inter font-semibold text-ink-1 text-sm uppercase tracking-widest mb-2">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-playfair text-3xl text-ink-1 font-bold">{plan.price}</span>
                    <span className="font-inter text-sm text-ink-1/60">{plan.interval}</span>
                  </div>
                  {plan.id !== 'free' && (
                    <p className="text-xs font-inter text-ink-1/60 mt-0.5">{plan.annual}</p>
                  )}
                </div>

                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs font-inter text-ink-1/70">
                      <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.id === 'free' ? (
                  <div className={`py-2.5 rounded-lg text-center text-sm font-inter font-medium ${isCurrent ? 'bg-cream-3 text-ink-1/60' : 'bg-cream-3 text-ink-1/50'}`}>
                    {isCurrent ? 'Current Plan' : 'Free Forever'}
                  </div>
                ) : (
                  <button
                    onClick={() => priceId && checkout(priceId)}
                    disabled={isCurrent || loading === priceId}
                    className={`py-2.5 rounded-lg text-sm font-inter font-semibold transition-colors flex items-center justify-center gap-2 ${
                      isCurrent
                        ? 'bg-cream-3 text-ink-1/60 cursor-default'
                        : plan.id === 'pro'
                        ? 'bg-gold hover:bg-gold/90 text-ink-1'
                        : 'bg-cream-3 hover:bg-cream-3 text-ink-1 border border-cream-3'
                    }`}
                  >
                    {loading === priceId && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isCurrent ? 'Current Plan' : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-xs font-inter text-ink-1/60 text-center mt-6">
          Secured by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  )
}
