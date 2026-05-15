'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'theme'

/** Apply / remove the `dark` class on <html>. Tailwind's darkMode:'class'
 *  keys off this. Kept as a standalone fn so both the mount effect and
 *  the toggle use the exact same DOM write. */
function applyThemeClass(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

/** App-wide light/dark theme.
 *
 *  Light is the default. The stored preference (localStorage['theme'])
 *  wins on mount; absent that, 'light'. The class is applied to
 *  <html> after mount — there is a one-frame flash for returning
 *  dark-mode users (no blocking inline script, per the Phase-1 spec).
 *  If that flash becomes a problem, the fix is a tiny pre-paint inline
 *  script in the <head>; that's a deliberate Phase-1 follow-up, not an
 *  oversight. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // SSR + first client render: 'light' (the default). Reconciled to the
  // stored value in the mount effect below.
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(STORAGE_KEY)
    } catch {
      // Private mode / storage disabled — fall back to the default.
    }
    const initial: Theme = stored === 'dark' ? 'dark' : 'light'
    setTheme(initial)
    applyThemeClass(initial)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore — preference just won't persist this session.
      }
      applyThemeClass(next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
