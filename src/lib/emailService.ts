import nodemailer from 'nodemailer'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SEQUENCE_INTENTS: Record<number, string> = {
  0:  'This is the first email the reader receives immediately after signing up. Welcome them warmly. Reference the book, thank them for reading, and set expectations for what they will learn or gain. Keep it short, personal, and excited.',
  2:  'This is a follow-up sent 2 days after sign-up. Check in casually, ask if they have had a chance to dive in, share a brief insight or teaser from the book to reignite their curiosity.',
  4:  'This is a mid-sequence email sent 4 days in. Share a key concept, story, or takeaway from the book. Make it feel like a personal note from the author sharing something they care about deeply.',
  7:  'This is a week-in email. The reader has had a full week. Ask how it is going, address a common question or challenge related to the book topic, and remind them why they picked this book up in the first place.',
  14: 'This is the final email in the sequence, sent 2 weeks after sign-up. Wrap up with gratitude, encourage them to finish the book or revisit key sections, and invite a reply or connection. Leave on a warm, memorable note.',
}

export interface SendEmailArgs {
  readerName: string
  readerEmail: string
  bookTitle: string
  authorName: string
  sequencePosition: 0 | 2 | 4 | 7 | 14
  unsubscribeUrl: string
}

export async function sendSequenceEmail(args: SendEmailArgs): Promise<void> {
  const { readerName, readerEmail, bookTitle, authorName, sequencePosition, unsubscribeUrl } = args

  const intent = SEQUENCE_INTENTS[sequencePosition]

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.8,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are ${authorName}, the author of "${bookTitle}". Write a casual, warm, plain-text email to a reader named ${readerName || 'there'}. The email must feel personal, human, and conversational — never corporate or templated. No HTML, no markdown, no bullet points. Just natural paragraphs.

${intent}

Respond with a JSON object containing exactly two fields:
- "subject": a short, personal subject line (no emojis, no click-bait, under 60 chars)
- "body": the full plain-text email body, ending with your name ("— ${authorName}")

Do not include any other fields.`,
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  let subject = `A note from ${authorName}`
  let body = `Hi${readerName ? ` ${readerName}` : ''},\n\nThanks for reading ${bookTitle}.\n\n— ${authorName}`

  try {
    const parsed = JSON.parse(raw) as { subject?: string; body?: string }
    if (parsed.subject) subject = parsed.subject
    if (parsed.body) body = parsed.body
  } catch {
    console.error('[emailService] OpenAI JSON parse failed, using fallback body')
  }

  const fullBody = `${body}\n\n---\nYou're receiving this because you started reading ${bookTitle}.\nUnsubscribe: ${unsubscribeUrl}`

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.mailersend.net',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  await transporter.sendMail({
    from: `${authorName} <noreply@bookbuilderpro.app>`,
    to: readerEmail,
    subject,
    text: fullBody,
  })
}
