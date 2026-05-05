-- Per-chapter research grounding. Populated by /api/books/[bookId]/research-chapter
-- (Perplexity Sonar query) and consumed by generate-draft, which injects
-- the verified facts + sources into the writing prompt so chapters land on
-- real 2025-2026 data instead of model-internal generalities.
--
-- research_facts: newline-delimited list of fact strings.
-- research_citations: jsonb array of { title, url } objects. jsonb so we
--   can index/query later if we add a "view sources" UI on the published
--   page, and so it's queryable without parsing on the server.

alter table book_pages
  add column if not exists research_facts     text,
  add column if not exists research_citations jsonb;
