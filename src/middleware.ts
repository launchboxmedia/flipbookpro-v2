import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Vanity / funnel domains. Hitting `<host>/<slug>` rewrites to /go/<slug>
// so the marketing landing renders. /api, /_next, /read, and any other
// multi-segment path passes through unchanged so the same app serves
// from this host without modification.
const FUNNEL_HOSTS = new Set(['go.bookbuilderpro.app'])

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')?.toLowerCase() ?? ''

  // ── Funnel host handling ────────────────────────────────────────────────
  // Done BEFORE the supabase session refresh because none of the funnel
  // pages need auth — /go/* and /read/* are both public routes, and the
  // /api endpoints called from them do their own auth where needed.
  if (FUNNEL_HOSTS.has(hostname)) {
    const path = request.nextUrl.pathname

    // Bare funnel host → bounce to the main marketing site so the
    // domain isn't a dead end if someone types it without a slug.
    if (path === '/') {
      return NextResponse.redirect(new URL('https://bookbuilderpro.app', request.url))
    }

    // Only single-segment slug paths get rewritten. Multi-segment
    // routes (/read/<slug>, /api/leads, /_next/...) and anything with
    // a file extension (favicon.ico) pass through unchanged so the
    // app keeps working end-to-end on the funnel host.
    const segments = path.slice(1).split('/').filter(Boolean)
    const isSingleSegmentSlug =
      segments.length === 1 &&
      !path.startsWith('/_next') &&
      !path.startsWith('/api') &&
      !path.includes('.')

    if (isSingleSegmentSlug) {
      const url = request.nextUrl.clone()
      url.pathname = `/go/${segments[0]}`
      return NextResponse.rewrite(url)
    }

    return NextResponse.next({ request })
  }

  // ── Default flow on the canonical domain ───────────────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup')
  const isPublicRoute = request.nextUrl.pathname.startsWith('/read') ||
    request.nextUrl.pathname.startsWith('/auth/') ||
    request.nextUrl.pathname.startsWith('/reset-password') ||
    request.nextUrl.pathname.startsWith('/go/') ||
    request.nextUrl.pathname.startsWith('/challenge/') ||
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname === '/pricing'

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
