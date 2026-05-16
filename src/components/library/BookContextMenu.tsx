'use client'

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Eye, Globe, Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteBook } from '@/app/dashboard/actions'
import type { BookWithMeta } from './types'

interface BookContextMenuProps {
  book: BookWithMeta
  children: ReactNode
}

// Shared menu-item recipe. NOTE: the brief specified `light:` Tailwind
// variants — Tailwind has no `light:` (this project is darkMode:'class',
// so the convention is light = base class, dark = `dark:`). These are
// the faithful equivalents: ink text / cream hover in light, white /
// ink in dark.
const ITEM =
  'flex items-center gap-3 px-3 py-2 text-sm cursor-pointer w-full text-left ' +
  'text-ink-1/80 dark:text-white/80 hover:bg-cream-2 dark:hover:bg-ink-2 ' +
  'transition-colors duration-150 rounded-lg'

const DIVIDER = 'h-px bg-cream-3 dark:bg-ink-3 my-1'

/** Right-click context menu shared by all three Library view modes
 *  (shelf / grid / list). Wraps its children in a `display:contents`
 *  div so it adds the contextmenu handler without inserting a box that
 *  would disturb the shelf flex / grid / list layout — the popup and
 *  modal are position:fixed so they never affect flow. */
export function BookContextMenu({ book, children }: BookContextMenuProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const landingUrl = `https://go.bookbuilderpro.app/${book.slug}`
  const canShare = !!book.slug && book.isPublished

  // Close the menu on any outside click or Escape while it's open.
  useEffect(() => {
    if (!isOpen) return
    function close() { setIsOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setIsOpen(false) }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  // Escape also dismisses the confirm modal (a11y baseline; the rest of
  // the app's modals do this).
  useEffect(() => {
    if (!showDeleteModal) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setShowDeleteModal(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showDeleteModal])

  function openMenu(e: MouseEvent) {
    e.preventDefault()
    setPosition({ x: e.clientX, y: e.clientY })
    setIsOpen(true)
  }

  function go(path: string) {
    setIsOpen(false)
    router.push(path)
  }

  function openTab(url: string) {
    setIsOpen(false)
    window.open(url, '_blank')
  }

  async function copyLink() {
    setIsOpen(false)
    try {
      await navigator.clipboard.writeText(landingUrl)
      toast.success('Copied!')
    } catch {
      toast.error('Could not copy link')
    }
  }

  async function handleDelete() {
    await deleteBook(book.id)
    setShowDeleteModal(false)
    router.refresh()
    toast.success('Book deleted')
  }

  return (
    <div className="contents" onContextMenu={openMenu}>
      {children}

      {isOpen && (
        <div
          className="fixed z-[9999] bg-white dark:bg-ink-1 border border-cream-3 dark:border-ink-3 rounded-xl shadow-2xl p-1 min-w-[180px] animate-scale-in"
          style={{ left: position.x, top: position.y }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          <button type="button" role="menuitem" className={ITEM} onClick={() => go(`/book/${book.id}/coauthor`)}>
            <ExternalLink className="w-4 h-4" />
            Open
          </button>
          <button type="button" role="menuitem" className={ITEM} onClick={() => openTab(`/book/${book.id}/preview`)}>
            <Eye className="w-4 h-4" />
            Preview
          </button>

          <div className={DIVIDER} />

          <button
            type="button"
            role="menuitem"
            disabled={!canShare}
            className={`${ITEM} ${!canShare ? 'opacity-40 cursor-not-allowed' : ''}`}
            onClick={() => { if (canShare) openTab(landingUrl) }}
          >
            <Globe className="w-4 h-4" />
            View Landing Page
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canShare}
            className={`${ITEM} ${!canShare ? 'opacity-40 cursor-not-allowed' : ''}`}
            onClick={() => { if (canShare) void copyLink() }}
          >
            <Copy className="w-4 h-4" />
            Copy Link
          </button>

          <div className={DIVIDER} />

          <button
            type="button"
            role="menuitem"
            className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer w-full text-left text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors duration-150 rounded-lg"
            onClick={() => { setIsOpen(false); setShowDeleteModal(true) }}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}

      {showDeleteModal && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[9998] backdrop-blur-sm"
            onClick={() => setShowDeleteModal(false)}
            aria-hidden="true"
          />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] bg-white dark:bg-ink-2 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 animate-scale-in"
            role="dialog"
            aria-modal="true"
            aria-label="Delete book confirmation"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="w-12 h-12 text-red-400 mb-4 mx-auto" />
            <h2 className="font-playfair text-xl font-semibold text-ink-1 dark:text-white mb-3 text-center">
              Delete this book?
            </h2>
            <p className="text-ink-1/60 dark:text-white/50 text-sm text-center mb-6 font-source-serif">
              “{book.title}” and all its chapters, images, and resources will
              be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-cream-2 dark:bg-ink-3 text-ink-1 dark:text-white rounded-xl py-3 font-medium hover:bg-cream-3 dark:hover:bg-ink-4 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-semibold transition-colors active:scale-[0.98]"
              >
                Delete Book
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
