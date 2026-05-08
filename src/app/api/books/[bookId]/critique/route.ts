import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/textGeneration'
import { consumeRateLimit } from '@/lib/rateLimit'

// Sonnet at maxTokens 2500 with structured action payloads can run
// 15-25s. Match the route's safety ceiling to the typical run.
export const maxDuration = 60

const MAX_TITLE      = 200
const MAX_BRIEF      = 1500
const MAX_ISSUE      = 500
const MAX_SUGGESTION = 500

type CritiqueAction = 'merge' | 'insert' | 'reorder' | 'update_brief'

interface RawFlag {
  type?:               unknown
  issue?:              unknown
  suggestion?:         unknown
  chapterIndex?:       unknown
  action?:             unknown
  source_indices?:     unknown
  merged_title?:       unknown
  merged_brief?:       unknown
  insert_after_index?: unknown
  new_title?:          unknown
  new_brief?:          unknown
  from_index?:         unknown
  to_index?:           unknown
}

interface CritiqueFlag {
  type:               'OVERLAP' | 'GAP' | 'STRUCTURE'
  issue:              string
  suggestion:         string
  chapterIndex:       number | null
  action?:            CritiqueAction
  source_indices?:    number[]
  merged_title?:      string
  merged_brief?:      string
  insert_after_index?: number
  new_title?:         string
  new_brief?:         string
  from_index?:        number
  to_index?:          number
}

function clampString(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function asInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.trunc(value)
}

function asIndex(value: unknown, maxIndex: number): number | undefined {
  const n = asInt(value)
  if (n === undefined || n < 0 || n > maxIndex) return undefined
  return n
}

/** Produce a fully-validated CritiqueFlag from a Sonnet object. Returns
 *  null when the action payload is incomplete — better to drop the flag
 *  than ship a half-formed one that the client can't act on. */
function normaliseFlag(raw: RawFlag, maxIndex: number): CritiqueFlag | null {
  const typeRaw = clampString(raw.type, 20).toUpperCase()
  const type: CritiqueFlag['type'] =
    typeRaw === 'OVERLAP' ? 'OVERLAP'
    : typeRaw === 'GAP' ? 'GAP'
    : 'STRUCTURE'

  const issue      = clampString(raw.issue, MAX_ISSUE)
  const suggestion = clampString(raw.suggestion, MAX_SUGGESTION)
  if (!issue || !suggestion) return null

  const chapterIndex = (() => {
    const n = asInt(raw.chapterIndex)
    if (n === undefined) return null
    if (n < 0 || n > maxIndex) return null
    return n
  })()

  const actionRaw = clampString(raw.action, 20).toLowerCase()
  let action: CritiqueAction | undefined
  if (actionRaw === 'merge' || actionRaw === 'insert' || actionRaw === 'reorder' || actionRaw === 'update_brief') {
    action = actionRaw
  }

  const base: CritiqueFlag = { type, issue, suggestion, chapterIndex, action }

  // Per-action validation. If required fields are missing or out of
  // range, drop the action so Apply gracefully no-ops to a dismiss
  // rather than calling an RPC with garbage.
  if (action === 'merge') {
    const indices = Array.isArray(raw.source_indices)
      ? raw.source_indices.map((v) => asIndex(v, maxIndex)).filter((v): v is number => v !== undefined)
      : []
    const dedup = Array.from(new Set(indices))
    if (dedup.length !== 2) return { ...base, action: undefined }
    base.source_indices = [Math.min(dedup[0], dedup[1]), Math.max(dedup[0], dedup[1])]
    base.merged_title   = clampString(raw.merged_title, MAX_TITLE)
    base.merged_brief   = clampString(raw.merged_brief, MAX_BRIEF)
    if (!base.merged_title || !base.merged_brief) return { ...base, action: undefined, source_indices: undefined, merged_title: undefined, merged_brief: undefined }
  }

  if (action === 'insert') {
    const after = asInt(raw.insert_after_index)
    // Allow -1 for "insert at the very top". Anything else must be in
    // range; we cap at maxIndex (insert at the very bottom).
    if (after === undefined || after < -1 || after > maxIndex) return { ...base, action: undefined }
    base.insert_after_index = after
    base.new_title          = clampString(raw.new_title, MAX_TITLE)
    base.new_brief          = clampString(raw.new_brief, MAX_BRIEF)
    if (!base.new_title || !base.new_brief) return { ...base, action: undefined, insert_after_index: undefined, new_title: undefined, new_brief: undefined }
  }

  if (action === 'reorder') {
    const from = asIndex(raw.from_index, maxIndex)
    const to   = asIndex(raw.to_index,   maxIndex)
    if (from === undefined || to === undefined || from === to) return { ...base, action: undefined }
    base.from_index = from
    base.to_index   = to
  }

  if (action === 'update_brief') {
    const brief = clampString(raw.new_brief, MAX_BRIEF)
    if (!brief || chapterIndex === null) return { ...base, action: undefined }
    base.new_brief = brief
  }

  return base
}

