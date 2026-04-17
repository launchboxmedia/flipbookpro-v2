import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { WRITING_STANDARDS } from '@/lib/writing-standards'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: book } = await supabase
    .from('books')
    .select('*, book_pages(*)')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const chapters = (book.book_pages ?? [])
    .sort((a: { chapter_index: number }, b: { chapter_index: number }) => a.chapter_index - b.chapter_index)
    .map((p: { chapter_title: string; chapter_brief: string }, i: number) => `${i + 1}. ${p.chapter_title}: ${p.chapter_brief ?? ''}`)
    .join('\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are a structural editor reviewing a book outline. Analyze this outline and return a JSON array of critique flags. Each flag should have:
- "issue": one sentence describing the structural problem
- "suggestion": one sentence on how to fix it
- "chapterIndex": the index (0-based) of the chapter this applies to, or null if it applies to the overall structure

Return only the JSON array. Be direct and specific. Maximum 5 flags.

${WRITING_STANDARDS}

Book title: ${book.title}
Persona: ${book.persona}

Chapters:
${chapters}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  try {
    const match = text.match(/\[[\s\S]*\]/)
    const flags = JSON.parse(match?.[0] ?? '[]')
    return NextResponse.json({ flags })
  } catch {
    return NextResponse.json({ flags: [] })
  }
}
