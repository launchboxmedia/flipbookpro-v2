'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import { Zap } from 'lucide-react'

interface Props {
  /** AI requests remaining in the current rate-limit window. */
  remaining: number
  /** Window size, e.g. 60 (per hour). Used in the tooltip copy. */
  total: number
  /** When the window resets (epoch ms), shown in tooltip. */
  resetAt?: number | null
  className?: string
}

/**
 * Small inline pill that surfaces remaining AI calls. Goes amber at 30%,
 * red at 10%. Stays out of the way the rest of the time.
 */
export function RateLimitIndicator({ remaining, total, resetAt, className = '' }: Props) {
  const pct = total > 0 ? remaining / total : 1
  const tone = pct <= 0.1 ? 'red' : pct <= 0.3 ? 'amber' : 'normal'
  const colour =
    tone === 'red'   ? 'text-red-400 bg-red-500/10 border-red-500/30' :
    tone === 'amber' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                       'text-ink-subtle bg-ink-2 border-ink-3'

  const reset = resetAt ? new Date(resetAt) : null
  const resetCopy = reset
    ? `Resets at ${reset.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : 'Resets hourly'

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-inter ${colour} ${className}`}
        >
          <Zap className="w-2.5 h-2.5" />
          <span className="tabular-nums">{remaining}/{total}</span>
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          sideOffset={6}
          className="z-50 px-2.5 py-1.5 rounded-md bg-ink-2 border border-ink-3 text-xs font-inter text-cream shadow-lg animate-fade-in"
        >
          {remaining} of {total} AI requests remaining. {resetCopy}.
          <Tooltip.Arrow className="fill-ink-2" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
