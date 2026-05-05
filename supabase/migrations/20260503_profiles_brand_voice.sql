-- Adds Brand Voice fields to profiles. These are author-level voice
-- preferences (tone, stylistic rules, things to avoid, and a one-line
-- example) that, when present, are injected into the generate-draft
-- system prompt so chapters are written in the author's voice instead
-- of a generic Sonnet voice.
--
-- All four columns are nullable text — Brand Voice is optional, and an
-- empty profile must continue to work exactly as it does today.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_voice_tone    text,
  ADD COLUMN IF NOT EXISTS brand_voice_style   text,
  ADD COLUMN IF NOT EXISTS brand_voice_avoid   text,
  ADD COLUMN IF NOT EXISTS brand_voice_example text;
