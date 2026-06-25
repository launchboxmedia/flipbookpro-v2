import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { renderResourcePrintHtml } from '@/lib/resourceHtml'
import { cookieNameForSlug, verifyAccessToken, resolveAccessType, type AccessType } from '@/lib/readAccess'
import type { BookResource } from '@/types/database'

// Public, print-ready HTML for one resource attached to a published book.
// Same pattern as /api/books/[id]/export-pdf — return a self-contained HTML
// document with print CSS + an auto-fired window.print().
//
// Access rules mirror the /read/[slug] page:
//   - free  → anyone with the slug
//   - email → soft gate; readers can hit the URL directly with the resource
//             id. Email gating only protects the flipbook itself, not these
//             downloads. The resource id is unguessable per the underlying
//             uuid.
//   - paid  → requires the signed access cookie set by /api/read/grant.

interface PublishedRow {
  book_id: string
  access_type: AccessType | null
  gate_type: 'none' | 'email' | 'payment' | null
  is_active: boolean
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string; id: string } }) {
  const supabase = await createClient()

  const { data: pub } = await supabase
    .from('published_books')
    .select('book_id, access_type, gate_type, is_active')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single<PublishedRow>()

  if (!pub) return new NextResponse('Not found', { status: 404 })

  const { data: resource } = await supabase
    .from('book_resources')
    .select('id, book_id, chapter_index, resource_name, resource_type, content, created_at, updated_at')
    .eq('id', params.id)
    .eq('book_id', pub.book_id)
    .single<BookResource>()

  if (!resource) return new NextResponse('Not found', { status: 404 })

  // Paid books — require the signed access cookie keyed to this slug.
  const accessType = resolveAccessType(pub)
  if (accessType === 'paid') {
    const jar = await cookies()
    const token = jar.get(cookieNameForSlug(params.slug))?.value
    if (!verifyAccessToken(token, params.slug)) {
      return NextResponse.redirect(new URL(`/read/${params.slug}`, _req.url))
    }
  }

  return new NextResponse(renderResourcePrintHtml(resource), {
    headers: {
      'Content-Type':  'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=60',
    },
  })
}
