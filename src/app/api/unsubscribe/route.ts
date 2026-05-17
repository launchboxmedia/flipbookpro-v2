import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resend } from '@/lib/resend'

function page(title: string, message: string): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:Georgia,serif;background:#F5F0E8;margin:0;padding:48px 16px;color:#1A1A1A"><div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #EDE6D8;border-radius:12px;padding:32px 36px;text-align:center"><div style="width:40px;height:2px;background:#C9A84C;margin:0 auto 20px"></div><h1 style="font-size:20px;margin:0 0 12px">${title}</h1><p style="font-size:15px;line-height:1.6;color:#4A4A4A;margin:0">${message}</p></div></body></html>`
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

// Public, unauthenticated — reached from the unsubscribe link in every
// sequence email. Cancels this reader's still-pending Resend sends and
// flags the lead so a re-submit won't reschedule. Uses the service-role
// client (RLS owner-only; there's no reader session here).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = (searchParams.get('email') ?? '').trim().toLowerCase()
  const bookId = (searchParams.get('book') ?? '').trim()

  if (!email || !bookId) {
    return page('Invalid link', 'This unsubscribe link is missing information. No action was taken.')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[unsubscribe] SUPABASE_SERVICE_ROLE_KEY not set')
    return page('Something went wrong', 'We could not process your request right now. Please try again later.')
  }

  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, welcome_resend_ids, welcome_unsubscribed')
    .eq('book_id', bookId)
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Always show the same confirmation even if the lead isn't found — don't
  // leak whether an address is on a given book's list.
  const { data: book } = await supabaseAdmin
    .from('books')
    .select('title')
    .eq('id', bookId)
    .maybeSingle()
  const bookTitle = book?.title ?? 'this book'

  if (lead && !lead.welcome_unsubscribed) {
    const ids: string[] = Array.isArray(lead.welcome_resend_ids) ? lead.welcome_resend_ids : []
    for (const id of ids) {
      try {
        await resend.emails.cancel(id)
      } catch (e) {
        // Already sent or already cancelled — nothing to do.
        console.error('[unsubscribe] cancel failed for', id, (e as Error).message)
      }
    }
    await supabaseAdmin
      .from('leads')
      .update({ welcome_unsubscribed: true })
      .eq('id', lead.id)
  }

  return page(
    "You've been unsubscribed",
    `You won't receive any more emails about <strong>${bookTitle}</strong>.`,
  )
}
