'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Menu, PanelLeft } from 'lucide-react'
import { AppSidebar, type BookContext } from './AppSidebar'
import { MobileDrawer } from './MobileDrawer'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface Props {
  userEmail: string
  isPremium?: boolean
  isAdmin?: boolean
  bookContext?: BookContext
  /** Optional title rendered in the sticky top header (left of breadcrumbs). */
  pageTitle?: React.ReactNode
  /** Optional right-aligned slot in the sticky top header (e.g. SaveIndicator). */
  headerRight?: React.ReactNode
  /** Background applied to the main content area. Pages set this when they
   *  render on a cream/light surface (settings, wizard) instead of dark. */
  mainBackground?: string
  children: React.ReactNode
}

const COLLAPSE_KEY = 'flipbookpro:sidebar-collapsed'

export function AppShell({
  userEmail,
  isPremium,
  isAdmin,
  bookContext,
  pageTitle,
  headerRight,
  mainBackground = 'bg-canvas',
  children,
}: Props) {
  // Persist the collapse choice across navigation. Hydrated lazily so the
  // initial render matches SSR (always uncollapsed) and updates after mount.
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSE_KEY)
      if (stored === '1') setCollapsed(true)
    } catch {
      // Private mode / no storage — keep default uncollapsed.
    }
  }, [])

  // Mobile / tablet — sidebar is hidden via CSS below the lg breakpoint
  // (1024px) and the hamburger drawer takes over. Auto-collapse so that
  // when the user resizes from narrow → wide, the sidebar reappears in
  // its tighter icon-only mode rather than the full 220px expanded
  // state, which on tablet widths feels overwhelming.
  const isMobile = useMediaQuery('(max-width: 1023px)')
  useEffect(() => {
    if (isMobile) setCollapsed(true)
  }, [isMobile])

  // Drawer state — only relevant on mobile. Closed by default; the
  // hamburger button toggles it.
  const [drawerOpen, setDrawerOpen] = useState(false)

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <div className={`flex h-screen overflow-hidden ${mainBackground}`}>
      {/* Desktop sidebar — hidden below the lg breakpoint, where the
          hamburger drawer takes over. lg:flex re-enables it at 1024px+. */}
      <div className="hidden lg:flex">
        <AppSidebar
          userEmail={userEmail}
          isPremium={isPremium}
          isAdmin={isAdmin}
          bookContext={bookContext}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </div>

      {/* Mobile drawer — overlays the page when opened from the
          hamburger. AppSidebar isn't rendered on mobile at all (CSS
          hidden), so this is the only nav surface below 1024px. */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userEmail={userEmail}
        isPremium={isPremium}
        isAdmin={isAdmin}
        bookContext={bookContext}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky top header — h-14, ink with backdrop blur for depth on
            scroll. On mobile the leading control is the hamburger that
            opens the drawer. On desktop, when the sidebar is collapsed
            the leading control is the PanelLeft expand button; when
            expanded the sidebar's own header carries the toggle and the
            header has no leading control. */}
        <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 border-b border-ink-3 bg-ink-1/80 backdrop-blur-md backdrop-saturate-150">
          {/* Mobile-only hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="lg:hidden p-1.5 rounded-md text-ink-subtle hover:text-cream hover:bg-ink-2 transition-colors press-scale"
          >
            <Menu className="w-4 h-4" />
          </button>
          {/* Desktop-only collapse toggle (only when collapsed) */}
          {collapsed && (
            <button
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              className="hidden lg:inline-flex p-1.5 rounded-md text-ink-subtle hover:text-cream hover:bg-ink-2 transition-colors press-scale"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            {pageTitle && (
              <div className="font-inter text-sm text-cream truncate">{pageTitle}</div>
            )}
          </div>
          {headerRight && <div className="flex items-center gap-2 shrink-0">{headerRight}</div>}
        </header>

        {/* Main content. motion.main re-mounts on key change to fade pages in. */}
        <motion.main
          key={typeof window !== 'undefined' ? window.location.pathname : 'main'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 overflow-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}
