import { inngest } from './client'
import { sendSequenceEmail, sendPlainEmail } from '@/lib/emailService'
import { generateSurveySequence } from '@/lib/generateSurveySequence'

const DELAYS: Array<{ position: 0 | 2 | 4 | 7 | 14; sleep: string | null }> = [
  { position: 0,  sleep: null },
  { position: 2,  sleep: '2d' },
  { position: 4,  sleep: '2d' },
  { position: 7,  sleep: '3d' },
  { position: 14, sleep: '7d' },
]

export const welcomeEmailSequence = inngest.createFunction(
  {
    id: 'welcome-email-sequence',
    triggers: [{ event: 'app/lead.created' }],
    cancelOn: [
      {
        event: 'app/lead.unsubscribed',
        if: 'async.data.leadId == event.data.leadId || async.data.email == event.data.email',
      },
    ],
  },
  async ({ event, step }) => {
    const { leadId, email, readerName, bookTitle, authorName, bookId } = event.data as {
      leadId: string | undefined
      email: string
      readerName: string | null
      bookTitle: string
      authorName: string
      bookSlug: string | null
      bookId: string
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bookbuilderpro.app'
    const unsubscribeUrl =
      `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}&book=${bookId}`

    void leadId // referenced in cancelOn expression; unused directly in handler

    for (const { position, sleep } of DELAYS) {
      if (sleep) {
        await step.sleep(`wait-before-day-${position}`, sleep)
      }

      await step.run(`send-day-${position}`, () =>
        sendSequenceEmail({
          readerName: readerName ?? '',
          readerEmail: email,
          bookTitle,
          authorName,
          sequencePosition: position,
          unsubscribeUrl,
        })
      )
    }
  }
)

// ── Survey-driven 5-day follow-up sequence ───────────────────────────────────
// Triggered when a reader submits the post-unlock survey on a published book.
// Generates personalised content once (step-memoised), then drips one email
// per day over 5 days. Cancels immediately if the reader unsubscribes.

type SurveyEventData = {
  leadId: string | undefined
  email: string
  readerName: string | null
  bookTitle: string
  authorName: string
  bookDescription: string
  surveyResponse: string
  bookId: string
}

function makeSurveyHandler(stepSleep: string) {
  return async ({ event, step }: { event: { data: SurveyEventData }; step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]['step'] }) => {
    const { leadId, email, readerName, bookTitle, authorName, bookDescription, surveyResponse, bookId } =
      event.data

    void leadId // referenced in cancelOn expression

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bookbuilderpro.app'
    const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}&book=${bookId}`

    const upsellUrl = await step.run('fetch-upsell-url', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const { data } = await supabase.from('books').select('upsell_url').eq('id', bookId).single()
      return data?.upsell_url ?? null
    })

    const emails = await step.run('generate-sequence', () =>
      generateSurveySequence({ bookTitle, authorName, surveyResponse, bookDescription, upsellUrl })
    )

    for (let i = 0; i < emails.length; i++) {
      const label = `day-${i + 1}`
      const email_content = emails[i]
      if (!email_content) continue

      if (i > 0) {
        await step.sleep(`wait-before-${label}`, stepSleep)
      }

      await step.run(`send-${label}`, () =>
        sendPlainEmail({
          to: email,
          fromName: authorName,
          subject: email_content.subject,
          body: `Hi${readerName ? ` ${readerName}` : ''},\n\n${email_content.body}`,
          unsubscribeUrl,
        })
      )
    }
  }
}

export const surveyEmailSequence = inngest.createFunction(
  {
    id: 'survey-email-sequence',
    triggers: [{ event: 'app/lead.survey_response' }],
    cancelOn: [
      {
        event: 'app/lead.unsubscribed',
        if: 'async.data.leadId == event.data.leadId || async.data.email == event.data.email',
      },
    ],
  },
  makeSurveyHandler('1d'),
)

// ── TEST VARIANT — delete after confirming sequence renders correctly ─────────
// Trigger: app/lead.survey_response.test  (never fires in production)
// Sleeps 1 s between emails so the full 5-day sequence completes in ~5 seconds.
// Hits sendPlainEmail for real — verify subjects, bodies, and unsubscribe footers
// in the Inngest dashboard and your inbox before removing this function.

export const surveyEmailSequenceTest = inngest.createFunction(
  {
    id: 'survey-email-sequence-test',
    triggers: [{ event: 'app/lead.survey_response.test' }],
  },
  makeSurveyHandler('1s'),
)
