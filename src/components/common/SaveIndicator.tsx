'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, Cloud, CloudOff, Loader2 } from 'lucide-react'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

interface Props {
  status: SaveStatus
  /** Optional last-saved timestamp for the idle/saved tooltip. */
  lastSavedAt?: number | null
  /** Compact tone for cream surfaces (e.g. coauthor manuscript). */
  tone?: 'dark' | 'light'
  className?: string
}

const META: Record<SaveStatus, { label: string; icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  idle:    { label: 'All changes saved', icon: Check,      tint: 'text-ink-muted' },
  pending: { label: 'Edits pending',     icon: Cloud,      tint: 'text-ink-subtle' },
  saving:  { label: 'Saving…',           icon: Loader2,    tint: 'text-gold' },
  saved:   { label: 'Saved',             icon: Check,      tint: 'text-emerald-500' },
  error:   { label: 'Failed to save',    icon: CloudOff,   tint: 'text-red-400' },
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts
  if (diff < 5_000) return 'just now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function SaveIndicator({ status, lastSavedAt, tone = 'dark', className = '' }: Props) {
  const meta = META[status]
  const Icon = meta.icon
  const dim = tone === 'light' ? 'text-ink-1/60' : 'text-ink-muted'
  const isSaving = status === 'saving'

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={`inline-flex items-center gap-1.5 text-[11px] font-inter ${meta.tint} ${className}`}
        aria-live="polite"
      >
        <Icon className={`w-3 h-3 ${isSaving ? 'animate-spin' : ''}`} />
        <span>{meta.label}</span>
        {(status === 'idle' || status === 'saved') && lastSavedAt && (
          <span className={`${dim} font-normal`}> · {relativeTime(lastSavedAt)}</span>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
