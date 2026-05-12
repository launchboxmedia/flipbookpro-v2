-- Persist the Haiku-generated scene description that drives each chapter
-- image. Without this, a "wrong" image leaves the author no way to see
-- WHAT Haiku decided to draw — only the rendered jpg survives, so they
-- can't tell whether to regenerate (different scene) or override with a
-- custom prompt. Storing the scene unlocks the regen-with-context flow.
--
-- Filled by /api/books/[bookId]/generate-chapter-image after every Haiku
-- call. NULL on legacy rows until the chapter is next regenerated.

alter table public.book_pages
  add column if not exists image_scene text;
