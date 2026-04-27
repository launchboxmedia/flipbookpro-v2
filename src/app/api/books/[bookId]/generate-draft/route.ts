import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTextStream } from '@/lib/textGeneration'

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const { pageId } = await req.json()

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

  const { data: page } = await supabase
    .from('book_pages')
    .select('*')
    .eq('id', pageId)
    .eq('book_id', params.bookId)
    .single()

  if (!page) return new Response(JSON.stringify({ error: 'Page not found' }), { status: 404 })

  const personaInstructions: Record<string, string> = {
    business:    'Write for a business audience. Authoritative, direct, no fluff. Focus on practical application.',
    publisher:   'Write with editorial precision. Clear structure, measured tone, polished prose.',
    storyteller: 'Write with warmth and narrative pull. Use examples and scenes to bring ideas to life.',
  }

  const vibeInstructions: Record<string, string> = {
    educational:   'Adopt an educational style — clear explanations, structured thinking, informative prose that teaches.',
    inspirational: 'Adopt an inspirational style — uplifting language, hopeful tone, motivational examples that move the reader.',
    research_mode: 'Adopt a research-driven style — fact-based, analytical, well-substantiated claims with depth and rigor.',
  }

  const toneInstructions: Record<string, string> = {
    professional: 'Maintain a professional tone — authoritative, clear, and business-appropriate throughout.',
    witty:        'Use a witty tone — clever observations, light humor, and engaging wordplay without being flippant.',
    direct:       'Be direct and concise — get to the point immediately, no filler, action-oriented language.',
    empathetic:   'Use an empathetic tone — warm, supportive language that acknowledges the reader\'s challenges.',
  }

  const readerLevelInstructions: Record<number, string> = {
    1:  'Write at a Grade 3 reading level — very simple vocabulary, short sentences, concrete examples.',
    2:  'Write at a Grade 4 reading level — simple vocabulary, clear sentences.',
    3:  'Write at a Grade 5 reading level — accessible vocabulary, concrete and clear.',
    4:  'Write at a middle school reading level — moderate vocabulary, clear structure.',
    5:  'Write at a high school reading level — confident vocabulary, some complexity allowed.',
    6:  'Write at an introductory college reading level — academic vocabulary, structured arguments.',
    7:  'Write at an undergraduate reading level — sophisticated vocabulary, nuanced arguments.',
    8:  'Write at a graduate reading level — advanced vocabulary, expect the reader to keep up.',
    9:  "Write at a Master's reading level — specialist vocabulary, high-density ideas.",
    10: 'Write at a Ph.D. reading level — expert vocabulary, highly technical and precise.',
  }

  const persona      = book.persona ?? 'business'
  const personaNote  = personaInstructions[persona] ?? personaInstructions.business
  const vibeNote     = vibeInstructions[book.vibe ?? ''] ?? ''
  const toneNote     = toneInstructions[book.writing_tone ?? ''] ?? ''
  const levelNote    = readerLevelInstructions[book.reader_level ?? 5] ?? readerLevelInstructions[5]
  const humanNote    = book.human_score
    ? 'Humanization required: vary sentence lengths significantly, use natural transitions, include occasional rhetorical questions, avoid AI-detectable patterns (no "Furthermore", "In conclusion", "It is worth noting", or consecutive sentences of similar length).'
    : ''

  const encoder = new TextEncoder()
  let fullContent = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        fullContent = await generateTextStream(
          {
            userPrompt: `Write a flipbook chapter. This chapter will be displayed on a single page spread alongside an illustration.

${personaNote}
${vibeNote}
${toneNote}
${levelNote}
${humanNote}

Book title: ${book.title}
Chapter ${page.chapter_index + 1}: ${page.chapter_title}
Chapter brief: ${page.chapter_brief ?? 'No brief provided'}

Write 250-350 words. No heading — the chapter title is displayed separately. Start with a strong opening sentence directed at the reader. End with a sentence that transitions naturally to the next idea.`,
            maxTokens: 3000,
            humanize: true,
          },
          (chunk) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`))
          },
        )

        // Persist the completed draft
        await supabase
          .from('book_pages')
          .update({ content: fullContent, updated_at: new Date().toISOString() })
          .eq('id', pageId)

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
