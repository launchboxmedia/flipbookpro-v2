import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmailSequence } from '@/lib/generateEmailSequence'

// Thin wrapper around the shared generation logic. Used by the manual
// "Generate Sequence" button. The publish route calls generateEmailSequence
// directly via waitUntil — no HTTP round-trip.
export async function POST(_req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await generateEmailSequence({
    bookId: params.bookId,
    userId: user.id,
    supabase,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }
  return NextResponse.json({ success: true, sequence_id: result.sequenceId })
}
