'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Tooltip from '@radix-ui/react-tooltip'
import { motion } from 'framer-motion'
import {
  ChevronLeft, BookOpen,
  LayoutDashboard, Library as LibraryIcon, ImageIcon, Settings,
  Radar, FileText, PenLine, Palette, CheckSquare, Globe,
  CheckCircle2, Eye, ExternalLink, Shield, BarChart3,
} from 'lucide-react'
import type { BookPage } from '@/types/database'
import type { CoauthorStage, ImageStatus } from '@/components/coauthor/CoauthorShell'
import { UserMenu } from './UserMenu'
import { NewBookButton } from '@/components/dashboard/NewBookButton'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

/** BookContext preserved as-is from the old sidebar so CoauthorShell (and
 *  anything else passing this prop) doesn't need to change. The new sidebar
 *  only consumes a subset of the fields — the rest (cover panel, per-chapter
 *  callbacks, image statuses) are dropped from this surface and surfaced
 *  inside the Book Design / Chapters stages where they belong. */
export interface BookContext {
  bookId: string
  bookTitle: string
  stage: CoauthorStage
  activeChapterIndex: number
  pages: BookPage[]
  allApproved: boolean
  imageStatuses: Record<string, ImageStatus>
  coverImageUrl: string | null
  coverImageStatus: ImageStatus
  coverHasText: boolean
  hasDiscover?: boolean
  onStageChange: (stage: CoauthorStage) => void
  onChapterSelect: (index: number) => void
  onGenerateCover: (prompt?: string) => void
  onCoverUpload: (file: File) => void
  onToggleCoverHasText: (next: boolean) => void
}

interface Props {
  userEmail: string
  isPremium?: boolean
  isAdmin?: boolean
  bookContext?: BookContext
  collapsed?: boolean
  onToggleCollapse?: () => void
}

// ── Workflow step mapping ─────────────────────────────────────────────────
// The five user-facing groups in the spec map to CoauthorStage values like so:
const STAGE_GROUPS: Array<{
  group: string
  steps: Array<{ label: string; stage: CoauthorStage; icon: React.ReactNode }>
}> = [
  { group: 'Research', steps: [{ label: 'Creator Radar',     stage: 'radar',       icon: <Radar       className="w-4 h-4" /> }] },
  { group: 'Outline',  steps: [{ label: 'Outline',           stage: 'outline',     icon: <FileText    className="w-4 h-4" /> }] },
  { group: 'Write',    steps: [{ label: 'Chapters',          stage: 'chapter',     icon: <PenLine     className="w-4 h-4" /> }] },
  { group: 'Design',   steps: [{ label: 'Book Design',       stage: 'book-design', icon: <Palette     className="w-4 h-4" /> }] },
  {
    group: 'Publish',
    steps: [
      { label: 'Pre-Publish Check', stage: 'pre-publish', icon: <CheckSquare className="w-4 h-4" /> },
      { label: 'Publish',           stage: 'publish',     icon: <Globe       className="w-4 h-4" /> },
    ],
  },
]

