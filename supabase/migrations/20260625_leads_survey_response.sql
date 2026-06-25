ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS survey_response text;
