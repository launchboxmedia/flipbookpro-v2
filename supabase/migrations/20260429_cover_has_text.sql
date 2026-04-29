-- When the user uploads a cover image that already has the title/subtitle/
-- author baked in, the overlay text + dark gradients in the renderer become
-- redundant noise on top of the artwork. cover_has_text=true tells every
-- cover renderer (flipbook viewer, HTML export, PDF export, public read
-- page) to show only the image and skip the overlay.
alter table public.books
  add column if not exists cover_has_text boolean not null default false;
