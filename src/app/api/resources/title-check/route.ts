import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/textGeneration'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title } = await req.json()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const text = await generateText({
    userPrompt: `Score this book title on a scale of 1-10 and provide brief feedback. Return JSON with "score" (number) and "feedback" (string, 2-3 sentences).

Title: "${title}"

Evaluate for: clarity, intrigue/curiosity, market appeal, memorability, and uniqueness. Be honest — most titles score 4-7. Only truly exceptional titles get 8+.

Return only the JSON object, no other text.`,
    maxTokens: 300,
    humanize: false,
  })

  try {
    const match = text.match(/\{[\s\S]*\}/)
    const result = JSON.parse(match?.[0] ?? '{}')
    return NextResponse.json({
      score: Math.min(10, Math.max(1, result.score ?? 5)),
      feedback: result.feedback ?? 'Could not analyze this title.',
    })
  } catch {
    return NextResponse.json({ score: 5, feedback: 'Analysis returned unexpected format.' })
  }
}
