import { createClient } from '@supabase/supabase-js'

// Service-role Supabase client. Bypasses RLS — SERVER ONLY.
//
// Anonymous contexts (lead capture, unsubscribe, grant-email) can't use a
// normal anon client for owner-only tables (profiles, email_sequences).
// This client is the deliberate, narrow exception for those server routes.
//
// NEVER import this from a client component or any code that ships to the
// browser — it would leak the service-role key.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    'SUPABASE_SERVICE_ROLE_KEY not set — email sequences disabled',
  )
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)
