'use client'

import { useState } from 'react'

interface Props {
  /** Full URL to copy to the clipboard. Composed by the caller so dev,
   *  preview, and production environments each get the right origin. */
  url: string
  /** When true, the button uses larger padding and a gold pulse halo.
   *  Used to call attention to the share action on a published book that
   *  hasn't picked up any readers yet. */
  prominent?: boolean
}

export function CopyLinkButton({ url, prominent = false }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        ok = true
      }
    } catch {
      ok = false
    }
    // execCommand fallback for HTTP contexts / older browsers where the async
    // Clipboard API is unavailable or rejected. Hidden textarea avoids any
    // visible flash during the selection.
    if (!ok) {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      ta.style.pointerEvents = 'none'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); ok = true } catch { ok = false }
      document.body.removeChild(ta)
    }
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  // Size + pulse are tied together — the prominent variant scales padding and
  // text up a notch and gains the pulse halo. The pulse pauses once copied so
  // the user gets a clean confirmation moment, then resumes (the user usually
  // navigates away long before that matters).
  const sizing = prominent ? 'px-4 py-2.5 text-sm' : 'px-3 py-2 text-sm'
  const pulse = prominent && !copied ? 'pulse-ring' : ''

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'Link copied' : `Copy link to ${url}`}
      className={`border border-gold/40 text-gold font-inter rounded-lg hover:border-gold hover:bg-gold/10 transition-colors duration-220 whitespace-nowrap ${sizing} ${pulse}`}
    >
      {copied ? 'Copied ✓' : 'Copy Link'}
    </button>
  )
}
