'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, ZoomIn } from 'lucide-react'

interface OverlayProps {
  src: string
  alt: string
  open: boolean
  onClose: () => void
}

/**
 * Pure overlay — caller controls open state. Used when a trigger button
 * would clash with other interactive controls in the same area (e.g. the
 * cover thumbnail's regen/upload icons).
 */
export function ImageLightboxOverlay({ src, alt, open, onClose }: OverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const lastFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    lastFocused.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      lastFocused.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6"
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X className="w-5 h-5" />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element -- lightbox needs raw <img> for arbitrary sources */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[95vw] max-h-[95vh] w-auto h-auto rounded-md shadow-2xl object-contain"
      />
    </div>
  )
}

interface TriggerProps {
  src: string
  alt: string
  /** What to render as the clickable thumbnail (typically an <img> or a div). */
  children: React.ReactNode
  triggerClassName?: string
}

/**
 * Self-contained click-to-enlarge wrapper. Use this when the image has no
 * other overlaid controls. For images with siblings (regen, upload, etc.),
 * use ImageLightboxOverlay with your own open-state.
 */
export function ImageLightbox({ src, alt, children, triggerClassName }: TriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View enlarged: ${alt}`}
        className={
          triggerClassName ??
          'group relative block w-full text-left cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md'
        }
      >
        {children}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity rounded-md"
        >
          <ZoomIn className="w-5 h-5 text-cream" />
        </span>
      </button>

      <ImageLightboxOverlay src={src} alt={alt} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
