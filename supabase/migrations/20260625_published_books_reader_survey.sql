ALTER TABLE published_books
  ADD COLUMN IF NOT EXISTS survey_enabled  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS survey_question text,
  ADD COLUMN IF NOT EXISTS survey_options  jsonb;
