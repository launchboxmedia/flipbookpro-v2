import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BillingPanel } from '@/components/settings/BillingPanel'
import { PLANS } from '@/lib/stripe'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Resolve real Stripe price IDs server-side (env-driven via lib/stripe.ts)
  // and pass to the client panel — env vars don't need to leak to the client.
  const priceIds = {
    standardMonthly: PLANS.standard_monthly.priceId,
    standardYearly:  PLANS.standard_yearly.priceId,
    proMonthly:      PLANS.pro_monthly.priceId,
    proYearly:       PLANS.pro_yearly.priceId,
  }

  return <BillingPanel profile={profile ?? null} priceIds={priceIds} />
}
