import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Signed access tokens for paid published books.
 *
 * After a successful Stripe checkout, /api/read/[slug]/grant verifies the
 * session, creates a lead, and sets an HttpOnly cookie containing a signed
 * token. The read page checks that cookie before showing the flipbook so
 * paid buyers don't have to re-pay on every visit.
 *
 * Per-slug cookies (name = `${COOKIE_PREFIX}${slug}`) so buying book A
 * doesn't grant access to book B. Slug values are URL-safe by definition
 * (a-z, 0-9, dashes), so they're also valid in cookie names.
 *
 * The signing secret comes from FLIPBOOKPRO_READ_ACCESS_SECRET in env.
 * In dev a hard-coded fallback is used so local testing works without
 * extra setup; production setups MUST set the env var (a console.error
 * fires if it's missing in production).
 */

const COOKIE_PREFIX = 'fbp_access_'
const TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

function readSecret(): string {
  const secret = process.env.FLIPBOOKPRO_READ_ACCESS_SECRET
  if (secret && secret.length >= 16) return secret
  if (process.env.NODE_ENV === 'production') {
    console.error('[readAccess] FLIPBOOKPRO_READ_ACCESS_SECRET is not set or too short — paid-book cookies are insecure!')
  }
  return 'dev-only-fbp-read-access-secret-change-in-prod'
}

export function cookieNameForSlug(slug: string): string {
  return `${COOKIE_PREFIX}${slug}`
}

export interface AccessClaims {
  slug: string
  email: string
  /** Epoch milliseconds when this token expires. */
  exp: number
}

/** Sign access claims into a token of the form `<base64url payload>.<base64url signature>`. */
export function signAccessToken(slug: string, email: string): string {
  const payload: AccessClaims = {
    slug,
    email: email.toLowerCase().trim(),
    exp: Date.now() + TTL_SECONDS * 1000,
  }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', readSecret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

/**
 * Verify a signed access token and return its claims if valid + matching the
 * expected slug + not expired. Returns null in every failure mode.
 */
export function verifyAccessToken(token: string | undefined, expectedSlug: string): AccessClaims | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot < 1) return null
  const data = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  const expectedSig = createHmac('sha256', readSecret()).update(data).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as AccessClaims
    if (payload.slug !== expectedSlug) return null
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export const ACCESS_COOKIE_TTL_SECONDS = TTL_SECONDS
