import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/textGeneration'
import { consumeRateLimit } from '@/lib/rateLimit'
import type { BookResource, BookResourceType } from '@/types/database'

// Generate a standalone downloadable resource (checklist, template, script,
// matrix, workflow, swipe file) for a chapter. The chapter's draft references
// these via `[[RESOURCE: Name | type]]` markers; this route turns the
// marker into actual usable markdown content the reader can print or
// download.
//
// Pipeline:
//   1. Auth + ownership check on the book.
//   2. Rate limit (20 / hour / user).
//   3. Validate inputs.
//   4. Sonnet generates the resource body (humanize: false — the resource is
//      a working document, not narrative prose, and humanization would
//      introduce unwanted hedging).
//   5. Strip any [[RESOURCE]] markers Sonnet might echo back into the
//      content (defensive — the marker syntax is for chapter prose only).
//   6. Upsert into book_resources keyed on (book_id, chapter_index,
//      resource_name) so regeneration replaces the existing row.

export const maxDuration = 60

const ALLOWED_TYPES = new Set<BookResourceType>([
  'checklist', 'template', 'script', 'matrix', 'workflow', 'swipe-file',
])

interface BookOwner {
  id: string
  user_id: string
}

const SYSTEM_PROMPT = `You are creating a standalone downloadable resource for a book chapter. This resource will be printed, downloaded, or used as a working document by the reader.

Format rules:
- Use clean markdown formatting
- Checklists: use [ ] for checkboxes
- Templates: use _______________ for fill-in fields
- Scripts: use clear speaker labels and line breaks
- Matrices: use markdown tables
- Workflows: use numbered steps with clear branches
- Swipe files: use numbered or bulleted items

Make it immediately usable. No preamble, no 'this resource will help you' intro — start with the content itself.
Include a clear title at the top as # Title`

/** Strip any `[[RESOURCE: ... | ...]]` markers from the generated body. The
 *  marker syntax belongs in chapter prose, not in a resource's own content
 *  — Sonnet occasionally echoes the marker back when the user prompt
 *  mentions it. Belt and suspenders. */
function stripResourceMarkers(s: string): string {
  return s.replace(/\[\[RESOURCE:[^\]]*\]\]/g, '').trim()
}

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await consumeRateLimit(supabase, {
    key: `generate-resource:${user.id}`,
    max: 20,
    windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in an hour.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const body = await req.json().catch(() => ({}))
  const chapterIndexRaw = Number(body.chapterIndex)
  if (!Number.isFinite(chapterIndexRaw) || chapterIndexRaw < 0) {
    return NextResponse.json({ error: 'chapterIndex required' }, { status: 400 })
  }
  const chapterIndex = Math.floor(chapterIndexRaw)

  const resourceName = typeof body.resourceName === 'string' ? body.resourceName.trim() : ''
  if (!resourceName) {
    return NextResponse.json({ error: 'resourceName required' }, { status: 400 })
  }
  if (resourceName.length > 200) {
    return NextResponse.json({ error: 'resourceName too long' }, { status: 400 })
  }

  const resourceType = typeof body.resourceType === 'string' ? body.resourceType.trim() : ''
  if (!ALLOWED_TYPES.has(resourceType as BookResourceType)) {
    return NextResponse.json({ error: 'Invalid resourceType' }, { status: 400 })
  }
  const type = resourceType as BookResourceType

  const chapterContent = typeof body.chapterContent === 'string' ? body.chapterContent : ''

  // Ownership check. RLS would also block writes to other users' books, but
  // having the explicit check here lets us return a clean 404 instead of a
  // policy-rejection surface.
  const { data: book } = await supabase
    .from('books')
    .select('id, user_id')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single<BookOwner>()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // chapterContent is wrapped in a tag so the model treats it as context,
  // not as instructions that could override the system prompt.
  let generated: string
  try {
    generated = await generateText({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Create a ${type} resource named '${resourceName}' for this book chapter:

Chapter content for context:
<chapter_content>
${chapterContent.slice(0, 2000)}
</chapter_content>

Generate the complete, standalone ${type} that the chapter references. Make it specific to the chapter's topic and immediately usable.`,
      maxTokens: 2500,
      humanize: false,
    })
  } catch (e) {
    console.error('[generate-resource] generation failed:', e instanceof Error ? e.message : 'unknown')
    return NextResponse.json({ error: 'Generation failed' }, { status: 502 })
  }

  const cleaned = stripResourceMarkers(generated)
  if (!cleaned) {
    return NextResponse.json({ error: 'Generation returned empty content' }, { status: 502 })
  }

  // Upsert keyed on (book_id, chapter_index, resource_name). Regenerating an
  // existing resource overwrites the previous row instead of duplicating.
  // The unique index in the migration backs this onConflict.
  const { data: row, error: upsertError } = await supabase
    .from('book_resources')
    .upsert(
      {
        book_id:       params.bookId,
        chapter_index: chapterIndex,
        resource_name: resourceName,
        resource_type: type,
        content:       cleaned,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'book_id,chapter_index,resource_name' },
    )
    .select('id, resource_name, resource_type, content, chapter_index')
    .single<Pick<BookResource, 'id' | 'resource_name' | 'resource_type' | 'content' | 'chapter_index'>>()

  if (upsertError || !row) {
    console.error('[generate-resource] upsert failed:', upsertError?.message ?? 'no row returned')
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  return NextResponse.json({
    id: row.id,
    resource_name: row.resource_name,
    resource_type: row.resource_type,
    content: row.content,
    chapterIndex: row.chapter_index,
  })
}
