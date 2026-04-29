'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import * as Tooltip from '@radix-ui/react-tooltip'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, Compass, AlignLeft, Palette,
  Layers, Download, User, Building2, CreditCard, MessageCircle,
  Star, HelpCircle, Shield, ChevronDown, ChevronUp,
  Crown, BarChart3, Loader2, RefreshCw, Upload, X, Wand2,
  ImageIcon, FileText, Users, MessageSquare, Gauge, BookMarked, Type, Lock,
} from 'lucide-react'
import type { BookPage } from '@/types/database'
import type { CoauthorStage, ImageStatus } from '@/components/coauthor/CoauthorShell'
import { UserMenu } from './UserMenu'

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
  hasDiscover?: boolean
  onStageChange: (stage: CoauthorStage) => void
  onChapterSelect: (index: number) => void
  onGenerateCover: (prompt?: string) => void
  onCoverUpload: (file: File) => void
}

interface Props {
  userEmail: string
  isPremium?: boolean
  isAdmin?: boolean
  bookContext?: BookContext
  collapsed?: boolean
  onToggleCollapse?: () => void
}

interface Section {
  key: string
  label: string
  icon: React.ReactNode
  defaultOpen?: boolean
}

const SECTIONS: Section[] = [
  { key: 'library', label: 'Library', icon: <BarChart3 className="w-4 h-4" />, defaultOpen: true },
  { key: 'build', label: 'Build', icon: <Palette className="w-4 h-4" />, defaultOpen: true },
  { key: 'account', label: 'Account', icon: <User className="w-4 h-4" />, defaultOpen: true },
  { key: 'support', label: 'Support', icon: <MessageCircle className="w-4 h-4" />, defaultOpen: true },
  { key: 'admin', label: 'Admin', icon: <Shield className="w-4 h-4" />, defaultOpen: false },
]

