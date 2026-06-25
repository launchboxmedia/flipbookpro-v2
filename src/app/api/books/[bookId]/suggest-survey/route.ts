import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/textGeneration'

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: book } = await supabase
    .from('books')
    .select('title, subtitle, persona, back_cover_description')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const context = [
    `Title: ${book.title}`,
    book.subtitle ? `Subtitle: ${book.subtitle}` : null,
    book.persona ? `Target reader: ${book.persona}` : null,
    book.back_cover_description ? `Summary: ${book.back_cover_description}` : null,
  ].filter(Boolean).join('\n')

  const prompt = `You are helping an author create a post-read survey for their book.

Book context:
<user_content>
${context}
</user_content>

Generate ONE insightful multiple-choice survey question that helps the author understand their readers. The question should feel personal and relevant to the book's topic.

Respond with valid JSON only, no markdown, no explanation:
{"question":"...","options":["...","...","...","..."]}

Rules:
- question: max 12 words, genuinely useful insight for the author
- options: exactly 4 short answers (3-7 words each), mutually exclusive, no "other"`

  const raw = await generateText({
    systemPrompt: 'You output valid JSON only. No markdown code fences.',
    userPrompt: prompt,
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 300,
    humanize: false,
  })

  try {
    const parsed = JSON.parse(raw.trim())
    if (!parsed.question || !Array.isArray(parsed.options) || parsed.options.length < 2) {
      throw new Error('bad shape')
    }
    return NextResponse.json({ question: parsed.question, options: parsed.options.slice(0, 4) })
  } catch {
    return NextResponse.json({ error: 'Failed to generate survey suggestion' }, { status: 500 })
  }
}
