# Upload Existing Content Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authors paste an existing manuscript or outline and have it parsed into chapters, bypassing the topic-discovery radar step entirely.

**Architecture:** Upload mode replaces Step1Radar at step 0 with a new `StepUploadContent` component. Chapter detection reuses the existing `/api/detect-chapters` endpoint. Optional draft import calls a new `/api/books/[bookId]/split-chapters` route that tries regex splitting first, falls back to Claude Haiku returning anchor excerpts. All downstream wizard steps (Persona → Meta → Tone → Style → Typography) are unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind (ink/cream/gold tokens), `@anthropic-ai/sdk` via `generateText`, Supabase

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/components/wizard/WizardShell.tsx` — add `content?` to `WizardData.chapters` item type; conditional step-0 render; pass `bookId` to `StepUploadContent` |
| Modify | `src/components/dashboard/NewBookButton.tsx` — remove `console.warn` bail-out |
| Modify | `src/app/api/books/[bookId]/setup/route.ts` — extend `ChapterInput` + upsert to accept optional `content` |
| Create | `src/components/wizard/StepUploadContent.tsx` — new step-0 component for upload mode |
| Create | `src/app/api/books/[bookId]/split-chapters/route.ts` — regex + Haiku chapter splitting |

---

### Task 1: Extend ChapterInput in setup route to accept content

**Files:**
- Modify: `src/app/api/books/[bookId]/setup/route.ts:30-56, 236-253`

- [ ] **Step 1: Add MAX_CHAPTER_CONTENT constant and extend ChapterInput**

Open `src/app/api/books/[bookId]/setup/route.ts`. After line 13 (`const MAX_CHAPTERS = 30`), add:

```typescript
const MAX_CHAPTER_CONTENT = 100_000
```

Change the `ChapterInput` interface at line 30:

```typescript
interface ChapterInput {
  title: string
  brief: string
  content?: string | null
}
```

- [ ] **Step 2: Extract content in validateChapters**

In `validateChapters` (line 42), change the `out.push` call to include content:

```typescript
    out.push({
      title,
      brief: clampString(ch.brief, MAX_CHAPTER_BRIEF) ?? '',
      content: clampString((c as { content?: unknown }).content, MAX_CHAPTER_CONTENT) ?? null,
    })
```

- [ ] **Step 3: Write content into upsert rows**

In the upsert rows map (line 236), change the `content` line:

```typescript
      content:        ch.content ?? prev?.content ?? null,
```

(Was: `content: prev?.content ?? null`)

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "setup/route"
```

Expected: no errors on that file.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/books/[bookId]/setup/route.ts
git commit -m "feat(setup): accept optional chapter content for draft pre-fill"
```

---

### Task 2: Create split-chapters API route

**Files:**
- Create: `src/app/api/books/[bookId]/split-chapters/route.ts`

- [ ] **Step 1: Create the file with auth + rate limit skeleton**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiKey } from '@/lib/apiKeys'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { consumeRateLimit } from '@/lib/rateLimit'
import { generateText } from '@/lib/textGeneration'

const MAX_TEXT = 500_000  // ~100K words

export async function POST(
  req: NextRequest,
  { params }: { params: { bookId: string } },
) {
  let supabase = await createClient()
  let userId: string

  const authResult = await supabase.auth.getUser()
  if (authResult.data.user) {
    userId = authResult.data.user.id
  } else {
    const apiAuth = await validateApiKey(req)
    if (!apiAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = apiAuth.userId
    supabase = supabaseAdmin
  }

  const rl = await consumeRateLimit(supabase, {
    key: `split-chapters:${userId}`,
    max: 10,
    windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfter) },
    })
  }

  // Ownership check
  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('id', params.bookId)
    .eq('user_id', userId)
    .single()
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const text: string = typeof body.text === 'string' ? body.text.slice(0, MAX_TEXT) : ''
  const chapters: Array<{ title: string; brief: string }> = Array.isArray(body.chapters) ? body.chapters : []

  if (!text || chapters.length === 0) {
    return NextResponse.json({ error: 'text and chapters required' }, { status: 400 })
  }

  const contents = await splitChapters(text, chapters)

  return NextResponse.json({
    chapters: chapters.map((ch, i) => ({ ...ch, content: contents[i] ?? null })),
  })
}
```

- [ ] **Step 2: Add the regex splitter helper**

Add above the `POST` export:

