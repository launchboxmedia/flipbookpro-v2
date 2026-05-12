import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// This route handles BOTH supabase email-link flows so the password-reset
// link works regardless of how the Supabase project is configured:
//   - PKCE flow:  ?code=…  (newer Supabase default)
//   - OTP flow:   ?token_hash=…&type=…  (legacy / older templates)
// The code branch runs first because it's the modern default; token_hash
// is the fallback. Either flow ends at /reset-password/confirm for
// type === 'recovery', or at ?next (default /dashboard) otherwise.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null
  const next       = searchParams.get('next') ?? '/dashboard'

  // PKCE flow — Supabase appends ?code=… after its /auth/v1/verify
  // endpoint exchanges the email token. exchangeCodeForSession trades
  // that code for a real session cookie.
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password/confirm', origin))
      }
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  // OTP fallback — older Supabase templates send ?token_hash=…&type=….
  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      // For password recovery, redirect to reset-password page instead of dashboard
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password/confirm`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
}
