-- Add critique persistence columns to book_pages table
-- critique_flags: stores the last set of flags returned by critique route
-- dismissed_flag_ids: array of flag IDs the author has dismissed

ALTER TABLE book_pages
ADD COLUMN IF NOT EXISTS critique_flags jsonb,
ADD COLUMN IF NOT EXISTS dismissed_flag_ids text[];

COMMENT ON COLUMN book_pages.critique_flags IS 'Last critique flags returned by the AI, stored as JSON array for persistence across sessions';
COMMENT ON COLUMN book_pages.dismissed_flag_ids IS 'Array of flag IDs that the author has explicitly dismissed';
