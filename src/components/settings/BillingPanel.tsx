'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, ArrowLeft, ExternalLink, CreditCard, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Profile } from '@/types/database'

interface Props {
  profile: Profile | null
  // Price IDs are passed from the server-side page so this client component
  // never reads env vars directly. Keeps the lib/stripe.ts ↔ env wiring in
  // one place.
  priceIds: {
    standardMonthly: string
    standardYearly:  string
    proMonthly:      string
    proYearly:       string
  }
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
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    interval: '/mo',
    annual: '$399/yr',
    features: ['10 books per month', 'Up to 15 chapters', 'All features', 'Stripe Connect book sales', 'Brand identity', 'Telegram notifications'],
  },
] as const

// Maps the bare error codes the callback / refresh routes redirect with
// into copy a user can read. Anything not on this list falls through to
// the raw code so debugging isn't blind.
const CONNECT_ERROR_COPY: Record<string, string> = {
  missing_account:        'Stripe didn’t return an account ID. Try connecting again.',
  account_mismatch:       'That Stripe account belongs to a different FlipBookPro user.',
  db_update_failed:       'Stripe linked correctly but we couldn’t save the connection. Try again.',
  stripe_error:           'Stripe returned an error while finishing your connection. Try again.',
  stripe_not_configured:  'Stripe isn’t configured on this deployment.',
}

