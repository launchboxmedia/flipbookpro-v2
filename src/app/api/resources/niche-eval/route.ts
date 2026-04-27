import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/textGeneration'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { niche } = await req.json()
  if (!niche) return NextResponse.json({ error: 'niche required' }, { status: 400 })

  const text = await generateText({
    userPrompt: `Evaluate this niche for a digital flipbook/ebook. Return JSON with "demand" (High/Medium/Low), "competition" (High/Medium/Low), and "verdict" (2-3 sentences of actionable advice).

Niche: "${niche}"

Consider: audience size, willingness to pay for digital content, existing competition in digital books, lead magnet potential, and monetization opportunities.

Return only the JSON object, no other text.`,
    maxTokens: 300,
    humanize: false,
  })

  try {
    const match = text.match(/\{[\s\S]*\}/)
    const result = JSON.parse(match?.[0] ?? '{}')
    return NextResponse.json({
      demand: result.demand ?? 'Medium',
      competition: result.competition ?? 'Medium',
      verdict: result.verdict ?? 'Could not evaluate this niche.',
    })
  } catch {
    return NextResponse.json({ demand: 'Unknown', competition: 'Unknown', verdict: 'Evaluation returned unexpected format.' })
  }
}
