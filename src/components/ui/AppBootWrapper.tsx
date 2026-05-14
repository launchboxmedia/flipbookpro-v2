'use client'

import { useEffect, useRef, useState } from 'react'
import { SplashScreen } from './SplashScreen'

const SESSION_KEY = 'app_booted'
/** Set by the dev-only Reset Splash button so the next mount bypasses the
 *  load-time race and always shows the splash. Cleared as soon as it's
 *  observed so subsequent navigations in the same session behave normally. */
const FORCE_KEY = 'force_splash'

/** Time to wait for the page to finish loading before we give up and show
 *  the splash. A fast app should be interactive well under this; if we're
 *  still waiting after this threshold, the splash earns its place by
 *  covering a real wait. */
const SPLASH_THRESHOLD_MS = 800

interface Props {
  children: React.ReactNode
}

type Phase = 'deciding' | 'splash' | 'booted'

/** Conditional splash gate. On mount, races a `SPLASH_THRESHOLD_MS` timer
 *  against the page's `load` event:
 *
 *    - load fires first → app was ready quickly, skip the splash entirely
 *    - threshold fires first → still loading, mount the splash overlay
 *
 *  Once the splash mounts it always runs to completion (the spec is firm
 *  on that — half-played animations feel broken).
 *
 *  The sessionStorage flag short-circuits the race on any subsequent
 *  mount in the same session: if we already showed (or skipped past) the
 *  splash once, we don't reconsider on the next navigation.
 *
 *  Hydration note: SSR renders no splash. The first client render also
 *  renders no splash because `phase` defaults to `'deciding'`. No mismatch. */
export function AppBootWrapper({ children }: Props) {
  const [phase, setPhase] = useState<Phase>('deciding')
  const decidedRef = useRef(false)

  useEffect(() => {
    // Dev-only override — the Reset Splash button sets force_splash so the
    // splash is testable on a warm dev server where the fast-load path
    // would otherwise skip it. Read-and-clear so it only takes effect on
    // the mount immediately following the button click.
    let forced = false
    try {
      if (window.sessionStorage?.getItem(FORCE_KEY)) {
        forced = true
        window.sessionStorage.removeItem(FORCE_KEY)
      }
    } catch {
      // sessionStorage unavailable — fall through to normal path
    }
    if (forced) {
      decidedRef.current = true
      setPhase('splash')
      return
    }

    // sessionStorage gate — already booted this session, never show again.
    let alreadyBooted = false
    try {
      alreadyBooted = !!window.sessionStorage?.getItem(SESSION_KEY)
    } catch {
      // Failing safe in sandboxed contexts where storage throws: act as
      // if we've already booted so the user is never stuck on a splash.
      alreadyBooted = true
    }
    if (alreadyBooted) {
      setPhase('booted')
      return
    }

    // If the document already finished loading before this effect ran,
    // there's no wait to cover — skip the splash and mark booted. Done
    // before any timer/listener is set up, so there's nothing to clean
    // up and no temporal-dead-zone trap.
    if (document.readyState === 'complete') {
      decidedRef.current = true
      markBooted()
      setPhase('booted')
      return
    }

    // Race the threshold timer against the page's load event. Whoever
    // fires first wins; the loser is cancelled via `decide`'s idempotent
    // guard and the cleanup function on unmount.
    let timer: number | undefined
    function onLoad() { decide('skip') }
    function decide(outcome: 'skip' | 'show') {
      if (decidedRef.current) return
      decidedRef.current = true
      if (timer !== undefined) window.clearTimeout(timer)
      window.removeEventListener('load', onLoad)
      if (outcome === 'show') {
        setPhase('splash')
      } else {
        markBooted()
        setPhase('booted')
      }
    }
    timer = window.setTimeout(() => decide('show'), SPLASH_THRESHOLD_MS)
    window.addEventListener('load', onLoad, { once: true })

    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      window.removeEventListener('load', onLoad)
    }
  }, [])

  function handleComplete() {
    markBooted()
    setPhase('booted')
  }

  return (
    <>
      {children}
      {phase === 'splash' && <SplashScreen onComplete={handleComplete} />}
      <ResetSplashButton />
    </>
  )
}

function markBooted() {
  try {
    window.sessionStorage?.setItem(SESSION_KEY, '1')
  } catch {
    // ignore — the splash has already done its job for this load
  }
}

/** Dev-only affordance for testing the splash without devtools. Clears the
 *  session flag and hard-reloads — same sequence a user would run via the
 *  console. Tree-shaken out in production builds because the entire body
 *  short-circuits on a constant NODE_ENV check. */
function ResetSplashButton() {
  if (process.env.NODE_ENV !== 'development') return null

  function reset() {
    try {
      window.sessionStorage?.removeItem(SESSION_KEY)
      // Force the next mount to show the splash even on a warm session
      // where document.readyState would already be 'complete' before our
      // race timer arms. Without this flag, the conditional gate would
      // skip the splash via the fast path and defeat the whole point of
      // a "reset" button.
      window.sessionStorage?.setItem(FORCE_KEY, '1')
    } catch {
      // ignore
    }
    window.location.reload()
  }

  return (
    <button
      type="button"
      onClick={reset}
      aria-label="Reset splash screen"
      className="fixed bottom-4 right-4 z-50 text-white/20 hover:text-white/50 text-xs font-inter transition-colors cursor-pointer"
    >
      Reset Splash
    </button>
  )
}
