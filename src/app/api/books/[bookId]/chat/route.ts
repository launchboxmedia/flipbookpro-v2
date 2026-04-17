import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { WRITING_STANDARDS, HUMANIZATION_PROMPT } from '@/lib/writing-standards'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pageId, messages, currentDraft } = await req.json()

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

  const systemPrompt = `You are a co-author helping revise a flipbook chapter. When the user asks for changes, return the full revised chapter text — nothing else, no explanation. If they ask a question, answer briefly then offer to revise.

${WRITING_STANDARDS}
${HUMANIZATION_PROMPT}

Book: ${book.title}
Chapter: ${page.chapter_title}
Brief: ${page.chapter_brief ?? ''}

Current draft:
---
${currentDraft}
---`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const reply = response.content[0].type === 'text' ? response.content[0].text : ''

  const looksLikeDraft = reply.length > 150 && !reply.startsWith('Sure') && !reply.startsWith('Of course') && !reply.startsWith('I ')

  if (looksLikeDraft) {
    await supabase
      .from('book_pages')
      .update({ content: reply, updated_at: new Date().toISOString() })
      .eq('id', pageId)
  }

  return NextResponse.json({ reply, draftUpdated: looksLikeDraft })
}
