-- Stores the user-plan-filtered Creator Radar result snapshot on the book
-- itself so the panel hydrates instantly on outline-stage load without a
-- second roundtrip. The cross-user `intelligence_cache` table holds the
-- unfiltered raw result; this column holds what the user is actually
-- entitled to see at the time the radar was last run.
--
-- target_audience, website_url, genre are inputs the radar reads to build
-- its Perplexity query. They are nullable because old books predate the
-- radar — the API treats missing values as "not specified" and still
-- produces useful results for at least the (title, persona) pair.

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS creator_radar_data    jsonb,
  ADD COLUMN IF NOT EXISTS creator_radar_ran_at  timestamptz,
  ADD COLUMN IF NOT EXISTS target_audience       text,
  ADD COLUMN IF NOT EXISTS website_url           text,
  ADD COLUMN IF NOT EXISTS genre                 text;
