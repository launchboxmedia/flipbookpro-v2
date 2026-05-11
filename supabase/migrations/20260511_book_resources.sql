-- Book Resources — per-chapter downloadable artifacts (checklists, templates,
-- scripts, matrices, workflows, swipe files) that the chapter draft
-- references via [[RESOURCE: Name | type]] markers. Generated on demand
-- via /api/books/[bookId]/generate-resource and surfaced in the chapter
-- writing surface, the public flipbook, and the PDF export appendix.

create table if not exists public.book_resources (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books(id) on delete cascade,
  chapter_index int  not null,
  resource_name text not null,
  resource_type text not null check (
    resource_type in ('checklist', 'template', 'script', 'matrix', 'workflow', 'swipe-file')
  ),
  content       text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_book_resources_book_chapter
  on public.book_resources (book_id, chapter_index);

-- Required for the upsert in /api/books/[bookId]/generate-resource:
--   .upsert(row, { onConflict: 'book_id,chapter_index,resource_name' })
-- onConflict needs a unique index spanning exactly these columns so
-- regenerating a resource overwrites the existing row instead of stacking
-- duplicates.
create unique index if not exists book_resources_book_chapter_name_key
  on public.book_resources (book_id, chapter_index, resource_name);

alter table public.book_resources enable row level security;

-- Owner policy — users can manage resources for books they own. The project
-- convention is `(select auth.uid())` (per-query) instead of bare auth.uid()
-- which evaluates per-row and is materially slower on large tables.
drop policy if exists "book_resources_owner_all" on public.book_resources;
create policy "book_resources_owner_all"
  on public.book_resources
  for all
  to authenticated
  using (
    book_id in (select id from public.books where user_id = (select auth.uid()))
  )
  with check (
    book_id in (select id from public.books where user_id = (select auth.uid()))
  );

-- Public read for resources attached to a currently-published, active book.
-- Required for the public /read/[slug] page to surface downloadable
-- resources to readers (free, email-gated, or paid) without requiring the
-- reader to sign in. Owner-only access on draft books is preserved because
-- this policy only matches when published_books.is_active = true.
drop policy if exists "book_resources_public_published" on public.book_resources;
create policy "book_resources_public_published"
  on public.book_resources
  for select
  to anon, authenticated
  using (
    book_id in (
      select book_id from public.published_books where is_active = true
    )
  );
