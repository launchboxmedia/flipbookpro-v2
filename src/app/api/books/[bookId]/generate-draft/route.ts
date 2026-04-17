import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { WRITING_STANDARDS, HUMANIZATION_PROMPT } from '@/lib/writing-standards'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pageId } = await req.json()

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: page } = await supabase
    .from('book_pages')
    .select('*')
    .eq('id', pageId)
    .eq('book_id', params.bookId)
    .single()

  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 })

  const personaInstructions: Record<string, string> = {
    business: 'Write for a business audience. Authoritative, direct, no fluff. Focus on practical application.',
    publisher: 'Write with editorial precision. Clear structure, measured tone, polished prose.',
    storyteller: 'Write with warmth and narrative pull. Use examples and scenes to bring ideas to life.',
  }

  const persona = book.persona ?? 'business'
  const personaNote = personaInstructions[persona] ?? personaInstructions.business

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: `Write a flipbook chapter. This chapter will be displayed on a single page spread alongside an illustration.

${WRITING_STANDARDS}

${HUMANIZATION_PROMPT}

${personaNote}

Book title: ${book.title}
Chapter ${page.chapter_index + 1}: ${page.chapter_title}
Chapter brief: ${page.chapter_brief ?? 'No brief provided'}

Write 250-350 words. No heading — the chapter title is displayed separately. Start with a strong opening sentence directed at the reader. End with a sentence that transitions naturally to the next idea.`,
      },
    ],
  })

  const content = message.content[0].type === 'text' ? message.content[0].text : ''

  await supabase
    .from('book_pages')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', pageId)

  return NextResponse.json({ content })
}
