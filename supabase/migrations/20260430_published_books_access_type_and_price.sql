-- Paid access feature: published_books gains access_type ('free'|'email'|'paid')
-- and price_cents NOT NULL with default 0. The existing gate_type column stays
-- around for backward compatibility — the publish API writes both fields,
-- derived from each other, so consumers reading either name see consistent
-- values. New code should prefer access_type.

alter table public.published_books
  add column if not exists access_type text;

-- Backfill access_type from the existing gate_type values:
--   none    → free
--   payment → paid
--   email   → email
update public.published_books
   set access_type = case
     when gate_type = 'none'    then 'free'
     when gate_type = 'payment' then 'paid'
     else                            'email'
   end
 where access_type is null;

alter table public.published_books alter column access_type set default 'email';
alter table public.published_books alter column access_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'published_books_access_type_check'
  ) then
    alter table public.published_books
      add constraint published_books_access_type_check
        check (access_type in ('free', 'email', 'paid'));
  end if;
end$$;

-- price_cents was nullable with no default. Force a sensible default so paid
-- rows can never accidentally publish at $0, and so non-paid rows have a
-- consistent zero rather than null.
update public.published_books set price_cents = 0 where price_cents is null;
alter table public.published_books alter column price_cents set default 0;
alter table public.published_books alter column price_cents set not null;
