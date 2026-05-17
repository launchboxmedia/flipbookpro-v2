import {
  Html, Head, Body, Container, Section, Text, Link, Hr, Preview,
} from '@react-email/components'

interface WelcomeSequenceEmailProps {
  subject: string
  /** AI-written HTML (<p> tags only). */
  body: string
  authorName: string
  bookTitle: string
  bookUrl: string
  readerName: string
  unsubscribeUrl: string
  /** Optional — drives the <Preview> inbox snippet. */
  previewText?: string
}

const GOLD = '#C9A84C'
const INK = '#1A1A1A'
const MUTED = '#6B6B6B'

const serif =
  'Georgia, Cambria, "Times New Roman", Times, serif'

export function WelcomeSequenceEmail({
  subject,
  body,
  authorName,
  bookTitle,
  bookUrl,
  readerName,
  unsubscribeUrl,
  previewText,
}: WelcomeSequenceEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText || subject}</Preview>
      <Body style={{ backgroundColor: '#F5F0E8', margin: 0, padding: '32px 0' }}>
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #EDE6D8',
          }}
        >
          <Section style={{ padding: '28px 36px 0' }}>
            <Text
              style={{
                fontFamily: serif,
                fontSize: '13px',
                color: MUTED,
                margin: '0 0 4px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {authorName}
            </Text>
            <Hr style={{ borderColor: GOLD, borderWidth: '0 0 2px', width: '40px', margin: '0 0 20px' }} />
          </Section>

          <Section style={{ padding: '0 36px' }}>
            <Text
              style={{
                fontFamily: serif,
                fontSize: '15px',
                lineHeight: '1.65',
                color: INK,
                margin: '0 0 16px',
              }}
            >
              {readerName ? `Hi ${readerName},` : 'Hi there,'}
            </Text>
            {/* AI body is sanitized-by-construction: generated server-side as
                <p>-only HTML by the sequence prompt, never reader input. */}
            <div
              style={{
                fontFamily: serif,
                fontSize: '15px',
                lineHeight: '1.65',
                color: INK,
              }}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          </Section>

          <Section style={{ padding: '24px 36px 28px' }}>
            <Hr style={{ borderColor: '#EDE6D8', borderWidth: '0 0 1px', margin: '0 0 16px' }} />
            <Text
              style={{
                fontFamily: serif,
                fontSize: '12px',
                color: MUTED,
                margin: '0 0 6px',
              }}
            >
              You&apos;re receiving this because you started reading{' '}
              <Link href={bookUrl} style={{ color: GOLD, textDecoration: 'none' }}>
                {bookTitle}
              </Link>
              .
            </Text>
            <Text style={{ fontFamily: serif, fontSize: '12px', color: MUTED, margin: 0 }}>
              <Link href={unsubscribeUrl} style={{ color: MUTED, textDecoration: 'underline' }}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default WelcomeSequenceEmail