export function AppSidebar({
  userEmail,
  isPremium = false,
  isAdmin = false,
  bookContext,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const pathname = usePathname()
  // bookId detection: prefer bookContext (coauthor explicit), fall back to
  // URL parsing (wizard, preview, publish pages that don't pass context).
  const pathBookId = pathname.match(/^\/book\/([^/]+)/)?.[1] ?? null
  const bookId = bookContext?.bookId ?? pathBookId
  const inBook = !!bookId
  const onCoauthorPath = inBook && pathname.startsWith(`/book/${bookId}/coauthor`)

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  /** Stage navigation — uses bookContext callback when available so the
   *  switch is instantaneous within the coauthor SPA; falls back to a
   *  full navigation for wizard/preview/other routes. */
  function gotoStage(stage: CoauthorStage) {
    if (bookContext?.onStageChange && onCoauthorPath) {
      bookContext.onStageChange(stage)
      return
    }
    if (bookId) {
      window.location.href = `/book/${bookId}/coauthor?stage=${stage}`
    }
  }

  // ── Helpers for items ────────────────────────────────────────────────
  function withTooltip(child: React.ReactElement, tip: string | null) {
    if (!tip) return child
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{child}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={10}
            className="z-50 px-2.5 py-1.5 rounded-md bg-cream-2 dark:bg-ink-2 border border-cream-3 dark:border-ink-3 text-xs font-inter text-ink-1 dark:text-cream shadow-lg animate-fade-in"
          >
            {tip}
            <Tooltip.Arrow className="fill-cream-2 dark:fill-ink-2" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    )
  }

  function linkItem(label: string, icon: React.ReactNode, href: string) {
    const active = isActive(href)
    const link = (
      <Link
        href={href}
        aria-label={label}
        className={`flex items-center gap-3 ${collapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-lg text-sm font-inter font-medium transition-colors duration-150 ${
          active
            ? 'bg-cream-3 text-ink-1 dark:bg-ink-3 dark:text-white'
            : 'text-ink-1/50 hover:text-ink-1 hover:bg-cream-2 dark:text-white/50 dark:hover:text-white dark:hover:bg-ink-2/50'
        }`}
      >
        <span className={active ? 'text-gold' : 'text-ink-1/60 dark:text-white/60'}>{icon}</span>
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    )
    return <div key={label}>{withTooltip(link, collapsed ? label : null)}</div>
  }

  /** Indented child of a parent linkItem. Hidden when collapsed — sub-items
   *  rely on visual indentation to show the parent relationship, which can't
   *  survive the icon-only collapsed mode. Used for the Library group in
   *  global mode. */
  function subLinkItem(label: string, href: string) {
    if (collapsed) return null
    const active = isActive(href)
    return (
      <Link
        key={`sub-${label}`}
        href={href}
        className={`flex items-center pl-9 py-1.5 text-xs font-inter transition-colors duration-150 ${
          active
            ? 'text-ink-1 font-medium dark:text-white'
            : 'text-ink-1/40 hover:text-ink-1/60 dark:text-white/40 dark:hover:text-white/60'
        }`}
      >
        {label}
      </Link>
    )
  }

  /** Render a workflow step. Completion + current-stage indicators come
   *  from bookContext when available; on routes without it (wizard /
   *  preview) the step still navigates but loses its status decoration. */
  function stepItem(
    label: string,
    icon: React.ReactNode,
    stage: CoauthorStage,
    isCurrent: boolean,
    isCompleted: boolean,
    subLabel?: string,
  ) {
    const button = (
      <button
        onClick={() => gotoStage(stage)}
        aria-label={label}
        className={`relative w-full flex items-center gap-3 ${collapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-lg text-sm font-inter font-medium text-left transition-colors duration-150 ${
          isCurrent
            ? 'bg-cream-3 text-ink-1 dark:bg-ink-3 dark:text-white'
            : 'text-ink-1/50 hover:text-ink-1 hover:bg-cream-2 dark:text-white/50 dark:hover:text-white dark:hover:bg-ink-2/50'
        }`}
      >
        {isCurrent && !collapsed && (
          <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gold" aria-hidden="true" />
        )}
        <span className={isCurrent ? 'text-gold' : 'text-ink-1/60 dark:text-white/60'}>{icon}</span>
        {!collapsed && (
          <span className="flex-1 truncate">
            {label}
            {subLabel && (
              <span className="block text-ink-1/30 dark:text-white/30 text-xs font-normal mt-0.5">{subLabel}</span>
            )}
          </span>
        )}
        {!collapsed && isCompleted && (
          <CheckCircle2 className="w-3.5 h-3.5 text-gold shrink-0" aria-hidden="true" />
        )}
      </button>
    )
    return <div key={label}>{withTooltip(button, collapsed ? label : null)}</div>
  }

  // ── Completion + current derivation ──────────────────────────────────
  // We can confidently mark Outline + Write from bookContext alone. The
  // other groups don't have reliable signals in the current data layer,
  // so they only get the "current" indicator (no checkmark) until the
  // signals are wired through.
  const chapterCount = bookContext?.pages.length ?? 0
  const approvedCount = bookContext?.pages.filter((p) => p.approved).length ?? 0
  const outlineComplete = chapterCount > 0
  const writeComplete = !!bookContext?.allApproved
  const currentStage = bookContext?.stage ?? null

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 224 }}
      initial={false}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="shrink-0 bg-cream-1 dark:bg-ink-1 border-r border-cream-3 dark:border-ink-3 flex flex-col h-screen overflow-y-auto overflow-x-hidden"
    >
      {/* Header — logo + collapse toggle. ChevronLeft when expanded so
          the icon indicates the direction collapse will travel. */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-4 border-b border-cream-3 dark:border-ink-3`}>
        {!collapsed ? (
          <>
            <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-md bg-gold flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-ink-1" />
              </div>
              <span className="font-playfair text-gold text-lg font-bold truncate">FlipBookPro</span>
            </Link>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                className="p-1.5 rounded-md text-ink-1/40 hover:text-ink-1 hover:bg-cream-2 dark:text-white/40 dark:hover:text-white dark:hover:bg-ink-2 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        ) : (
          <Link href="/dashboard" className="w-7 h-7 rounded-md bg-gold flex items-center justify-center" aria-label="FlipBookPro home">
            <BookOpen className="w-4 h-4 text-ink-1" />
          </Link>
        )}
      </div>

      {/* Nav body — keys on the mode so React swaps the subtree and the
          animate-fade-in utility fires on mode change. */}
      <nav
        key={inBook ? 'contextual' : 'global'}
        className={`flex-1 ${collapsed ? 'px-2' : 'px-3'} py-3 space-y-0.5 animate-fade-in`}
      >
        {inBook ? (
          // ── CONTEXTUAL MODE ──────────────────────────────────────
          <>
            {/* Back to Library — small affordance at the very top. */}
            <Link
              href="/library"
              className={`flex items-center gap-2 ${collapsed ? 'justify-center px-0' : 'px-3'} py-1.5 text-xs font-inter text-ink-1/40 hover:text-ink-1/60 dark:text-white/40 dark:hover:text-white/60 transition-colors`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {!collapsed && <span className="truncate">Back to Library</span>}
            </Link>

            {/* Book title — uses bookContext when available, otherwise a
                generic label so the wizard/preview pages don't look broken. */}
            {!collapsed && (
              <div className="px-3 pt-1 pb-3">
                <p className="text-ink-1 dark:text-white font-semibold text-sm truncate" title={bookContext?.bookTitle}>
                  {bookContext?.bookTitle ?? 'Current book'}
                </p>
              </div>
            )}

            {/* Five workflow groups. Each group renders a small overline
                header then its step(s); the Publish group has two steps
                because Pre-Publish Check + Publish are sequential phases
                of the same act. */}
            {STAGE_GROUPS.map((g) => (
              <div key={g.group}>
                {!collapsed && (
                  <p className="text-[10px] uppercase tracking-widest text-ink-1/30 dark:text-white/30 font-medium px-3 mb-1 mt-4">
                    {g.group}
                  </p>
                )}
                {g.steps.map((s) => {
                  const current = currentStage === s.stage
                  const completed =
                    (s.stage === 'outline' && outlineComplete) ||
                    (s.stage === 'chapter' && writeComplete)
                  // Chapter step gets a subtitle with approval count so
                  // the user can see write-progress without expanding.
                  const sub =
                    s.stage === 'chapter' && chapterCount > 0
                      ? `${approvedCount}/${chapterCount} approved`
                      : undefined
                  return stepItem(s.label, s.icon, s.stage, current, completed, sub)
                })}
              </div>
            ))}
          </>
        ) : (
          // ── GLOBAL MODE ──────────────────────────────────────────
          <>
            {linkItem('Dashboard', <LayoutDashboard className="w-4 h-4" />, '/dashboard')}

            {/* Library parent + always-visible indented sub-items. Both
                the parent linkItem and the Books sub-item route to
                /library — the parent reads as a category header, the
                sub-item as the specific view. Media lives at a sibling
                route. */}
            {linkItem('Library', <LibraryIcon className="w-4 h-4" />, '/library')}
            {subLinkItem('Books', '/library')}
            {subLinkItem('Media', '/library/media')}

            {/* + New Book — wrapped in NewBookButton so plan-gate +
                modal flow are reused. mx-3 wraps the inner button with
                lateral margin; the arbitrary selector forces the
                NewBookButton's trigger (first child of the fragment) to
                go full-width inside the sidebar without changing the
                component's signature, which keeps its auto-width
                behaviour intact on the dashboard header. */}
            {!collapsed && (
              <div className="mx-3 mt-2 mb-4 [&>button:first-child]:w-full">
                <NewBookButton />
              </div>
            )}

            {/* Admin section — only renders for admin users; small footprint
                so it doesn't pollute the global nav for everyone else. */}
            {isAdmin && (
              <>
                {!collapsed && (
                  <p className="text-[10px] uppercase tracking-widest text-ink-1/30 dark:text-white/30 font-medium px-3 mb-1 mt-5">
                    Admin
                  </p>
                )}
                {linkItem('Dashboard', <BarChart3 className="w-4 h-4" />, '/admin')}
                {linkItem('Users',     <Shield     className="w-4 h-4" />, '/admin/users')}
              </>
            )}
          </>
        )}
      </nav>

      {/* Preview link — persistent at the foot of the contextual nav,
          opens in a new tab so the editor doesn't lose its place. */}
      {inBook && bookId && (
        <div className="px-2 py-1 border-t border-cream-3 dark:border-ink-3">
          {withTooltip(
            <a
              href={`/book/${bookId}/preview`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Preview Book"
              className={`flex items-center gap-3 ${collapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-lg text-sm font-inter text-ink-1/40 hover:text-ink-1 hover:bg-cream-2 dark:text-white/40 dark:hover:text-white dark:hover:bg-ink-2/50 transition-colors duration-150`}
            >
              <Eye className="w-4 h-4 text-ink-1/60 dark:text-white/60" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">Preview Book</span>
                  <ExternalLink className="w-3 h-3 text-ink-1/40 dark:text-white/40" />
                </>
              )}
            </a>,
            collapsed ? 'Preview Book — opens in new tab' : null,
          )}
        </div>
      )}

      {/* Settings — single link in both modes, just above the user menu. */}
      <div className="px-2 py-1 border-t border-cream-3 dark:border-ink-3">
        {linkItem('Settings', <Settings className="w-4 h-4" />, '/settings')}
      </div>

      {/* Theme toggle — sits directly above the user section. Row layout
          when expanded (label + switch), centered switch when collapsed. */}
      <div className={`px-2 py-2 border-t border-cream-3 dark:border-ink-3 flex items-center ${collapsed ? 'justify-center' : 'justify-between px-4'}`}>
        {!collapsed && (
          <span className="text-xs font-inter text-ink-1/50 dark:text-white/40">Theme</span>
        )}
        {collapsed
          ? withTooltip(<div><ThemeToggle /></div>, 'Toggle theme')
          : <ThemeToggle />}
      </div>

      {/* Footer — avatar dropdown owns profile / billing / sign out. */}
      <div className="px-2 py-2 border-t border-cream-3 dark:border-ink-3">
        <UserMenu userEmail={userEmail} isPremium={isPremium} isAdmin={isAdmin} collapsed={collapsed} />
      </div>
    </motion.aside>
  )
}
