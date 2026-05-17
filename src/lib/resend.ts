import { Resend } from 'resend'

// Single Resend client. RESEND_API_KEY is server-only. When it's the
// placeholder (or unset) the Resend SDK constructs fine but any send/cancel
// call returns an error — callers treat email scheduling as fire-and-forget
// and log failures, so an unconfigured key never breaks lead capture.
export const resend = new Resend(process.env.RESEND_API_KEY)

export const isResendConfigured = (): boolean => {
  const k = process.env.RESEND_API_KEY
  return !!k && !k.includes('placeholder')
}
