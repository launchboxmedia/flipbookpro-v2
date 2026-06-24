import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderResourcePrintHtml } from '@/lib/resourceHtml'
import type { BookResource } from '@/types/database'

// Owner-only, print-ready HTML for one resource — the pre-publish counterpart
// of /read/[slug]/r/[id]. Lets an author open a resource from the preview
// page before the book has a published slug. Access is gated by book
// ownership (book.user_id === auth user) rather than the published_books
// access_type, so it works regardless of publish state.

export async function GET(
  _req: NextRequest,
  { params }: { params: { bookId: string; id: string } },
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  // Ownership check — confirm the book belongs to the requesting user before
  // exposing any resource attached to it.
  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return new NextResponse('Not found', { status: 404 })

  const { data: resource } = await supabase
    .from('book_resources')
    .select('id, book_id, chapter_index, resource_name, resource_type, content, created_at, updated_at')
    .eq('id', params.id)
    .eq('book_id', params.bookId)
    .single<BookResource>()

  if (!resource) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(renderResourcePrintHtml(resource), {
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=60',
    },
  })
}
