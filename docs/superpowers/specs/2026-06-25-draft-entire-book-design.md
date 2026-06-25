# Draft Entire Book — Design Spec

**Date:** 2026-06-25

## Goal

Add a single "Draft Entire Book" button to the Outline stage that generates drafts, illustrations, and approvals for every chapter in one sequential pass — so a user can go from outline to fully-drafted book without touching each chapter individually.

## Scope

In scope:
- Confirmation modal before starting
- Sequential client-side loop: draft → image → approve → critique (fire-and-forget) per chapter
- Progress overlay on OutlineStage
- Cancellation mid-run
- Image-failure tracking surfaced in completion toast
- Navigation to Book Design on completion

Out of scope (fast-follow):
- Surfaced critique flag count ("14 suggestions across 5 chapters") on Book Design or Outline — fire-and-forget critique means "optional review" is reactive discovery right now. A count surface needs to be built separately before the lead-magnet claim "flagged for review" is fully true.

---

## Entry Point

Button below the chapter list in OutlineStage: **"Draft Entire Book"**

Visible whenever chapters exist. Skips chapters that already have an approved draft, so the button is safe to run on a partially-complete book.

---

## Confirmation Modal

Small inline modal (not full-screen):

> **Draft Entire Book**
> This will write, illustrate, and approve all X unapproved chapters in one pass. You can edit any chapter after.
>
> [Cancel] [Draft Everything →]

---

## The Loop

Runs client-side, sequentially. For each unapproved chapter (in chapter_index order):

1. **Generate draft** — POST/SSE to `/api/books/[bookId]/generate-draft` with `{ chapterIndex }`. Drain stream, accumulate full text. Save to `book_pages.content` via Supabase client (same `onPageUpdate` pattern as CoauthorShell).
2. **Generate image** — POST to `/api/books/[bookId]/generate-chapter-image`. Await response. On failure: add chapter to `failedImageChapters[]`, continue loop. Do not stop.
3. **Approve** — POST to `/api/books/[bookId]/approve-chapter`. On failure: stop loop, show error with chapter name.
4. **Fire critique** — POST to `/api/books/[bookId]/critique-chapter`. Do not await. Flags land in DB; user sees them when they visit each chapter. No blocking.

---

## Progress UI

Inline overlay on OutlineStage (not a modal). Sits over the action area; chapter list still visible underneath.

```
Drafting your book...

Chapter 3 of 8
[████████░░░░░░░░░░░░]  37%

Writing "The Core Framework"...
```

Status messages per step:
- "Writing draft..."
- "Generating illustration..."
- "Approving..."

Cancel button always visible. Cancelling mid-run leaves completed chapters approved; remaining chapters untouched.

---

## Error Handling

| Failure | Behavior |
|---------|----------|
| Draft fails | Stop loop. Show: "Draft failed on '[Chapter Title]'. Fix it manually or skip and continue." Offer Skip or Stop. |
| Image fails | Add to `failedImageChapters[]`. Continue loop silently. |
| Approve fails | Stop loop. Show: "Could not approve '[Chapter Title]'. Try again." |
| Critique fails | Ignore. Fire-and-forget; failure has no visible consequence. |

---

## Completion

Navigate to **Book Design stage**.

Toast (no image failures):
> "All X chapters drafted. Critique flags are loading — visit each chapter to review suggestions."

Toast (with image failures):
> "All X chapters drafted — images failed for: Chapter 3, Chapter 7. Regenerate them from each chapter."

Note: "visit each chapter to review suggestions" is honest reactive discovery. The critique fire-and-forget does not surface a count or indicator on any screen yet. A flag count surface ("14 suggestions across 5 chapters") is a fast-follow — do not claim "flagged for review" in marketing copy until that is built.

---

## New Code

| Unit | Purpose |
|------|---------|
| Confirmation modal (inline in OutlineStage) | One-time consent before the run |
| `useDraftAll` hook | Owns loop state, progress, cancellation, failed-image tracking |
| Progress overlay component | Shows chapter N of M, step label, progress bar, cancel button |
| Updates to OutlineStage | Wire button + modal + hook + overlay |

Nothing new server-side. All existing endpoints reused.

---

## Fast-Follow (not in this spec)

Once all critique calls resolve, surface a count on Book Design or Outline: "14 suggestions across 5 chapters — review before publishing." This is what makes "auto-approved, flagged for optional review" a real promise rather than a hope.
