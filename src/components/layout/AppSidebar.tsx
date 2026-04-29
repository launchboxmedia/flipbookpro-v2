'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, Compass, AlignLeft, Palette,
  Layers, Download, User, Building2, CreditCard, MessageCircle,
  Star, HelpCircle, Shield, ChevronDown, ChevronUp,
  Crown, BarChart3, Loader2, RefreshCw, Upload, X, Wand2,
  ImageIcon, FileText, Users, MessageSquare, Gauge, BookMarked, Type,
} from 'lucide-react'
import { logout } from '@/app/login/actions'
import type { BookPage } from '@/types/database'
import type { CoauthorStage, ImageStatus } from '@/components/coauthor/CoauthorShell'

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

function initials(email: string) {
  const parts = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ').trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U'
}

export function AppSidebar({ userEmail, isPremium = false, isAdmin = false, bookContext }: Props) {
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

  const userInitials = initials(userEmail)

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

  function navItem(
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    active?: boolean,
    disabled?: boolean,
    sub?: React.ReactNode
  ) {
    return (
      <div key={label}>
        <button
          onClick={onClick}
          disabled={disabled}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-inter transition-colors text-left ${
            active
              ? 'bg-[#1C2333] text-accent'
              : disabled
              ? 'text-[#3A4150] cursor-not-allowed'
              : 'text-[#8893A6] hover:text-cream hover:bg-[#151C28]'
          }`}
        >
          <span className={active ? 'text-accent' : disabled ? 'text-[#3A4150]' : 'text-[#5A6478]'}>
            {icon}
          </span>
          {label}
        </button>
        {sub}
      </div>
    )
  }

  function linkItem(label: string, icon: React.ReactNode, href: string) {
    const active = isActive(href)
    return (
      <Link
        key={label}
        href={href}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-inter transition-colors ${
          active
            ? 'bg-[#1C2333] text-accent'
            : 'text-[#8893A6] hover:text-cream hover:bg-[#151C28]'
        }`}
      >
        <span className={active ? 'text-accent' : 'text-[#5A6478]'}>{icon}</span>
        {label}
      </Link>
    )
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
    <aside className="w-[220px] shrink-0 bg-ink-1 border-r border-ink-3 flex flex-col h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#1C2333]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-canvas" />
          </div>
          <span className="font-playfair text-cream text-sm font-semibold">FlipBookPro</span>
        </Link>
        <div className="w-8 h-8 rounded-full bg-[#1C2333] border border-[#2A3448] flex items-center justify-center">
          <span className="text-xs font-inter font-semibold text-cream">{userInitials}</span>
        </div>
      </div>

      {/* Premium button */}
      <div className="px-3 pt-3 pb-1">
        {isPremium ? (
          <div className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-gold/15 text-gold text-xs font-inter font-medium border border-gold/20">
            <Crown className="w-3.5 h-3.5" />
            Premium Plan
          </div>
        ) : (
          <Link
            href="/settings/billing"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-gold hover:bg-gold/90 text-canvas text-xs font-inter font-semibold transition-colors"
          >
            <Crown className="w-3.5 h-3.5" />
            Upgrade to Premium
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {/* Dashboard */}
        {linkItem('Dashboard', <LayoutDashboard className="w-4 h-4" />, '/dashboard')}

        {/* Library */}
        <div>
          <button
            onClick={() => toggleSection('library')}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-inter font-medium text-[#5A6478] uppercase tracking-wider hover:text-[#8893A6] transition-colors"
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              Library
            </span>
            {open.library ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {open.library && (
            <div className="space-y-0.5 ml-1">
              {linkItem('Books', <BookOpen className="w-4 h-4" />, '/dashboard')}
              {linkItem('Media', <ImageIcon className="w-4 h-4" />, '/media')}
            </div>
          )}
        </div>

        {/* Build */}
        <div>
          <button
            onClick={() => toggleSection('build')}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-inter font-medium text-[#5A6478] uppercase tracking-wider hover:text-[#8893A6] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Palette className="w-3.5 h-3.5" />
              Build
            </span>
            {open.build ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {open.build && (
            <div className="space-y-0.5 ml-1">
              {/* Discover: shown when no book is open (disabled), or when book uses Creator Radar */}
              {(!bookContext || bookContext.hasDiscover) && navItem(
                'Discover',
                <Compass className="w-4 h-4" />,
                () => {},
                false,
                !bookContext || !bookContext.hasDiscover
              )}
              {navItem(
                'Outline',
                <AlignLeft className="w-4 h-4" />,
                () => gotoCoauthorStage('outline'),
                onCoauthorPath && buildStage === 'outline',
                !bookId
              )}

              {/* Setup steps */}
              <p className="px-3 pt-2 pb-0.5 text-[9px] font-inter font-medium text-[#3A4150] uppercase tracking-[0.14em]">
                Setup
              </p>
              {navItem('Details',  <FileText className="w-4 h-4" />,      () => gotoWizardStep(1), onWizardPath && activeWizardStep === 1, !bookId)}
              {navItem('Audience', <Users className="w-4 h-4" />,         () => gotoWizardStep(2), onWizardPath && activeWizardStep === 2, !bookId)}
              {navItem('Tone',     <MessageSquare className="w-4 h-4" />, () => gotoWizardStep(3), onWizardPath && activeWizardStep === 3, !bookId)}
              {navItem('Reader',   <Gauge className="w-4 h-4" />,         () => gotoWizardStep(4), onWizardPath && activeWizardStep === 4, !bookId)}

              {/* Theme steps */}
              <p className="px-3 pt-2 pb-0.5 text-[9px] font-inter font-medium text-[#3A4150] uppercase tracking-[0.14em]">
                Theme
              </p>
              {navItem('Illustrations', <Palette className="w-4 h-4" />,    () => gotoWizardStep(5), onWizardPath && activeWizardStep === 5, !bookId)}
              {navItem('Cover',         <BookMarked className="w-4 h-4" />, () => gotoWizardStep(6), onWizardPath && activeWizardStep === 6, !bookId)}
              {navItem('Typography',    <Type className="w-4 h-4" />,       () => gotoWizardStep(7), onWizardPath && activeWizardStep === 7, !bookId)}

              {/* Content stages */}
              <p className="px-3 pt-2 pb-0.5 text-[9px] font-inter font-medium text-[#3A4150] uppercase tracking-[0.14em]">
                Content
              </p>
              {navItem(
                'Chapters',
                <Layers className="w-4 h-4" />,
                () => gotoCoauthorStage('chapter'),
                onCoauthorPath && buildStage === 'chapter',
                !bookId,
                chapterList
              )}
              {navItem(
                'Review & Export',
                <Download className="w-4 h-4" />,
                () => gotoCoauthorStage('complete'),
                onCoauthorPath && (buildStage === 'complete' || buildStage === 'back-matter'),
                !bookId || (!!bookContext && !bookContext.allApproved)
              )}
            </div>
          )}
        </div>

        {/* Account */}
        <div>
          <button
            onClick={() => toggleSection('account')}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-inter font-medium text-[#5A6478] uppercase tracking-wider hover:text-[#8893A6] transition-colors"
          >
            <span className="flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              Account
            </span>
            {open.account ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {open.account && (
            <div className="space-y-0.5 ml-1">
              {linkItem('Profile', <User className="w-4 h-4" />, '/settings/profile')}
              {linkItem('Brand Profile', <Building2 className="w-4 h-4" />, '/settings/brand')}
              {linkItem('Billing', <CreditCard className="w-4 h-4" />, '/settings/billing')}
            </div>
          )}
        </div>

        {/* Support */}
        <div>
          <button
            onClick={() => toggleSection('support')}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-inter font-medium text-[#5A6478] uppercase tracking-wider hover:text-[#8893A6] transition-colors"
          >
            <span className="flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5" />
              Support
            </span>
            {open.support ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {open.support && (
            <div className="space-y-0.5 ml-1">
              {linkItem('Chat', <MessageCircle className="w-4 h-4" />, '/support/chat')}
              {linkItem('Feedback', <Star className="w-4 h-4" />, '/support/feedback')}
              {linkItem('FAQ', <HelpCircle className="w-4 h-4" />, '/support/faq')}
            </div>
          )}
        </div>

        {/* Admin — only rendered when caller passes isAdmin */}
        {isAdmin && (
          <div>
            <button
              onClick={() => toggleSection('admin')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-inter font-medium text-[#5A6478] uppercase tracking-wider hover:text-[#8893A6] transition-colors"
            >
              <span className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />
                Admin
              </span>
              {open.admin ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {open.admin && (
              <div className="space-y-0.5 ml-1">
                {linkItem('Dashboard', <BarChart3 className="w-4 h-4" />, '/admin')}
                {linkItem('Users', <User className="w-4 h-4" />, '/admin/users')}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Book cover section (only in book context) */}
      {bookContext && (
        <div className="px-3 pb-2 border-t border-[#1C2333] pt-3">
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

      {/* Sign out + footer */}
      <div className="px-3 py-3 border-t border-[#1C2333]">
        <form action={logout}>
          <button
            type="submit"
            className="w-full text-left px-3 py-1.5 text-xs font-inter text-[#5A6478] hover:text-cream transition-colors rounded-md hover:bg-[#151C28]"
          >
            Sign out
          </button>
        </form>
        <p className="text-[10px] text-[#3A4150] font-inter px-3 mt-2">© 2025 LaunchBox Media</p>
      </div>
    </aside>
  )
}
