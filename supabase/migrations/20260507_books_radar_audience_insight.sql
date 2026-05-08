-- Surface field for the radar's audienceInsights.biggestPain text.
-- Previously the apply-radar route auto-wrote this string into
-- books.target_audience, which corrupted the field for authors whose
-- business audience differs from their book audience (e.g. a funding-
-- broker training book where the author's existing business serves
-- "business owners seeking funding"). target_audience is now reserved
-- for the user's deliberate input; this column holds the radar's
-- inferred reader-pain string for display purposes only.

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS radar_audience_insight text;
