import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Track a book view event (authenticated only — anonymous view counts are
 * incremented server-side from the public read page render to prevent abuse). */
export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { event, metadata } = await req.json().catch(() => ({ event: 'view', metadata: {} }))

  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('id', params.bookId)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Log the event (published_books analytics)
  if (event === 'view') {
    try {
      await supabase.rpc('increment_book_views', { book_id_input: params.bookId })
    } catch {
      // RPC may not exist yet — graceful degradation
    }
  }

  return NextResponse.json({ tracked: true, event, metadata })
}

/** Get analytics for a book */
export async function GET(_req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: book }, { data: leads }, { data: published }, { data: surveyLeads }] = await Promise.all([
    supabase.from('books').select('id, title, status, created_at').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('book_id', params.bookId),
    supabase.from('published_books').select('id, slug, view_count, survey_question, survey_options').eq('book_id', params.bookId).single(),
    supabase.from('leads').select('survey_response').eq('book_id', params.bookId).not('survey_response', 'is', null),
  ])

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const surveyOptions = Array.isArray(published?.survey_options) ? published.survey_options as string[] : []
  const surveyCounts: Record<string, number> = Object.fromEntries(surveyOptions.map(o => [o, 0]))
  for (const row of surveyLeads ?? []) {
    if (row.survey_response && row.survey_response in surveyCounts) {
      surveyCounts[row.survey_response]++
    }
  }
  const surveyRespondents = Object.values(surveyCounts).reduce((a, b) => a + b, 0)

  return NextResponse.json({
    bookId: book.id,
    title: book.title,
    status: book.status,
    views: published?.view_count ?? 0,
    leads: leads ?? 0,
    publishedSlug: published?.slug ?? null,
    createdAt: book.created_at,
    surveyQuestion: published?.survey_question ?? null,
    surveyOptions,
    surveyCounts,
    surveyRespondents,
  })
}
