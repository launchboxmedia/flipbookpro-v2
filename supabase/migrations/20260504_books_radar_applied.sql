-- Apply-Radar feature. Stores the distilled radar intelligence that gets
-- injected into chapter generation prompts (generate-draft pulls from
-- books.radar_context when present), plus a timestamp so the UI can show
-- "Applied X days ago" and offer a re-apply affordance.
--
-- radar_context is jsonb with the shape declared in the RadarContext type
-- (src/types/database.ts): audience_pain, already_tried[], willing_to_pay,
-- where_they_gather[], positioning, suggested_hook, content_gaps[],
-- monetization, monetization_reason, reader_language[].
--
-- Distinct from books.creator_radar_data, which holds the full radar
-- result. Apply-Radar derives this smaller distilled context from that
-- larger blob so the prompt injection stays focused.

alter table books
  add column if not exists radar_applied_at timestamptz,
  add column if not exists radar_context    jsonb;
