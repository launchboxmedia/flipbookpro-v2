-- One-sentence description of what the business-owner author actually
-- sells, captured in the wizard's Step 2 (Persona) right after the
-- offer-type pill picker. Drives a per-book Creator Radar pass that's
-- sharper than the radar would be from offer_type alone, and surfaces
-- in chapter-generation prompts so drafts position around the offer
-- without making the user repeat themselves.
--
-- Distinct from offer_type (which is a category — Coaching / Course /
-- Service / Product / Consulting / Other) and from cta_intent (which
-- is the action the author wants readers to take after finishing).

alter table public.books
  add column if not exists offer_description text;
