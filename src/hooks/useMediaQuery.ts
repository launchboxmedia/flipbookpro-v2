'use client'

import { useEffect, useState } from 'react'

/** Subscribe to a CSS media query and re-render on changes.
 *
 *  Returns `false` during SSR and on the first client paint to avoid
 *  hydration mismatches; the post-mount effect updates to the real value
 *  on the next tick. Layout that depends on this should be designed for
 *  the desktop case to render first, with mobile-only chrome (drawer,
 *  hamburger) flipping in on hydration.
 *
 *  Example:
 *    const isMobile = useMediaQuery('(max-width: 1023px)')
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    // addEventListener is the modern API; older Safari only had
    // addListener. matchMedia.addEventListener has been supported
    // everywhere FlipBookPro targets, so no fallback needed.
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