```typescript
/** Attempts to locate chapter boundaries using regex patterns.
 *  Returns an array of per-chapter text strings (null = not found),
 *  or null if coverage is < 50% (caller should use Haiku fallback). */
function regexSplitChapters(
  text: string,
  chapters: Array<{ title: string }>,
): Array<string | null> | null {
  const positions: Array<{ idx: number; pos: number }> = []

  for (let i = 0; i < chapters.length; i++) {
    const escapedTitle = chapters[i].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const patterns = [
      new RegExp(escapedTitle, 'i'),
      new RegExp(`chapter\\s+${i + 1}\\b`, 'i'),
      new RegExp(`^\\s*${i + 1}[.)\\s]`, 'im'),
    ]
    for (const pattern of patterns) {
      const match = pattern.exec(text)
      if (match) {
        positions.push({ idx: i, pos: match.index })
        break
      }
    }
  }

  if (positions.length / chapters.length < 0.5) return null

  positions.sort((a, b) => a.pos - b.pos)

  const result: Array<string | null> = chapters.map(() => null)
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos
    const end = i + 1 < positions.length ? positions[i + 1].pos : text.length
    result[positions[i].idx] = text.slice(start, end).trim() || null
  }
  return result
}
```

- [ ] **Step 3: Add the Haiku anchor fallback**

Add below the regex helper:

```typescript
/** Haiku fallback: asks the model to return the first ~100 chars of each
 *  chapter's opening text, then we search those anchors in the original
 *  manuscript to find split positions. Keeps Haiku output small regardless
 *  of manuscript length. */
async function haikuAnchorSplit(
  text: string,
  chapters: Array<{ title: string }>,
): Promise<Array<string | null>> {
  const chapterList = chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')
  const raw = await generateText({
    systemPrompt: `You receive chapter titles and a manuscript. For each chapter, find where it begins. Return ONLY a JSON array: [{"title":"<exact title>","anchor":"<first 100 chars of that chapter's opening text, verbatim>"}]. Use null for anchor if the chapter cannot be located.`,
    userPrompt: `Chapters:\n${chapterList}\n\nManuscript:\n<manuscript>\n${text.slice(0, 200_000)}\n</manuscript>`,
    maxTokens: 2000,
    humanize: false,
    model: 'claude-haiku-4-5-20251001',
  })

  type Anchor = { title: string; anchor: string | null }
  let anchors: Anchor[] = []
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    anchors = match ? (JSON.parse(match[0]) as Anchor[]) : []
  } catch {
    return chapters.map(() => null)
  }

  // Find each anchor in the original text to get positions
  const positions: Array<{ idx: number; pos: number }> = []
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i].anchor
    if (!anchor) continue
    const pos = text.indexOf(anchor)
    if (pos !== -1) positions.push({ idx: i, pos })
  }

  positions.sort((a, b) => a.pos - b.pos)

  const result: Array<string | null> = chapters.map(() => null)
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos
    const end = i + 1 < positions.length ? positions[i + 1].pos : text.length
    result[positions[i].idx] = text.slice(start, end).trim() || null
  }
  return result
}
```

- [ ] **Step 4: Add the orchestrator**

Add below the Haiku helper:

```typescript
async function splitChapters(
  text: string,
  chapters: Array<{ title: string; brief: string }>,
): Promise<Array<string | null>> {
  const regexResult = regexSplitChapters(text, chapters)
  if (regexResult !== null) return regexResult
  return haikuAnchorSplit(text, chapters)
}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "split-chapters"
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/books/[bookId]/split-chapters/route.ts
git commit -m "feat(api): add split-chapters route — regex + haiku anchor fallback"
```

---

### Task 3: Create StepUploadContent component

**Files:**
- Create: `src/components/wizard/StepUploadContent.tsx`

- [ ] **Step 1: Create the component with paste phase**

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, ChevronRight, RotateCcw } from 'lucide-react'
import type { WizardData } from './WizardShell'

const MIN_CONTENT_LENGTH = 50

interface DetectedChapter {
  title: string
  brief: string
  content?: string | null
}

interface Props {
  data: WizardData
  bookId: string
  onNext: (patch: Partial<WizardData>) => void
}

type Phase = 'paste' | 'review'

