-- welcome_resend_ids stored per-reader Resend message IDs for cancellation.
-- Resend removed; Inngest now handles sequence cancellation natively via
-- the app/lead.unsubscribed event. Column no longer written or read.
ALTER TABLE leads DROP COLUMN IF EXISTS welcome_resend_ids;
