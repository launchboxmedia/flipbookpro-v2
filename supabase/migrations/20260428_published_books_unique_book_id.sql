-- Fix 5 — E2E test bug found.
--
-- The publish route's upsert uses
--   .upsert({ ... book_id: bookId ... }, { onConflict: 'book_id' })
-- to keep "one published_books row per source book" — re-publishing the
-- same book replaces the existing row instead of creating a duplicate.
-- That conflict target requires a unique constraint or unique index on
-- book_id; only a non-unique index existed, so PostgREST returned 500
-- with "no unique or exclusion constraint matching the ON CONFLICT
-- specification."
--
-- Adding the unique index makes the upsert pattern work, AND it enforces
-- the "one published row per book" invariant at the database level (no
-- accidental double-rows from a race).
create unique index if not exists published_books_book_id_key
  on public.published_books(book_id);