export function StepUploadContent({ data, bookId, onNext }: Props) {
  const [text, setText] = useState(data.outline ?? '')
  const [phase, setPhase] = useState<Phase>(
    data.chapters.length > 0 ? 'review' : 'paste',
  )
  const [chapters, setChapters] = useState<DetectedChapter[]>(data.chapters)
  const [niche, setNiche] = useState(data.niche ?? '')
  const [detecting, setDetecting] = useState(false)
  const [importDrafts, setImportDrafts] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [detectError, setDetectError] = useState('')
  const [splitError, setSplitError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 480)}px`
  }, [text])

  async function detectChapters() {
    setDetecting(true)
    setDetectError('')
    try {
      const res = await fetch('/api/detect-chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outline: text, mode: 'upload' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Detection failed')
      if (!Array.isArray(json.chapters) || json.chapters.length === 0) {
        throw new Error('No chapters detected. Try adding chapter headings to your content.')
      }
      setChapters(json.chapters)
      setNiche(json.chapters[0]?.title ?? '')
      setPhase('review')
    } catch (e) {
      setDetectError(e instanceof Error ? e.message : 'Detection failed')
    } finally {
      setDetecting(false)
    }
  }

  async function handleImportToggle(checked: boolean) {
    setImportDrafts(checked)
    setSplitError('')

    if (!checked) {
      setChapters(ch => ch.map(({ content: _c, ...rest }) => rest))
      return
    }

    setSplitting(true)
    try {
      const res = await fetch(`/api/books/${bookId}/split-chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, chapters }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Split failed')
      setChapters(json.chapters)
    } catch (e) {
      setSplitError(
        e instanceof Error ? e.message : 'Draft import failed — you can continue without it',
      )
      setImportDrafts(false)
    } finally {
      setSplitting(false)
    }
  }

  function handleContinue() {
    onNext({ outline: text, chapters, niche: niche.trim() })
  }

  const canDetect = !detecting && text.trim().length >= MIN_CONTENT_LENGTH
  const canContinue = phase === 'review' && chapters.length > 0 && niche.trim().length >= 3

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Upload your content</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          Paste your manuscript, outline, or table of contents. AI will detect your chapters.
        </p>
      </div>

      {/* Paste phase */}
      {phase === 'paste' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-inter text-ink-1/50 mb-1.5">
              Your content
            </label>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste your table of contents, outline, or full manuscript…"
              className="w-full min-h-[220px] resize-none px-4 py-3 rounded-xl bg-white border border-cream-3 focus:outline-none focus:ring-2 focus:ring-gold/40 font-source-serif text-sm text-ink-1 placeholder:text-ink-1/30 transition-shadow"
              style={{ maxHeight: '480px' }}
            />
            <p className="text-xs text-ink-1/30 font-inter mt-1 text-right">
              {text.trim().length.toLocaleString()} chars
            </p>
          </div>

          {detectError && (
            <p className="text-sm text-red-500 font-inter">{detectError}</p>
          )}

          <button
            onClick={detectChapters}
            disabled={!canDetect}
            className="flex items-center gap-2 px-6 py-2.5 bg-gold hover:bg-gold-soft disabled:opacity-40 disabled:cursor-not-allowed text-ink-1 font-inter text-sm font-semibold rounded-lg transition-colors"
          >
            {detecting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Detecting chapters…</>
            ) : (
              <>Detect Chapters <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      )}

      {/* Review phase */}
      {phase === 'review' && (
        <div className="space-y-5">
          {/* Chapter list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-inter text-ink-1/50">
                {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} detected
              </label>
              <button
                onClick={() => { setPhase('paste'); setImportDrafts(false) }}
                className="flex items-center gap-1 text-xs font-inter text-gold hover:text-gold-soft transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Re-paste
              </button>
            </div>
            <div className="rounded-xl border border-cream-3 bg-white overflow-hidden">
              {chapters.map((ch, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-cream-3 last:border-0">
                  <span className="text-xs font-inter text-ink-1/30 mt-0.5 w-5 shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-inter text-ink-1 font-medium leading-snug">{ch.title}</p>
                    {ch.brief && (
                      <p className="text-xs font-source-serif text-ink-1/50 mt-0.5 line-clamp-2">{ch.brief}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Import drafts toggle */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-cream-2 border border-cream-3">
            <div className="relative mt-0.5">
              <input
                id="import-drafts"
                type="checkbox"
                checked={importDrafts}
                onChange={e => handleImportToggle(e.target.checked)}
                disabled={splitting}
                className="sr-only"
              />
              <button
                role="checkbox"
                aria-checked={importDrafts}
                onClick={() => !splitting && handleImportToggle(!importDrafts)}
                className={`w-10 h-5 rounded-full transition-colors ${importDrafts ? 'bg-gold' : 'bg-ink-1/20'}`}
              >
                <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${importDrafts ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <label htmlFor="import-drafts" className="text-sm font-inter text-ink-1 font-medium cursor-pointer">
                Import existing text as chapter drafts
              </label>
              <p className="text-xs font-source-serif text-ink-1/50 mt-0.5">
                AI will split your manuscript into per-chapter drafts you can edit in the writing stage.
              </p>
              {splitting && (
                <p className="flex items-center gap-1.5 text-xs font-inter text-gold mt-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Splitting chapters…
                </p>
              )}
              {splitError && (
                <p className="text-xs font-inter text-red-500 mt-1.5">{splitError}</p>
              )}
            </div>
          </div>

          {/* Niche input */}
          <div className="space-y-1">
            <label className="block text-xs font-inter text-ink-1/50">
              What&apos;s this book about? <span className="text-ink-1/30">(one line)</span>
            </label>
            <input
              type="text"
              value={niche}
              onChange={e => setNiche(e.target.value)}
              placeholder="e.g. Practical guide to youth football tryouts"
              className="w-full px-4 py-2.5 rounded-lg bg-white border border-cream-3 focus:outline-none focus:ring-2 focus:ring-gold/40 font-inter text-sm text-ink-1 placeholder:text-ink-1/30"
            />
          </div>

          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="flex items-center gap-2 px-6 py-2.5 bg-gold hover:bg-gold-soft disabled:opacity-40 disabled:cursor-not-allowed text-ink-1 font-inter text-sm font-semibold rounded-lg transition-colors"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "StepUploadContent"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/StepUploadContent.tsx
git commit -m "feat(wizard): add StepUploadContent component for upload mode"
```

---

### Task 4: Wire upload mode into WizardShell + fix NewBookButton

**Files:**
- Modify: `src/components/wizard/WizardShell.tsx:7-13, 51, 407`
- Modify: `src/components/dashboard/NewBookButton.tsx:46-51`

- [ ] **Step 1: Extend WizardData.chapters type**

In `src/components/wizard/WizardShell.tsx`, change line 51:

```typescript
  chapters: Array<{ title: string; brief: string; content?: string | null }>
```

(Was: `chapters: Array<{ title: string; brief: string }>`)

- [ ] **Step 2: Import StepUploadContent**

Add to the imports block at the top of `WizardShell.tsx` (after `Step1Radar` import on line 7):

```typescript
import { StepUploadContent } from './StepUploadContent'
```

- [ ] **Step 3: Update step-0 label for upload mode**

After line 40 in `WizardShell.tsx`, replace the `STEPS` constant usage in the step indicator. The array is `const STEPS = ['Radar', 'Persona', 'Details', 'Tone', 'Style', 'Typography']`. Add a computed label array in the component body, right after the `isEditing` line (line 136):

```typescript
  const stepLabels = mode === 'upload'
    ? ['Content', 'Persona', 'Details', 'Tone', 'Style', 'Typography']
    : STEPS
```

Then change exactly two lines inside the component JSX:

Line 347: `{STEPS[step]}` → `{stepLabels[step]}`
Line 351: `{STEPS.map((label, i) => {` → `{stepLabels.map((label, i) => {`

Leave `STEPS.length` references (lines 137, 184, 345) unchanged — the array length is the same for both modes.

- [ ] **Step 4: Conditional step-0 render**

At line 407 in `WizardShell.tsx`, change:

```typescript
              {step === 0 && <Step1Radar       data={data} onNext={next} mode={mode} />}
```

to:

```typescript
              {step === 0 && (mode === 'upload'
                ? <StepUploadContent data={data} bookId={bookId} onNext={next} />
                : <Step1Radar       data={data} onNext={next} mode={mode} />
              )}
```

- [ ] **Step 5: Fix NewBookButton — remove bail-out**

In `src/components/dashboard/NewBookButton.tsx`, replace lines 46–51:

```typescript
    if (mode === 'upload') {
      // Wired but not built — let users discover it without blocking, and
      // leave a console hint for whoever's wiring up the upload UI next.
      // eslint-disable-next-line no-console
      console.warn('Upload flow not yet built')
    }
```

Delete those lines entirely. The `pickMode` function becomes:

```typescript
  async function pickMode(mode: StartMode) {
    if (creating) return
    setCreating(mode)
    await createBook(mode)
    setCreating(null)
  }
```

- [ ] **Step 6: TypeScript check — full project**

```bash
npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 7: Confirm STEPS replacements**

```bash
grep -n "STEPS\[step\]\|STEPS\.map" src/components/wizard/WizardShell.tsx
```

Expected: 0 matches (both replaced by `stepLabels`).

- [ ] **Step 8: Commit**

```bash
git add src/components/wizard/WizardShell.tsx src/components/dashboard/NewBookButton.tsx
git commit -m "feat(wizard): wire upload mode — StepUploadContent at step 0, fix NewBookButton"
```

---

## Manual Smoke Test

After all tasks complete:

1. `npm run dev` — confirm no compile errors in terminal
2. Dashboard → "New Book" → "Upload Content" — confirm modal closes and wizard loads
3. Wizard step 0 should show "Upload your content" heading (not the radar UI)
4. Step indicator pill 1 should read "Content" (not "Radar")
5. Paste ≥ 50 chars → "Detect Chapters" enables → click → chapters appear
6. Toggle "Import existing text as chapter drafts" → observe loading state → chapters updated
7. Fill niche → "Continue" → lands on Step 1 (Persona)
8. Complete wizard → coauthor → OutlineStage shows detected chapters
9. If draft import was on: opening a chapter in ChapterStage should show pre-filled draft content
