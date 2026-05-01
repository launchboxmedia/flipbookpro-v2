-- Framework data for acronym-driven books (e.g., the C.R.E.D.I.T. Cleanse).
-- Schema:
--   {
--     "acronym": "CREDIT",
--     "steps": [
--       { "letter": "C", "label": "Control Payment History", "chapter_index": 2 },
--       { "letter": "R", "label": "Reduce", "chapter_index": 3 },
--       …
--     ]
--   }
-- The chapter renderer overlays the matching letter on text pages whose
-- chapter_index appears in any step. NULL = book has no framework concept.
alter table public.books
  add column if not exists framework_data jsonb;
