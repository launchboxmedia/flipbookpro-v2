import * as Sentry from '@sentry/nextjs'

// Next.js instrumentation hook. In @sentry/nextjs v8+ the standalone
// sentry.server.config / sentry.edge.config files are no longer
// auto-loaded — they must be pulled in here, gated by runtime, or the
// server/edge SDK never initializes.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Captures errors thrown in nested React Server Components so they reach
// Sentry instead of being swallowed by the App Router boundary.
export const onRequestError = Sentry.captureRequestError
