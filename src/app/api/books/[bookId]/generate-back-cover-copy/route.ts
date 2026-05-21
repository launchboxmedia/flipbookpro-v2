import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeRateLimit } from '@/lib/rateLimit'
import { generateText } from '@/lib/textGeneration'
import type { RadarResult } from '@/types/database'

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await consumeRateLimit(supabase, { key: `generate-back-cover-copy:${user.id}`, max: 5, windowSeconds: 3600 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in an hour.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }

  const { data: book } = await supabase
    .from('books')
    .select('id, title, creator_radar_data')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  const { data: pages } = await supabase
    .from('book_pages')
    .select('chapter_index, title')
    .eq('book_id', params.bookId)
    .gte('chapter_index', 0)
    .order('chapter_index', { ascending: true })

  const chapterTitles = pages?.map((p) => p.title).filter(Boolean) ?? []

  const radarData = book.creator_radar_data as RadarResult | null
  const biggestPain = radarData?.audienceInsights?.biggestPain ?? null
  const alreadyTried = radarData?.audienceInsights?.alreadyTried ?? null
  const positioning = radarData?.bookRecommendations?.positioning ?? null
  const suggestedHook = radarData?.bookRecommendations?.suggested_hook ?? null
  const topSignal = radarData?.marketSignals?.[0]?.signal ?? null

  const hasRadar = !!(biggestPain || alreadyTried || positioning || suggestedHook || topSignal)

  const systemPrompt = `You are an expert at writing compelling back cover copy for books.

You will receive a book title, chapter list, and (optionally) Creator Radar insights about the target audience and market positioning.

Output MUST be valid JSON with exactly this structure:
{
  "tagline": "A single punchy sentence (max 15 words) that hooks the reader",
  "description": "2-3 paragraphs explaining what the book delivers, who it's for, and why it matters (200-300 words)",
  "closing_pitch": "A short urgent call-to-action paragraph explaining why readers should act now (50-100 words)",
  "cta_text": "Action-oriented CTA button text (3-5 words, e.g. 'Get Your Copy Now')"
}

If Creator Radar data is provided, ground every element in those insights:
- Use biggestPain as the hook for the tagline
- Reference alreadyTried in the description to show empathy
- Use positioning to frame how this book is different
- Integrate suggestedHook as the opening of the description
- Use topSignal (market urgency) in the closing_pitch

If NO radar data is provided, infer positioning from the book title and chapters.

Write in a confident, direct tone. No fluff. No generic platitudes. Make every sentence earn its place.`

  const userPrompt = `<book_title>${book.title}</book_title>

<chapter_titles>
${chapterTitles.length > 0 ? chapterTitles.map((t, i) => `Chapter ${i + 1}: ${t}`).join('\n') : 'No chapters yet'}
</chapter_titles>

<creator_radar_insights>
${hasRadar ? `
biggestPain: ${biggestPain ?? 'N/A'}
alreadyTried: ${alreadyTried ?? 'N/A'}
positioning: ${positioning ?? 'N/A'}
suggestedHook: ${suggestedHook ?? 'N/A'}
topSignal: ${topSignal ?? 'N/A'}
` : 'No Creator Radar data available. Infer positioning from title and chapters.'}
</creator_radar_insights>

Generate the back cover copy as valid JSON.`

  try {
    const response = await generateText({
      systemPrompt,
      userPrompt,
      humanize: false,
      model: 'claude-sonnet-4-6',
    })

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    if (
      typeof parsed.tagline !== 'string' ||
      typeof parsed.description !== 'string' ||
      typeof parsed.closing_pitch !== 'string' ||
      typeof parsed.cta_text !== 'string'
    ) {
      throw new Error('Invalid JSON structure')
    }

    return NextResponse.json({
      tagline: parsed.tagline,
      description: parsed.description,
      closing_pitch: parsed.closing_pitch,
      cta_text: parsed.cta_text,
      used_radar: hasRadar,
    })
  } catch (error) {
    console.error('[generate-back-cover-copy]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
