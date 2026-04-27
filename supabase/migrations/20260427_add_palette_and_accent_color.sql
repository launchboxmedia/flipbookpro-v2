-- Adds palette selection to books and accent_color to profiles.
-- palette values: 'teal-cream' | 'navy-gold' | 'burgundy-sand' | 'slate-copper'
--                 | 'forest-amber' | 'charcoal-rose' | 'brand'
--
-- Run this in the Supabase SQL editor (or via `supabase db push` if you've
-- linked the CLI to this project).

alter table public.books
  add column if not exists palette text;

alter table public.profiles
  add column if not exists accent_color text;
