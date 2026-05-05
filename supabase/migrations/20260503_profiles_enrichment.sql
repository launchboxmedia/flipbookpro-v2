-- Author profile enrichment fields. Populated by /api/profile/enrich, which
-- crawls the user's website with Firecrawl, extracts brand information with
-- Claude Sonnet, and writes the structured result back here. All fields are
-- nullable so legacy profiles continue to work and the user can hand-edit
-- any subset on the brand settings panel.
--
-- Naming notes:
-- - display_name vs profiles.full_name: full_name is the auth-side identity;
--   display_name is the brand-facing name (often a pen name or company).
-- - primary_color / background_color sit alongside the existing brand_color
--   + accent_color so the enrichment can write all four without overwriting
--   manual brand customisations the user already set.

alter table profiles
  add column if not exists display_name         text,
  add column if not exists brand_name           text,
  add column if not exists brand_tagline        text,
  add column if not exists cta_url              text,
  add column if not exists cta_text             text,
  add column if not exists primary_color        text,
  add column if not exists background_color     text,
  add column if not exists expertise            text[],
  add column if not exists audience_description text,
  add column if not exists offer_types          text[],
  add column if not exists website_url          text,
  add column if not exists enrich_ran_at        timestamptz;
