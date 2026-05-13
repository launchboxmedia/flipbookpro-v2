import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Severs the link between this user's profile and their Stripe
 * connected account. The Stripe account itself continues to exist —
 * Standard accounts are owned by the user, not by FlipBookPro — but
 * future paid book sales for this author will no longer route via
 * destination charges (so the platform takes 100% of those sales
 * unless the user re-connects).
 *
 * We don't call stripe.oauth.deauthorize() because that's an Express-
 * account flow; Standard accounts have no platform OAuth grant to
 * revoke. Clearing the columns is sufficient.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('profiles')
    .update({
      stripe_connect_id:     null,
      stripe_connect_status: null,
    })
    .eq('id', user.id)

  if (error) {
    console.error('Stripe Connect disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  return NextResponse.json({ disconnected: true })
}