// Section parent button. Hidden in collapsed mode (the items render flat as
// icons with their own tooltips, so a label/chevron header would be noise).
function sectionHeader(
  key: string,
  label: string,
  icon: React.ReactNode,
  collapsed: boolean,
  open: Record<string, boolean>,
  toggle: (k: string) => void,
) {
  if (collapsed) {
    return (
      <div key={`hdr-${key}`} className="my-1 mx-2 h-px bg-ink-3/60" aria-hidden="true" />
    )
  }
  return (
    <button
      key={`hdr-${key}`}
      onClick={() => toggle(key)}
      className="w-full flex items-center justify-between px-3 py-2 text-xs font-inter font-medium text-ink-muted uppercase tracking-wider hover:text-ink-subtle transition-colors"
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {open[key] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
    </button>
  )
}

export function AppSidebar({
  userEmail,
  isPremium = false,
  isAdmin = false,
  bookContext,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s.key, s.defaultOpen ?? false]))
  )
  const [showCoverPrompt, setShowCoverPrompt] = useState(false)
  const [coverPrompt, setCoverPrompt] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toggleSection(key: string) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const buildStage = bookContext?.stage
  // Derive bookId from URL when bookContext isn't passed (e.g., on the wizard
  // page, which doesn't own coauthor state) so wizard-step nav still works.
  const pathBookId = pathname.match(/^\/book\/([^/]+)/)?.[1] ?? null
  const bookId = bookContext?.bookId ?? pathBookId
  const onWizardPath = !!bookId && pathname.startsWith(`/book/${bookId}/wizard`)
  const onCoauthorPath = !!bookId && pathname.startsWith(`/book/${bookId}/coauthor`)
  const wizardStepParam = searchParams.get('step')
  const activeWizardStep = onWizardPath
    ? (wizardStepParam ? Number.parseInt(wizardStepParam, 10) : 0)
    : null

  function gotoWizardStep(n: number) {
    if (!bookId) return
    window.location.href = `/book/${bookId}/wizard?step=${n}`
  }

  function gotoCoauthorStage(stage: 'outline' | 'chapter' | 'complete') {
    if (bookContext?.onStageChange && onCoauthorPath) {
      bookContext.onStageChange(stage)
      return
    }
    if (bookId) {
      window.location.href = `/book/${bookId}/coauthor?stage=${stage}`
    }
  }

  // Wraps a row in a Radix tooltip. Used for two purposes:
  //   1) collapsed mode — shows the label as a tooltip on hover
  //   2) locked items — explains the prerequisite ("Open a book first")
  // The tooltip also fires for non-locked items in collapsed mode so the user
  // always knows where they're pointing.
  function withTooltip(child: React.ReactElement, tip: string | null) {
    if (!tip) return child
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{child}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={10}
            className="z-50 px-2.5 py-1.5 rounded-md bg-ink-2 border border-ink-3 text-xs font-inter text-cream shadow-lg animate-fade-in"
          >
            {tip}
            <Tooltip.Arrow className="fill-ink-2" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    )
  }

  // Active state uses a left gold border accent + ink-3 fill. Disabled state
  // dims the text and replaces the icon with a small Lock cue. Tooltips only
  // surface in collapsed mode (label preview) or when locked (reason).
  function navItem(
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    active?: boolean,
    disabled?: boolean,
    sub?: React.ReactNode,
    lockedReason?: string,
  ) {
    const showLock = disabled && !!lockedReason
    const tip = collapsed ? (disabled && lockedReason ? `${label} — ${lockedReason}` : label) : (showLock ? lockedReason : null)
    const button = (
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-label={label}
        className={`w-full flex items-center gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'} py-2 rounded-md text-sm font-inter transition-colors text-left relative ${
          active
            ? 'bg-ink-3 text-gold'
            : disabled
            ? 'text-ink-muted/60 cursor-not-allowed'
            : 'text-ink-subtle hover:text-cream hover:bg-ink-2'
        }`}
      >
        {/* Left gold accent on active */}
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-gold rounded-r" aria-hidden="true" />
        )}
        <span className={active ? 'text-gold' : disabled ? 'text-ink-muted/40' : 'text-ink-muted'}>
          {showLock ? <Lock className="w-3.5 h-3.5" /> : icon}
        </span>
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    )
    return (
      <div key={label}>
        {withTooltip(button, tip)}
        {!collapsed && sub}
      </div>
    )
  }

  function linkItem(label: string, icon: React.ReactNode, href: string) {
    const active = isActive(href)
    const link = (
      <Link
        href={href}
        aria-label={label}
        className={`flex items-center gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'} py-2 rounded-md text-sm font-inter transition-colors relative ${
          active
            ? 'bg-ink-3 text-gold'
            : 'text-ink-subtle hover:text-cream hover:bg-ink-2'
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-gold rounded-r" aria-hidden="true" />
        )}
        <span className={active ? 'text-gold' : 'text-ink-muted'}>{icon}</span>
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    )
    return <div key={label}>{withTooltip(link, collapsed ? label : null)}</div>
  }

  const chapterList = bookContext && bookContext.pages.length > 0 && buildStage === 'chapter' && (
    <div className="ml-7 mt-0.5 space-y-0.5 pb-1">
      {bookContext.pages.map((page, i) => (
        <button
          key={page.id}
          onClick={() => bookContext.onChapterSelect(i)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-inter transition-colors text-left truncate ${
            bookContext.activeChapterIndex === i ? 'text-gold' : 'text-[#5A6478] hover:text-cream'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            page.approved ? 'bg-accent' : bookContext.activeChapterIndex === i ? 'bg-gold' : 'bg-[#3A4150]'
          }`} />
          <span className="truncate">{page.chapter_title}</span>
          {(bookContext.imageStatuses[page.id] ?? (page.image_url ? 'done' : 'idle')) === 'generating' && (
            <Loader2 className="w-2.5 h-2.5 animate-spin text-accent shrink-0" />
          )}
        </button>
      ))}
    </div>
  )

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      initial={false}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="shrink-0 bg-ink-1 border-r border-ink-3 flex flex-col h-screen overflow-y-auto overflow-x-hidden"
    >
      {/* Header — logo + collapse toggle. Avatar lives in the footer UserMenu. */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-4 border-b border-ink-3`}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-gold flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-ink-1" />
            </div>
            <span className="font-playfair text-cream text-sm font-semibold truncate">FlipBookPro</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="w-7 h-7 rounded-md bg-gold flex items-center justify-center" aria-label="FlipBookPro home">
            <BookOpen className="w-4 h-4 text-ink-1" />
          </Link>
        )}
        {!collapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="p-1.5 rounded-md text-ink-subtle hover:text-cream hover:bg-ink-2 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5 -rotate-90" />
          </button>
        )}
      </div>

      {/* Upgrade CTA — hidden when collapsed (UserMenu's crown surfaces premium status) */}
      {!collapsed && !isPremium && !isAdmin && (
        <div className="px-3 pt-3 pb-1">
          <Link
            href="/settings/billing"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-gold hover:bg-gold-soft text-ink-1 text-xs font-inter font-semibold transition-colors press-scale"
          >
            <Crown className="w-3.5 h-3.5" />
            Upgrade to Premium
          </Link>
        </div>
      )}

      {/* Nav. Section parents become silent in collapsed mode — items render
          flat as icons. Lock tooltips explain prerequisites for disabled items
          (e.g. "Open a book to access"). Active items get a left gold border. */}
      <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-3'} py-2 space-y-0.5`}>
        {linkItem('Dashboard', <LayoutDashboard className="w-4 h-4" />, '/dashboard')}

        {/* Library */}
        {sectionHeader('library', 'Library', <BarChart3 className="w-3.5 h-3.5" />, collapsed, open, toggleSection)}
        {(collapsed || open.library) && (
          <div className={collapsed ? 'space-y-0.5' : 'space-y-0.5 ml-1'}>
            {linkItem('Books', <BookOpen className="w-4 h-4" />, '/dashboard')}
            {linkItem('Media', <ImageIcon className="w-4 h-4" />, '/media')}
          </div>
        )}

        {/* Build */}
        {sectionHeader('build', 'Build', <Wand2 className="w-3.5 h-3.5" />, collapsed, open, toggleSection)}
        {(collapsed || open.build) && (
          <div className={collapsed ? 'space-y-0.5' : 'space-y-0.5 ml-1'}>
            {(!bookContext || bookContext.hasDiscover) && navItem(
              'Discover',
              <Compass className="w-4 h-4" />,
              () => {},
              false,
              !bookContext || !bookContext.hasDiscover,
              undefined,
              !bookContext ? 'Open a book to access' : !bookContext.hasDiscover ? 'This book uses outline mode' : undefined,
            )}
            {navItem(
              'Outline',
              <AlignLeft className="w-4 h-4" />,
              () => gotoCoauthorStage('outline'),
              onCoauthorPath && buildStage === 'outline',
              !bookId,
              undefined,
              !bookId ? 'Open a book to access' : undefined,
            )}

            {!collapsed && (
              <p className="px-3 pt-2 pb-0.5 text-[9px] font-inter font-medium text-ink-muted/70 uppercase tracking-[0.14em]">
                Setup
              </p>
            )}
            {navItem('Details',  <FileText className="w-4 h-4" />,      () => gotoWizardStep(1), onWizardPath && activeWizardStep === 1, !bookId, undefined, !bookId ? 'Open a book to access' : undefined)}
            {navItem('Audience', <Users className="w-4 h-4" />,         () => gotoWizardStep(2), onWizardPath && activeWizardStep === 2, !bookId, undefined, !bookId ? 'Open a book to access' : undefined)}
            {navItem('Tone',     <MessageSquare className="w-4 h-4" />, () => gotoWizardStep(3), onWizardPath && activeWizardStep === 3, !bookId, undefined, !bookId ? 'Open a book to access' : undefined)}
            {navItem('Reader',   <Gauge className="w-4 h-4" />,         () => gotoWizardStep(4), onWizardPath && activeWizardStep === 4, !bookId, undefined, !bookId ? 'Open a book to access' : undefined)}

            {!collapsed && (
              <p className="px-3 pt-2 pb-0.5 text-[9px] font-inter font-medium text-ink-muted/70 uppercase tracking-[0.14em]">
                Theme
              </p>
            )}
            {navItem('Illustrations', <Palette className="w-4 h-4" />,    () => gotoWizardStep(5), onWizardPath && activeWizardStep === 5, !bookId, undefined, !bookId ? 'Open a book to access' : undefined)}
            {navItem('Cover',         <BookMarked className="w-4 h-4" />, () => gotoWizardStep(6), onWizardPath && activeWizardStep === 6, !bookId, undefined, !bookId ? 'Open a book to access' : undefined)}
            {navItem('Typography',    <Type className="w-4 h-4" />,       () => gotoWizardStep(7), onWizardPath && activeWizardStep === 7, !bookId, undefined, !bookId ? 'Open a book to access' : undefined)}

            {!collapsed && (
              <p className="px-3 pt-2 pb-0.5 text-[9px] font-inter font-medium text-ink-muted/70 uppercase tracking-[0.14em]">
                Content
              </p>
            )}
            {navItem(
              'Chapters',
              <Layers className="w-4 h-4" />,
              () => gotoCoauthorStage('chapter'),
              onCoauthorPath && buildStage === 'chapter',
              !bookId,
              chapterList,
              !bookId ? 'Open a book to access' : undefined,
            )}
            {navItem(
              'Review & Export',
              <Download className="w-4 h-4" />,
              () => gotoCoauthorStage('complete'),
              onCoauthorPath && (buildStage === 'complete' || buildStage === 'back-matter'),
              !bookId || (!!bookContext && !bookContext.allApproved),
              undefined,
              !bookId
                ? 'Open a book to access'
                : (!!bookContext && !bookContext.allApproved) ? 'Approve every chapter to unlock' : undefined,
            )}
          </div>
        )}

        {/* Account */}
        {sectionHeader('account', 'Account', <User className="w-3.5 h-3.5" />, collapsed, open, toggleSection)}
        {(collapsed || open.account) && (
          <div className={collapsed ? 'space-y-0.5' : 'space-y-0.5 ml-1'}>
            {linkItem('Profile', <User className="w-4 h-4" />, '/settings/profile')}
            {linkItem('Brand Profile', <Building2 className="w-4 h-4" />, '/settings/brand')}
            {linkItem('Billing', <CreditCard className="w-4 h-4" />, '/settings/billing')}
          </div>
        )}

        {/* Support */}
        {sectionHeader('support', 'Support', <MessageCircle className="w-3.5 h-3.5" />, collapsed, open, toggleSection)}
        {(collapsed || open.support) && (
          <div className={collapsed ? 'space-y-0.5' : 'space-y-0.5 ml-1'}>
            {linkItem('Chat', <MessageCircle className="w-4 h-4" />, '/support/chat')}
            {linkItem('Feedback', <Star className="w-4 h-4" />, '/support/feedback')}
            {linkItem('FAQ', <HelpCircle className="w-4 h-4" />, '/support/faq')}
          </div>
        )}

        {/* Admin — only when isAdmin */}
        {isAdmin && (
          <>
            {sectionHeader('admin', 'Admin', <Shield className="w-3.5 h-3.5" />, collapsed, open, toggleSection)}
            {(collapsed || open.admin) && (
              <div className={collapsed ? 'space-y-0.5' : 'space-y-0.5 ml-1'}>
                {linkItem('Dashboard', <BarChart3 className="w-4 h-4" />, '/admin')}
                {linkItem('Users', <User className="w-4 h-4" />, '/admin/users')}
              </div>
            )}
          </>
        )}
      </nav>

      {/* Book cover section (only in book context, full mode only) */}
      {!collapsed && bookContext && (
        <div className="px-3 pb-2 border-t border-ink-3 pt-3">
          <p className="text-[10px] font-inter font-medium text-[#5A6478] uppercase tracking-wider px-1 mb-2">Cover</p>

          {bookContext.coverImageStatus === 'generating' ? (
            <div className="aspect-[2/3] bg-[#151C28] rounded-md flex items-center justify-center gap-2 flex-col">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span className="text-[10px] text-[#5A6478] font-inter">Generating…</span>
            </div>
          ) : bookContext.coverImageUrl ? (
            <div className="relative group">
              <img src={bookContext.coverImageUrl} alt="Cover" className="w-full aspect-[2/3] object-cover rounded-md" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
                <button onClick={() => setShowCoverPrompt((v) => !v)} className="p-1.5 bg-[#0D1117]/80 rounded-md text-cream hover:text-accent" title="Regenerate">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 bg-[#0D1117]/80 rounded-md text-cream hover:text-accent" title="Upload">
                  <Upload className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="aspect-[2/3] bg-[#151C28] rounded-md flex flex-col items-center justify-center gap-1 border border-dashed border-[#2A3448]">
              <ImageIcon className="w-5 h-5 text-[#3A4150]" />
              <span className="text-[10px] text-[#5A6478] font-inter">No cover yet</span>
            </div>
          )}

          {showCoverPrompt && (
            <div className="mt-2 space-y-2">
              <textarea
                value={coverPrompt}
                onChange={(e) => setCoverPrompt(e.target.value)}
                placeholder="Optional: describe the cover…"
                rows={2}
                className="w-full px-2 py-1.5 rounded-md bg-[#151C28] border border-[#2A3448] text-cream placeholder:text-[#5A6478] text-xs font-inter focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { bookContext.onGenerateCover(coverPrompt.trim() || undefined); setShowCoverPrompt(false); setCoverPrompt('') }}
                  className="flex-1 py-1.5 bg-accent hover:bg-accent/90 text-cream text-xs font-inter rounded-md transition-colors"
                >
                  Generate
                </button>
                <button onClick={() => { setShowCoverPrompt(false); setCoverPrompt('') }} className="p-1.5 text-[#5A6478] hover:text-cream">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {!bookContext.coverImageUrl && bookContext.coverImageStatus !== 'generating' && !showCoverPrompt && (
            <div className="flex gap-1.5 mt-2">
              <button
                onClick={() => setShowCoverPrompt(true)}
                className="flex-1 py-1.5 border border-[#2A3448] hover:border-accent/40 text-[#5A6478] hover:text-cream text-xs font-inter rounded-md transition-colors flex items-center justify-center gap-1"
              >
                <Wand2 className="w-3 h-3" /> Generate
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-1.5 border border-[#2A3448] hover:border-accent/40 text-[#5A6478] hover:text-cream text-xs font-inter rounded-md transition-colors flex items-center justify-center gap-1"
              >
                <Upload className="w-3 h-3" /> Upload
              </button>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) bookContext.onCoverUpload(f); e.target.value = '' }} className="hidden" />

          {/* Chapter progress */}
          {bookContext.pages.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 bg-[#151C28] rounded-full h-1">
                <div
                  className="bg-accent h-1 rounded-full transition-all"
                  style={{ width: `${(bookContext.pages.filter((p) => p.approved).length / bookContext.pages.length) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-inter text-[#5A6478]">
                {bookContext.pages.filter((p) => p.approved).length}/{bookContext.pages.length}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer — avatar dropdown with profile / brand / billing / sign out */}
      <div className="px-2 py-2 border-t border-ink-3">
        <UserMenu userEmail={userEmail} isPremium={isPremium} isAdmin={isAdmin} collapsed={collapsed} />
      </div>
    </motion.aside>
  )
}
