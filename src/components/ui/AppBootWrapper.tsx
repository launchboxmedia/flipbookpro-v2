'use client'

import { useEffect, useState } from 'react'
import { SplashScreen } from './SplashScreen'

const SESSION_KEY = 'app_booted'

interface Props {
  children: React.ReactNode
}

/** Renders the splash overlay on first visit per session, then renders the
 *  app underneath. Children mount immediately on every render so background
 *  data fetching starts in parallel with the splash animation — the splash
 *  is purely visual chrome, not a gate on the app's readiness.
 *
 *  Hydration note: the splash decision can only be made on the client
 *  (sessionStorage is browser-only). We start with `decided=false` so SSR
 *  and first client render match (no splash), then flip the flag in an
 *  effect. Worst case the user sees a single frame of the app before the
 *  splash overlays it — which is fine because the splash is `fixed inset-0`
 *  and covers everything behind it. */
export function AppBootWrapper({ children }: Props) {
  const [decided, setDecided] = useState(false)
  const [showSplash, setShowSplash] = useState(false)

  useEffect(() => {
    let booted = false
    try {
      booted = typeof window !== 'undefined' && !!window.sessionStorage?.getItem(SESSION_KEY)
    } catch {
      // sessionStorage can throw in some embedded/sandboxed contexts.
      // Failing safe = skip the splash so the user isn't stuck on it.
      booted = true
    }
    if (!booted) setShowSplash(true)
    setDecided(true)
  }, [])

  function handleComplete() {
    try {
      window.sessionStorage?.setItem(SESSION_KEY, '1')
    } catch {
      // ignore — the splash already played
    }
    setShowSplash(false)
  }

  return (
    <>
      {children}
      {decided && showSplash && <SplashScreen onComplete={handleComplete} />}
    </>
  )
}
