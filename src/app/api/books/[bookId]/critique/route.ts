import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/textGeneration'

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

  const text = await generateText({
    userPrompt: `You are a structural editor reviewing a book outline. Analyze this outline and return a JSON array of critique flags. Each flag should have:
- "type": either "OVERLAP" (two chapters cover similar ground), "GAP" (a topic the audience expects is missing), or "STRUCTURE" (sequencing or flow issue)
- "issue": one sentence describing the structural problem
- "suggestion": one sentence on how to fix it
- "chapterIndex": the index (0-based) of the chapter this applies to, or null if it applies to the overall structure

Return only the JSON array. Be direct and specific. Maximum 5 flags.

Book title: ${book.title}
Persona: ${book.persona}

Chapters:
${chapters}`,
    maxTokens: 2000,
    humanize: false,
  })

  try {
    const match = text.match(/\[[\s\S]*\]/)
    const parsed: unknown = JSON.parse(match?.[0] ?? '[]')
    if (!Array.isArray(parsed)) return NextResponse.json({ flags: [] })
    const flags = parsed
      .filter((f): f is { type?: unknown; issue?: unknown; suggestion?: unknown; chapterIndex?: unknown } =>
        f !== null && typeof f === 'object',
      )
      .map((f) => ({
        type: typeof f.type === 'string' ? f.type : 'STRUCTURE',
        issue: typeof f.issue === 'string' ? f.issue.slice(0, 500) : '',
        suggestion: typeof f.suggestion === 'string' ? f.suggestion.slice(0, 500) : '',
        chapterIndex: typeof f.chapterIndex === 'number' ? f.chapterIndex : null,
      }))
      .filter((f) => f.issue && f.suggestion)
    return NextResponse.json({ flags })
  } catch {
    return NextResponse.json({ flags: [] })
  }
}
