import { createClient } from '@supabase/supabase-js'

// Service-role Supabase client. Bypasses RLS — SERVER ONLY.
//
// The welcome-sequence flow runs from anonymous, public contexts (the
// lead-capture route has no reader session; the unsubscribe link is
// unauthenticated). email_sequences / profiles are owner-only under RLS,
// so a normal anon client silently returns zero rows and the sequence
// never sends. This client is the deliberate, narrow exception.
//
// NEVER import this from a client component or any code that ships to the
// browser — it would leak the service-role key. Only:
//   - src/lib/emailSequence.ts
//   - src/app/api/unsubscribe/route.ts
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
