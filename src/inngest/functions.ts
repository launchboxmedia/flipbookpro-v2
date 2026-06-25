import { inngest } from './client'
import { sendSequenceEmail } from '@/lib/emailService'

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
    const { leadId, email, readerName, bookTitle, authorName, bookSlug, bookId } = event.data as {
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
