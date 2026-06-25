import { generateText } from '@/lib/textGeneration'

export interface SequenceEmail {
  day: number
  subject: string
  body: string
}

export interface SurveySequenceInput {
  bookTitle: string
  authorName: string
  surveyResponse: string
  bookDescription: string
}

const SYSTEM = `You are an elite direct-response copywriter. You output valid JSON only — no markdown, no explanation, no code fences.

WRITING RULES (non-negotiable across every email):
- Zero pleasantries. Never write "hope you're well", "I hope this finds you", "thanks for", "great that", or any variant.
- Zero emojis.
- Sentences are short. Max 15 words per sentence.
- Frequent line breaks. One idea per paragraph. Never more than 3 sentences in a block.
- Sign off with ONLY the author's first name on its own line.
- Weave the reader's survey response naturally into the narrative — it is the emotional core of the sequence.
- Write in second person ("you", not "our readers").
- Never reference "this email" or "this sequence". Write as if one human wrote directly to one other human.`

export async function generateSurveySequence(input: SurveySequenceInput): Promise<SequenceEmail[]> {
  const { bookTitle, authorName, surveyResponse, bookDescription } = input

  const userPrompt = `Book: "${bookTitle}"
Author: ${authorName}
Book description: ${bookDescription}
Reader's survey response: "${surveyResponse}"

Write a 5-email follow-up sequence. Each email must feel like a natural continuation of the last.

Email 1 — Delivery & Welcome. Acknowledge what the reader said in the survey. One sentence only on the survey response — plant it, don't over-explain it.
Email 2 — Agitate the Bottleneck. Dig into the specific pain behind the survey response. Make the reader feel seen. No solution yet. End with a question.
Email 3 — Paradigm Shift / New Opportunity. Reframe their bottleneck. The old way of thinking about this problem is wrong. Introduce a new lens from the book's core idea.
Email 4 — Proof / Case Study. A brief, concrete story (real or archetypal) of someone who had the same survey response and got a result using the book's approach.
Email 5 — Direct Pitch / Call to Action. Make the offer. Direct, confident, no hedging. One clear CTA. Short.

Respond with a JSON array of exactly 5 objects:
[{"day":1,"subject":"...","body":"..."},{"day":2,"subject":"...","body":"..."},{"day":3,"subject":"...","body":"..."},{"day":4,"subject":"...","body":"..."},{"day":5,"subject":"...","body":"..."}]

In "body", use \\n for line breaks between paragraphs.`

  const raw = await generateText({
    systemPrompt: SYSTEM,
    userPrompt,
    model: 'claude-sonnet-4-6',
    maxTokens: 3000,
    humanize: false,
  })

  const parsed: unknown = JSON.parse(raw.trim())

  if (!Array.isArray(parsed) || parsed.length !== 5) {
    throw new Error('Expected 5-email array from AI')
  }

  return (parsed as Record<string, unknown>[]).map((e, i) => {
    if (typeof e.day !== 'number' || typeof e.subject !== 'string' || typeof e.body !== 'string') {
      throw new Error(`Email ${i + 1} has wrong shape`)
    }
    return { day: e.day, subject: e.subject, body: e.body }
  })
}
