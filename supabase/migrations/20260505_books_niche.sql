-- Adds books.niche — the topic string the user types into Step 1 of the
-- wizard. Persisted so the per-book Creator Radar route can include it in
-- its intelligence_cache key. Without this, every new book on the
-- restructured wizard hashed to the same key (title/audience/website/genre
-- are all empty at fireDeepRadar time on the new flow), causing the
-- interstitial to render the same cached result for every book.
--
-- Free-form text, capped to 200 chars in the wizard-progress route.

alter table public.books
  add column if not exists niche text;
