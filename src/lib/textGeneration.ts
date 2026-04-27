import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { WRITING_STANDARDS, HUMANIZATION_PROMPT } from './writing-standards'

// ── Three-level text generation fallback ────────────────────────────────────
// Primary:   Claude Sonnet
// Secondary: Gemini Flash
// Tertiary:  Gemini Flash Lite

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Per-request timeout — the SDK retries 5xx/429 itself. We add our own
  // ceiling so a stuck request doesn't tie up the route until Vercel's
  // maxDuration fires.
  timeout: 60_000,
  maxRetries: 2,
})

function extractText(content: Anthropic.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === 'text') return block.text.trim()
  }
  return ''
}

function getGemini() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not configured')
  return new GoogleGenerativeAI(key)
}

export interface TextGenOptions {
  systemPrompt?: string
  userPrompt: string
  maxTokens?: number
  /** If true, injects WRITING_STANDARDS + HUMANIZATION_PROMPT into every call */
  humanize?: boolean
}

function injectHumanization(prompt: string, humanize?: boolean): string {
  if (!humanize) return prompt
  return `${WRITING_STANDARDS}\n\n${HUMANIZATION_PROMPT}\n\n${prompt}`
}

/** Non-streaming text generation with 3-level fallback */
export async function generateText(opts: TextGenOptions): Promise<string> {
  const { systemPrompt, maxTokens = 2000, humanize = true } = opts
  const userPrompt = injectHumanization(opts.userPrompt, humanize)

  // ─── Primary: Claude Sonnet ───────────────────────────────────────────────
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: userPrompt }],
    })
    const text = extractText(msg.content)
    if (text) return text
  } catch (e) {
    console.warn('[textGen] Claude Sonnet failed, falling back to Gemini Flash:', (e as Error).message)
  }

  // ─── Secondary: Gemini Flash ──────────────────────────────────────────────
  try {
    const gemini = getGemini()
    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt
    const result = await model.generateContent(fullPrompt)
    const text = result.response.text().trim()
    if (text) return text
  } catch (e) {
    console.warn('[textGen] Gemini Flash failed, falling back to Gemini Flash Lite:', (e as Error).message)
  }

  // ─── Tertiary: Gemini Flash Lite ──────────────────────────────────────────
  try {
    const gemini = getGemini()
    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt
    const result = await model.generateContent(fullPrompt)
    const text = result.response.text().trim()
    if (text) return text
  } catch (e) {
    console.error('[textGen] All three models failed:', (e as Error).message)
  }

  throw new Error('Text generation failed across all models (Claude Sonnet → Gemini Flash → Gemini Flash Lite)')
}

/** Streaming text generation with fallback — streams from Claude, falls back to non-streaming Gemini */
export async function generateTextStream(
  opts: TextGenOptions,
  onDelta: (chunk: string) => void,
): Promise<string> {
  const { systemPrompt, maxTokens = 3000, humanize = true } = opts
  const userPrompt = injectHumanization(opts.userPrompt, humanize)

  // ─── Primary: Claude Sonnet (streaming) ───────────────────────────────────
  try {
    let fullContent = ''
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: userPrompt }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullContent += event.delta.text
        onDelta(event.delta.text)
      }
    }

    if (fullContent.trim()) return fullContent
  } catch (e) {
    console.warn('[textGenStream] Claude Sonnet failed, falling back to Gemini:', (e as Error).message)
  }

  // ─── Fallback: Gemini Flash (non-streaming, emit all at once) ─────────────
  const text = await generateText({ ...opts, userPrompt: opts.userPrompt })
  onDelta(text)
  return text
}
