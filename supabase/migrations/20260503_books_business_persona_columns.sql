-- Adds three optional fields collected on the wizard's Audience step for the
-- `business` persona. They feed two prompts:
--   1. Creator Radar synthesis — sharper positioning + monetization advice
--      when the model knows what the author actually sells.
--   2. Chapter draft generation — lets business chapters land with a
--      persona-appropriate close (CTA, testimonial weave) instead of generic
--      "consider booking a call" filler.
--
-- All three are nullable. Older books and non-business personas leave them
-- empty; both prompts skip the section when the value is null/empty.

alter table books
  add column if not exists offer_type   text,
  add column if not exists cta_intent   text,
  add column if not exists testimonials text;
