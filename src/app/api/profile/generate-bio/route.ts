import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/textGeneration'
import { consumeRateLimit } from '@/lib/rateLimit'

const SYSTEM_PROMPT = `You are a professional biography writer for authors and thought leaders. Write a compelling author bio in 2-3 sentences.

Rules:
- Written in third person
- Professional but warm and human
- Highlights expertise and credibility
- Specific to what the person shared
- Never generic or templated sounding
- Ends with something that makes readers want to learn more from this person

Return only the bio text. No preamble, no explanation, no quotes.`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await consumeRateLimit(supabase, { key: `generate-bio:${user.id}`, max: 5, windowSeconds: 3600 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in an hour.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const body = await req.json().catch(() => ({}))
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : ''

  if (!prompt) {
    return NextResponse.json({ error: 'Tell us a bit about yourself first.' }, { status: 400 })
  }
  if (prompt.length > 500) {
    return NextResponse.json({ error: 'Prompt must be 500 characters or fewer.' }, { status: 400 })
  }

  // name is woven into the prompt; fall back to a neutral subject so a
  // blank display name doesn't produce "Write an author bio for  based…".
  const subject = name || 'the author'

  try {
    const bio = await generateText({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Write an author bio for ${subject} based on this information: ${prompt}`,
      maxTokens: 200,
      humanize: false,
    })
    const trimmed = bio.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'Could not generate a bio. Try again.' }, { status: 502 })
    }
    return NextResponse.json({ bio: trimmed })
  } catch {
    return NextResponse.json({ error: 'Could not generate a bio. Try again.' }, { status: 502 })
  }
}
