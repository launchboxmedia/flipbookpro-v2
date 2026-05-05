-- Pull quote per chapter — a single sentence the editorial pass extracts on
-- chapter approval. Surfaced in the flipbook viewer as a centred italic spread
-- whenever a chapter ends on the LEFT page (the right side would otherwise be
-- blank), and in PDF/HTML exports inline after the chapter body.
--
-- Nullable: extraction is fire-and-forget and may fail silently. The viewer
-- and exporter both treat NULL as "render nothing / render rules only".

alter table book_pages
  add column if not exists pull_quote text;