export function BillingPanel({ profile, priceIds }: Props) {
  const currentPlan   = profile?.plan ?? 'free'
  const connectId     = profile?.stripe_connect_id ?? null
  const connectStatus = (profile?.stripe_connect_status as 'active' | 'pending' | null | undefined) ?? null

  const [billing, setBilling]   = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading]   = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [connecting, setConnecting]       = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Banner state derived from the callback / refresh redirects. We pull
  // it from the URL once on mount, then strip the query params so a
  // refresh doesn't re-show the banner.
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const [banner, setBanner] = useState<
    | { kind: 'success'; message: string }
    | { kind: 'warning'; message: string }
    | { kind: 'error';   message: string }
    | null
  >(null)

  useEffect(() => {
    const success = searchParams.get('connect_success')
    const error   = searchParams.get('connect_error')

    if (success === 'active') {
      setBanner({ kind: 'success', message: 'Stripe connected successfully. You can now sell your books.' })
    } else if (success === 'pending') {
      setBanner({ kind: 'warning', message: 'Stripe account setup incomplete. Complete your onboarding to receive payments.' })
    } else if (error) {
      setBanner({ kind: 'error', message: CONNECT_ERROR_COPY[error] ?? `Connection failed: ${error}` })
    }

    if (success || error) {
      // Strip the query so a hard refresh doesn't re-show the banner.
      router.replace(pathname, { scroll: false })
    }
    // Run once on mount with whatever query params were present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  async function handleConnect() {
    setConnecting(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const { url, error } = await res.json()
      if (url) {
        window.location.href = url
        return // browser navigates away — don't unset loading
      }
      setBanner({ kind: 'error', message: error ?? 'Could not start Stripe onboarding.' })
    } catch (e) {
      setBanner({ kind: 'error', message: e instanceof Error ? e.message : 'Could not start Stripe onboarding.' })
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect your Stripe account? Future book sales will not be paid out to you until you reconnect.')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/stripe/connect/disconnect', { method: 'POST' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: null }))
        setBanner({ kind: 'error', message: error ?? 'Could not disconnect.' })
        return
      }
      // Reload so the panel re-reads profile from the server with the
      // cleared connect columns — no need to thread state by hand.
      router.refresh()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-1 dark:bg-ink-1">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-1/60 dark:text-white/60 hover:text-ink-1 dark:hover:text-white font-inter transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        {/* Inline banner — connect_success / connect_error feedback */}
        {banner && (
          <div
            role="status"
            className={`mb-6 flex items-start gap-2.5 rounded-lg border px-4 py-3 ${
              banner.kind === 'success' ? 'border-emerald-300/60 bg-emerald-50 text-emerald-900' :
              banner.kind === 'warning' ? 'border-amber-300/70 bg-amber-50 text-amber-900' :
                                          'border-rose-300/70 bg-rose-50 text-rose-900'
            }`}
          >
            {banner.kind === 'success'
              ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              : banner.kind === 'warning'
              ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <p className="font-inter text-sm leading-snug flex-1">{banner.message}</p>
            <button
              onClick={() => setBanner(null)}
              className="text-xs font-inter opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-playfair text-3xl text-ink-1 dark:text-white">Billing</h1>
            <p className="text-ink-1/60 dark:text-white/60 font-inter text-sm mt-1">
              Current plan: <span className="text-ink-1 dark:text-white capitalize">{currentPlan}</span>
            </p>
          </div>
          {profile?.stripe_customer_id && (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="flex items-center gap-2 px-4 py-2 border border-cream-3 dark:border-ink-3 hover:border-gold/40 text-ink-1/60 dark:text-white/60 hover:text-ink-1 dark:hover:text-white font-inter text-sm rounded-lg transition-colors disabled:opacity-40"
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Manage Subscription
            </button>
          )}
        </div>

        {/* ── Receive Payments (Stripe Connect) ────────────────────────── */}
        {/* Three states keyed off (connectId, connectStatus):
             - null id            → not connected
             - id + 'pending'     → onboarding incomplete or under review
             - id + 'active'      → charges_enabled + details_submitted */}
        <section className="mb-8 rounded-2xl border border-cream-3 dark:border-ink-3 bg-white dark:bg-ink-2 p-6">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-5 h-5 text-ink-1/70 dark:text-white/70" />
            <h2 className="font-playfair text-xl text-ink-1 dark:text-white">Receive Payments</h2>
          </div>

          {!connectId && (
            <>
              <p className="font-inter text-sm text-ink-1/70 dark:text-white/70 leading-relaxed mb-5">
                Connect your Stripe account to receive payments when readers buy your books.
                FlipBookPro takes a 10% platform fee.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gold hover:bg-gold/90 text-ink-1 font-inter font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Connect Stripe Account
              </button>
            </>
          )}

          {connectId && connectStatus === 'pending' && (
            <>
              <div className="flex items-start gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="font-inter text-sm text-ink-1/80 dark:text-white/80 leading-relaxed">
                  Your Stripe account is pending. Complete your Stripe onboarding to start
                  receiving payments.
                </p>
              </div>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-500/90 text-white font-inter font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Continue Stripe Setup
              </button>
            </>
          )}

          {connectId && connectStatus === 'active' && (
            <>
              <div className="flex items-start gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="font-inter text-sm text-ink-1 dark:text-white font-medium">Stripe connected</p>
              </div>
              <p className="font-inter text-sm text-ink-1/70 dark:text-white/70 leading-relaxed mb-4">
                You receive 90% of each sale. Platform fee: 10%.
              </p>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-1.5 text-xs text-ink-1/50 dark:text-white/50 hover:text-ink-1/80 dark:hover:text-white/80 font-inter underline underline-offset-2 transition-colors disabled:opacity-50"
              >
                {disconnecting && <Loader2 className="w-3 h-3 animate-spin" />}
                Disconnect
              </button>
            </>
          )}

          {/* Edge case: connect_id exists but status is neither 'active'
              nor 'pending' (e.g. legacy rows, or webhook out of sync).
              Surface as "pending" semantics so the user has a path
              forward instead of seeing a blank state. */}
          {connectId && connectStatus !== 'pending' && connectStatus !== 'active' && (
            <>
              <p className="font-inter text-sm text-ink-1/70 dark:text-white/70 leading-relaxed mb-5">
                Your Stripe connection status is unclear. Re-run onboarding to refresh it.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gold hover:bg-gold/90 text-ink-1 font-inter font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Refresh Stripe Connection
              </button>
            </>
          )}
        </section>

        {/* Billing toggle */}
        <div className="flex items-center gap-3 mb-8">
          {(['monthly', 'annual'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`px-4 py-1.5 rounded-full font-inter text-sm transition-colors ${
                billing === b
                  ? 'bg-gold text-ink-1 dark:text-white'
                  : 'text-ink-1/60 dark:text-white/60 hover:text-ink-1 dark:hover:text-white border border-cream-3 dark:border-ink-3'
              }`}
            >
              {b === 'monthly' ? 'Monthly' : 'Annual (save ~30%)'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id
            const priceId =
              plan.id === 'standard' ? (billing === 'monthly' ? priceIds.standardMonthly : priceIds.standardYearly)
              : plan.id === 'pro'    ? (billing === 'monthly' ? priceIds.proMonthly      : priceIds.proYearly)
              : null

            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 flex flex-col gap-5 ${
                  plan.id === 'pro'
                    ? 'border-gold bg-gold/5'
                    : 'border-cream-3 dark:border-ink-3 bg-white dark:bg-ink-2'
                }`}
              >
                <div>
                  <p className="font-inter font-semibold text-ink-1 dark:text-white text-sm uppercase tracking-widest mb-2">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-playfair text-3xl text-ink-1 dark:text-white font-bold">{plan.price}</span>
                    <span className="font-inter text-sm text-ink-1/60 dark:text-white/60">{plan.interval}</span>
                  </div>
                  {plan.id !== 'free' && (
                    <p className="text-xs font-inter text-ink-1/60 dark:text-white/60 mt-0.5">{plan.annual}</p>
                  )}
                </div>

                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs font-inter text-ink-1/70 dark:text-white/70">
                      <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.id === 'free' ? (
                  <div className={`py-2.5 rounded-lg text-center text-sm font-inter font-medium ${isCurrent ? 'bg-cream-3 dark:bg-ink-3 text-ink-1/60 dark:text-white/60' : 'bg-cream-3 dark:bg-ink-3 text-ink-1/50 dark:text-white/50'}`}>
                    {isCurrent ? 'Current Plan' : 'Free Forever'}
                  </div>
                ) : (
                  <button
                    onClick={() => priceId && checkout(priceId)}
                    disabled={isCurrent || loading === priceId}
                    className={`py-2.5 rounded-lg text-sm font-inter font-semibold transition-colors flex items-center justify-center gap-2 ${
                      isCurrent
                        ? 'bg-cream-3 dark:bg-ink-3 text-ink-1/60 dark:text-white/60 cursor-default'
                        : plan.id === 'pro'
                        ? 'bg-gold hover:bg-gold/90 text-ink-1 dark:text-white'
                        : 'bg-cream-3 dark:bg-ink-3 hover:bg-cream-3 text-ink-1 dark:text-white border border-cream-3 dark:border-ink-3'
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

        <p className="text-xs font-inter text-ink-1/60 dark:text-white/60 text-center mt-6">
          Secured by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  )
}
