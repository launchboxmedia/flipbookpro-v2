# Upload Existing Content Path — Design Spec

**Date:** 2026-06-25

---

## Goal

Let authors who already have a manuscript, outline, or table of contents skip topic discovery and import their content directly into the coauthor flow. Paste path only; PDF deferred.

---

## Entry Point

`NewBookButton` shows two modes: "Build from scratch" and "Upload existing content." The upload button currently bails with `console.warn`. Fix: call `createBook('upload')` — same server action, same redirect to `/book/[id]/wizard?mode=upload`. No server-action changes needed.

---

## Wizard Routing

`WizardShell` step 0 conditionally renders based on `mode`:

```tsx
{step === 0 && (mode === 'upload'
  ? <StepUploadContent data={data} onNext={next} />
  : <Step1Radar data={data} onNext={next} mode={mode} />
)}
```

Steps 1–5 (Step2Persona → Step2Meta → Step4ToneReader → Step5StyleCover → Step6Typography) are unchanged for both modes.

---

## StepUploadContent Component

New file: `src/components/wizard/StepUploadContent.tsx`

Three phases within a single step:

### Phase 1 — Paste
- Auto-resize textarea, placeholder: "Paste your table of contents, outline, or full manuscript…"
- Character counter visible below textarea
- "Detect Chapters" button enabled when input ≥ 50 chars (matches existing `MIN_OUTLINE_LENGTH` in detect-chapters)
- Calls `POST /api/detect-chapters` with `{ outline: text, mode: 'upload' }`
- Loading state on button during API call; error message on failure

### Phase 2 — Review
- Detected chapters rendered as a numbered list (title + brief per chapter)
- "Re-detect" link lets user edit paste and re-run
- Toggle: **"Import existing text as chapter drafts"** — default off
  - When turned on: calls `POST /api/books/[bookId]/split-chapters` with `{ text, chapters }`
  - Loading indicator during split; surfaces error if split fails (user can proceed without drafts)

### Phase 3 — Niche
- Single-line text input: "What's this book about?"
- Auto-populated with title of first detected chapter as default; user can edit
- Continue button enabled when chapters detected + niche input non-empty (≥ 3 chars)
- On continue: sets `data.outline` (raw paste text), `data.chapters` (detected), `data.niche`, and optionally merges draft content onto `data.chapters`

---

## API: `/api/books/[bookId]/split-chapters` (new)

`POST` — auth-gated (same pattern as other book routes).

**Request body:**
```ts
{ text: string; chapters: { title: string; brief: string }[] }
```

**Logic:**
1. **Regex split** — for each chapter title, search `text` case-insensitively. Also try common heading patterns (`Chapter N`, `CHAPTER N`, numeric prefixes like `1.`, `1)`). Build an array of `{ index, position }` matches sorted by position. Slice text between consecutive positions to get per-chapter content.
2. **Coverage check** — if regex finds boundaries for ≥ 50% of chapters, use regex result (unmatched chapters get `content: null`).
3. **Haiku fallback** — if regex coverage < 50%, send full text + chapter titles to Claude Haiku with instruction to return `{ title, content }[]`. Parse JSON response.

**Response:**
```ts
{ chapters: { title: string; brief: string; content: string | null }[] }
```

Rate limit: 10 calls/user/hour (cheap but not free due to Haiku fallback).

---

## API: `/api/detect-chapters` — no changes

Already handles `mode: 'upload'` with `buildUploadPrompt`. Used as-is.

---

## Setup Route Changes

**`ChapterInput` type** — add optional field:
```ts
content?: string | null
```

**Upsert row construction** — one-line change:
```ts
content: ch.content ?? prev?.content ?? null,
```

Preserves existing content on re-setup (reorder, title edit) while allowing upload drafts to seed new chapters.

---

## WizardData Type Changes

Add to wizard data shape (in `WizardShell.tsx` or its types):
```ts
// chapters array already exists; content field added to each entry
// No separate chapterDrafts map needed — content lives on the chapter objects
```

`data.chapters` items get an optional `content?: string | null` field. `StepUploadContent` merges split results onto the chapters array before calling `onNext`. Step6Typography's setup call already serialises `data.chapters` — no further changes needed there.

---

## Visual Design

Follows cream wizard aesthetic (cream-1 card, ink-1 text, gold accents, font-inter labels, font-source-serif textarea). Textarea minimum height: `min-h-[220px]`, auto-grows to `max-h-[480px]`. Chapter list uses same styling as existing outline chapter rows. Toggle uses existing checkbox/switch pattern in codebase.

---

## Out of Scope

- PDF upload (deferred)
- Editing detected chapters before continuing (handled post-wizard in OutlineStage)
- AI-powered niche extraction from manuscript (simple user text input is sufficient)
