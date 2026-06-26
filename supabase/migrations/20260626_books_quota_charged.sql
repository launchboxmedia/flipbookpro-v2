-- Track whether a book has consumed a monthly quota slot.
-- Deducted on first chapter approval, not at book creation or wizard completion.
ALTER TABLE books ADD COLUMN IF NOT EXISTS quota_charged boolean NOT NULL DEFAULT false;
