-- Adds the optional back-cover image used by FlipbookViewer.BackCoverPage and
-- the PDF export route. Uploaded via /api/books/[id]/upload-back-cover.
alter table public.books
  add column if not exists back_cover_image_url text;