const SYSTEM_PROMPT = `You are a structural editor reviewing a book outline.

Return a JSON array of up to 5 critique flags. Each flag must include human-readable text AND a structured action that the client will execute when the user clicks Apply. Be specific — no generic advice.

Required base fields on every flag:
- "type": "OVERLAP" | "GAP" | "STRUCTURE"
- "issue": one sentence describing the structural problem (max 500 chars)
- "suggestion": one sentence on how to fix it (max 500 chars)
- "chapterIndex": the 0-based chapter_index this flag applies to, or null if it applies to overall structure
- "action": one of "merge" | "insert" | "reorder" | "update_brief"

Per-action required fields:

For OVERLAP → "action": "merge"
- "source_indices": [N, M]  (two distinct 0-based chapter_index values to merge)
- "merged_title":  specific proposed title for the merged chapter (max 200 chars)
- "merged_brief":  2-3 sentence brief that combines the best of both (max 1500 chars)

For GAP → "action": "insert"
- "insert_after_index": 0-based chapter_index after which the new chapter goes; use -1 to insert at the very top
- "new_title":  specific proposed title for the new chapter (max 200 chars)
- "new_brief":  2-3 sentence brief that fills the identified gap (max 1500 chars)

For STRUCTURE → either:
  (a) "action": "reorder"
      - "from_index": 0-based chapter_index of the chapter to move
      - "to_index":   0-based chapter_index where it should go (the chapter currently there will swap with from_index)
  OR (b) "action": "update_brief"
      - "chapterIndex": the 0-based chapter_index whose brief needs revision (REQUIRED for this action)
      - "new_brief":    the improved chapter brief (max 1500 chars)

Use "reorder" when a chapter is in the wrong position. Use "update_brief" when a single chapter's brief is the problem. Pick one — never both.

Return only the JSON array, no markdown fences, no preamble.`

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await consumeRateLimit(supabase, { key: `critique:${user.id}`, max: 20, windowSeconds: 3600 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in an hour.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const { data: book } = await supabase
    .from('books')
    .select('id, title, persona, book_pages(chapter_index, chapter_title, chapter_brief)')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 0-based chapter listing so the indices in the prompt match the
  // 0-based indices Sonnet emits. Previous prompt used "1." prefixes,
  // which confused the model into emitting 1-based action indices that
  // would have crashed the RPCs after a merge or reorder. Strip the
  // CTA sentinel chapter (index 99) — it isn't part of the outline.
  const chapters = (book.book_pages ?? [])
    .filter((p: { chapter_index: number }) => p.chapter_index >= 0 && p.chapter_index < 99)
    .sort((a: { chapter_index: number }, b: { chapter_index: number }) => a.chapter_index - b.chapter_index)
  if (chapters.length === 0) return NextResponse.json({ flags: [] })

  const maxIndex = chapters[chapters.length - 1].chapter_index

  const chapterListing = chapters
    .map((p: { chapter_index: number; chapter_title: string; chapter_brief: string }) =>
      `Chapter ${p.chapter_index}: ${p.chapter_title} — ${p.chapter_brief ?? ''}`.trim(),
    )
    .join('\n')

  const text = await generateText({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Book title: ${book.title}
Persona: ${book.persona}

Chapters (chapter_index is 0-based):
${chapterListing}`,
    maxTokens: 2500,
    humanize: false,
  })

  try {
    const match = text.match(/\[[\s\S]*\]/)
    const parsed: unknown = JSON.parse(match?.[0] ?? '[]')
    if (!Array.isArray(parsed)) return NextResponse.json({ flags: [] })
    const flags: CritiqueFlag[] = []
    for (const raw of parsed) {
      if (!raw || typeof raw !== 'object') continue
      const flag = normaliseFlag(raw as RawFlag, maxIndex)
      if (flag) flags.push(flag)
      if (flags.length >= 5) break
    }
    return NextResponse.json({ flags })
  } catch {
    return NextResponse.json({ flags: [] })
  }
}
