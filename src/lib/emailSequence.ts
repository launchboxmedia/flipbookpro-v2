import { createElement } from 'react'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend, isResendConfigured } from '@/lib/resend'
import { WelcomeSequenceEmail } from '@/emails/WelcomeSequenceEmail'
import type { EmailItem } from '@/types/database'

// Resend's shared test sender — works without domain verification. Switch
// to "noreply@bookbuilderpro.app" once that domain is verified in Resend.
const FROM_ADDRESS = 'onboarding@resend.dev'

interface ScheduleArgs {
  bookId: string
  leadEmail: string
  leadName: string | null
  bookSlug: string | null
}

/** Schedules a reader's 5-email welcome sequence via Resend `scheduledAt`
 *  (no cron/queue). Per-reader Resend IDs are written to the reader's
 *  leads row so unsubscribe can cancel exactly their pending sends.
 *
 *  Fire-and-forget: every failure path logs and returns — never throws —
 *  so it cannot break lead capture. Uses the service-role client because
 *  the caller (public lead route) has no session and email_sequences /
 *  profiles are owner-only under RLS. */
export async function scheduleWelcomeSequence({
  bookId, leadEmail, leadName, bookSlug,
}: ScheduleArgs): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !isResendConfigured()) {
    // Not configured — silently skip (fail-safe, like Sentry).
    return
  }

  // 1. Book's sequence (one row per book; latest wins if somehow >1).
  const { data: sequence } = await supabaseAdmin
    .from('email_sequences')
    .select('id, emails, status')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const emails = (sequence?.emails ?? []) as EmailItem[]
  if (!sequence || emails.length === 0) return

  // 2. The reader's lead row (match by book + email, per the unsubscribe
  //    contract). Skip if already scheduled or unsubscribed.
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, welcome_resend_ids, welcome_unsubscribed')
    .eq('book_id', bookId)
    .eq('email', leadEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lead) return
  if (lead.welcome_unsubscribed) return
  if (Array.isArray(lead.welcome_resend_ids) && lead.welcome_resend_ids.length > 0) return

  // 3. Book + author context for the from-line and template.
  const { data: book } = await supabaseAdmin
    .from('books')
    .select('title, author_name, user_id')
    .eq('id', bookId)
    .single()
  if (!book) return

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('display_name')
    .eq('id', book.user_id)
    .single()

  const authorName = book.author_name || profile?.display_name || 'The Author'
  const bookUrl = bookSlug
    ? `https://go.bookbuilderpro.app/${bookSlug}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://bookbuilderpro.app')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bookbuilderpro.app'
  const unsubscribeUrl =
    `${appUrl}/api/unsubscribe?email=${encodeURIComponent(leadEmail)}&book=${bookId}`

  // 4. Schedule all 5 via Resend.
  const resendIds: string[] = []
  for (const email of [...emails].sort((a, b) => a.position - b.position)) {
    const scheduledAt = new Date()
    scheduledAt.setDate(scheduledAt.getDate() + (email.delay_days || 0))

    try {
      const { data, error } = await resend.emails.send({
        from: `${authorName} <${FROM_ADDRESS}>`,
        to: leadEmail,
        subject: email.subject,
        react: createElement(WelcomeSequenceEmail, {
          subject: email.subject,
          body: email.body,
          authorName,
          bookTitle: book.title,
          bookUrl,
          readerName: leadName || '',
          unsubscribeUrl,
          previewText: email.preview_text,
        }),
        scheduledAt: (email.delay_days || 0) === 0 ? undefined : scheduledAt.toISOString(),
        tags: [
          { name: 'book_id', value: bookId },
          { name: 'sequence_position', value: String(email.position) },
        ],
      })
      if (error) {
        console.error('[emailSequence] Resend send failed:', JSON.stringify(error))
      } else if (data?.id) {
        resendIds.push(data.id)
      }
    } catch (e) {
      console.error('[emailSequence] Resend send threw:', (e as Error).message)
    }
  }

  if (resendIds.length === 0) return

  // 5. Persist per-reader IDs on the lead; flip the sequence marker active.
  await supabaseAdmin
    .from('leads')
    .update({ welcome_resend_ids: resendIds })
    .eq('id', lead.id)

  if (sequence.status !== 'active') {
    await supabaseAdmin
      .from('email_sequences')
      .update({ status: 'active', activated_at: new Date().toISOString() })
      .eq('id', sequence.id)
  }
}
