-- Fix 5 — E2E test bug found.
--
-- The setup route's batch upsert uses
--   .upsert(rows, { onConflict: 'book_id,chapter_index' })
-- which requires a unique constraint or unique index on (book_id, chapter_index).
-- That constraint never existed, so every Create Book POST returned 500.
-- The original per-row upsert had the same bug — it just failed silently as
-- "do nothing" inserts.
--
-- This index makes the upsert pattern work correctly. It also catches any
-- accidental double-write of the same chapter_index for one book.
create unique index if not exists book_pages_book_id_chapter_index_key
  on public.book_pages(book_id, chapter_index);
