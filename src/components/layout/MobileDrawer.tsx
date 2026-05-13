'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, ImageIcon, Compass, AlignLeft, Radar,
  Layers, User, Building2, CreditCard, MessageCircle,
  Star, HelpCircle, Shield, X, BarChart3, Lock, Wand2, ShieldCheck, Globe, Eye, ExternalLink,
  Users, Key,
} from 'lucide-react'
import type { BookContext } from './AppSidebar'
import type { CoauthorStage } from '@/components/coauthor/CoauthorShell'

interface Props {
  open: boolean
  onClose: () => void
  userEmail: string
  isPremium?: boolean
  isAdmin?: boolean
  bookContext?: BookContext
}

/** Mobile-only navigation drawer. Slides in from the left with a
 *  semi-transparent backdrop. Mirrors AppSidebar's nav inventory but
 *  always renders in expanded mode (no collapse logic) and auto-closes
 *  on link tap. AppSidebar itself is hidden below the lg breakpoint;
 *  this drawer is the only mobile nav surface.
 *
 *  Closes on: backdrop tap, X button, link tap, Escape key. Body scroll
 *  is locked while open to prevent the page underneath from scrolling
 *  with the drawer. */
export function MobileDrawer({ open, onClose, isAdmin = false, bookContext }: Props) {
  const pathname = usePathname()

  // Escape-to-close — global keydown listener while open. Removed when
  // the drawer closes so we don't intercept escape elsewhere.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Body scroll lock while drawer is open. Restores the previous overflow
  // value on close so we don't trample on any other lock.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  // Derive bookId from URL when bookContext isn't passed (e.g., on the
  // wizard page where the shell doesn't own coauthor state).
  const pathBookId = pathname.match(/^\/book\/([^/]+)/)?.[1] ?? null
  const bookId = bookContext?.bookId ?? pathBookId
  const onCoauthorPath = !!bookId && pathname.startsWith(`/book/${bookId}/coauthor`)
  const buildStage = bookContext?.stage

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  function handleStageNav(stage: CoauthorStage) {
    if (bookContext?.onStageChange && onCoauthorPath) {
      bookContext.onStageChange(stage)
      onClose()
      return
    }
    if (bookId) {
      window.location.href = `/book/${bookId}/coauthor?stage=${stage}`
    }
  }

  function linkRow(label: string, icon: React.ReactNode, href: string) {
    const active = isActive(href)
    return (
      <Link
        key={label}
        href={href}
        onClick={onClose}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-inter transition-colors ${
          active ? 'bg-ink-3 text-gold' : 'text-ink-subtle hover:text-cream hover:bg-ink-2'
        }`}
      >
        <span className={active ? 'text-gold' : 'text-ink-muted'}>{icon}</span>
        <span className="truncate">{label}</span>
      </Link>
    )
  }

  function stageRow(
    label: string,
    icon: React.ReactNode,
    stage: CoauthorStage,
    options: { disabled?: boolean; lockedReason?: string } = {},
  ) {
    const active = onCoauthorPath && buildStage === stage
    const { disabled, lockedReason } = options
    const showLock = disabled && !!lockedReason
    return (
      <button
        key={label}
        type="button"
        onClick={disabled ? undefined : () => handleStageNav(stage)}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-inter transition-colors text-left ${
          active
            ? 'bg-ink-3 text-gold'
            : disabled
            ? 'text-ink-muted/60 cursor-not-allowed'
            : 'text-ink-subtle hover:text-cream hover:bg-ink-2'
        }`}
        title={showLock ? lockedReason : undefined}
      >
        <span className={active ? 'text-gold' : disabled ? 'text-ink-muted/40' : 'text-ink-muted'}>
          {showLock ? <Lock className="w-4 h-4" /> : icon}
        </span>
        <span className="truncate">{label}</span>
      </button>
    )
  }

  function sectionLabel(label: string) {
    return (
      <p
        key={`label-${label}`}
        className="px-3 pt-4 pb-1 text-[10px] font-inter font-medium text-ink-muted uppercase tracking-[0.16em]"
      >
        {label}
      </p>
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 lg:hidden"
          aria-modal="true"
          role="dialog"
          aria-label="Navigation"
        >
          {/* Backdrop */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink-1/60 backdrop-blur-sm w-full h-full"
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-full w-[280px] bg-ink-1 border-r border-ink-3 flex flex-col overflow-y-auto"
          >
            {/* Header — logo + close */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-ink-3">
              <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-md bg-gold flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-ink-1" />
                </div>
                <span className="font-playfair text-cream text-sm font-semibold truncate">FlipBookPro</span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="p-1.5 rounded-md text-ink-subtle hover:text-cream hover:bg-ink-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body — flat sections, no collapse */}
            <nav className="flex-1 px-2 py-3 space-y-0.5">
              {linkRow('Dashboard', <LayoutDashboard className="w-4 h-4" />, '/dashboard')}

              {sectionLabel('Library')}
              {linkRow('Books', <BookOpen className="w-4 h-4" />, '/dashboard')}
              {linkRow('Media', <ImageIcon className="w-4 h-4" />, '/media')}

              {bookContext && (
                <>
                  {sectionLabel('Build')}
                  {bookContext.hasDiscover && stageRow(
                    'Discover',
                    <Compass className="w-4 h-4" />,
                    'outline', // discover doesn't have its own stage; placeholder
                    { disabled: true, lockedReason: 'Open in Outline stage' },
                  )}
                  {stageRow('Outline',           <AlignLeft className="w-4 h-4" />,   'outline')}
                  {stageRow('Creator Radar',     <Radar className="w-4 h-4" />,       'radar')}
                  {stageRow('Chapters',          <Layers className="w-4 h-4" />,      'chapter')}
                  {stageRow('Book Design',       <Wand2 className="w-4 h-4" />,       'book-design')}
                  {stageRow('Pre-Publish Check', <ShieldCheck className="w-4 h-4" />, 'pre-publish')}
                  {stageRow('Publish',           <Globe className="w-4 h-4" />,       'publish')}
                </>
              )}

              {/* Persistent preview link — visible whenever a book is open
                  in this drawer, regardless of stage. Opens in a new tab
                  so the drawer can close behind it. */}
              {bookId && (
                <a
                  href={`/book/${bookId}/preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-md text-sm font-inter text-ink-subtle hover:text-cream hover:bg-ink-2 transition-colors"
                >
                  <Eye className="w-4 h-4 text-ink-muted" />
                  <span className="flex-1 truncate">Preview Book</span>
                  <ExternalLink className="w-3 h-3 text-ink-muted" />
                </a>
              )}

              {sectionLabel('Account')}
              {linkRow('Profile',       <User className="w-4 h-4" />,       '/settings/profile')}
              {linkRow('Brand Profile', <Building2 className="w-4 h-4" />,  '/settings/brand')}
              {linkRow('Billing',       <CreditCard className="w-4 h-4" />, '/settings/billing')}
              {linkRow('Leads',         <Users className="w-4 h-4" />,      '/settings/leads')}
              {linkRow('API Keys',      <Key className="w-4 h-4" />,        '/settings/api-keys')}

              {sectionLabel('Support')}
              {linkRow('Chat',     <MessageCircle className="w-4 h-4" />, '/support/chat')}
              {linkRow('Feedback', <Star className="w-4 h-4" />,          '/support/feedback')}
              {linkRow('FAQ',      <HelpCircle className="w-4 h-4" />,    '/support/faq')}

              {isAdmin && (
                <>
                  {sectionLabel('Admin')}
                  {linkRow('Dashboard', <BarChart3 className="w-4 h-4" />, '/admin')}
                  {linkRow('Users',     <Shield className="w-4 h-4" />,    '/admin/users')}
                </>
              )}
            </nav>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
