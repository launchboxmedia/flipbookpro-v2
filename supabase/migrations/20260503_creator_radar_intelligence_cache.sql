-- Caches Creator Radar synthesis results across users so the same
-- (persona, title, website, genre, audience) combo only burns Perplexity +
-- Sonnet credits once per TTL. The cache_key is a sha256 hash built by
-- the API route from those fields.
--
-- No RLS — the table is read/written exclusively by server-side routes
-- using the service role; never queried from the browser.

CREATE TABLE IF NOT EXISTS public.intelligence_cache (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key  text UNIQUE NOT NULL,
  persona    text NOT NULL,
  result     jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intelligence_cache_expires_at_idx
  ON public.intelligence_cache (expires_at);
