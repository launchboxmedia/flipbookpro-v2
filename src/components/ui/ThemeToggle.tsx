'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeProvider'

/** Light/dark switch. Shows the icon of the *current* theme (Sun in
 *  light, Moon in dark) and flips on click. Colour pairs are spec'd:
 *  cream surfaces in light, ink surfaces in dark — driven by Tailwind's
 *  `dark:` variant off the <html>.dark class the provider toggles. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-2 rounded-lg transition-colors duration-200 bg-cream-2 text-ink-1 hover:bg-cream-3 dark:bg-ink-2 dark:text-white/60 dark:hover:bg-ink-3 dark:hover:text-white"
    >
      {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  )
}
