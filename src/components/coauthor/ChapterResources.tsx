'use client'

import { useEffect, useMemo, useState } from 'react'
import { Paperclip, Loader2, FileText, Check, RefreshCw, Eye, X, Copy, Printer } from 'lucide-react'
import type { BookResource } from '@/types/database'
import {
  parseResourceMarkers,
  renderResourceMarkdown,
  stripLeadingTitle,
  type ResourceMarker,
} from '@/lib/resources'

interface Props {
  bookId: string
  chapterIndex: number
  /** Latest chapter draft text. Re-parsed on change to keep the card list
   *  in sync with what the author actually has in the manuscript. */
  draft: string
  /** Resources already generated for this chapter. May be empty. */
  existingResources: BookResource[]
  /** Bubble new / regenerated resources back up so the parent can keep its
   *  state in sync without a refetch. */
  onResourceUpserted: (resource: BookResource) => void
}

interface PendingState {
  generating: boolean
  error: string | null
}

// Resource type → label + colour scheme. Subset of the gold accent system —
// these badges sit on ink-3 cards and read as small, distinct tags.
const TYPE_LABEL: Record<ResourceMarker['type'], string> = {
  'checklist':  'Checklist',
  'template':   'Template',
  'script':     'Script',
  'matrix':     'Matrix',
  'workflow':   'Workflow',
  'swipe-file': 'Swipe File',
}

const PREVIEW_CHAR_LIMIT = 200

export function ChapterResources({
  bookId, chapterIndex, draft, existingResources, onResourceUpserted,
}: Props) {
  const { markers } = useMemo(() => parseResourceMarkers(draft || ''), [draft])

  // Per-marker pending state, keyed by `${type}::${name.toLowerCase()}`.
  // Same key shape parseResourceMarkers uses internally for dedupe.
  const [pending, setPending] = useState<Record<string, PendingState>>({})
  const [openResource, setOpenResource] = useState<BookResource | null>(null)

  // When the user moves to another chapter, drop in-flight indicators so a
  // late-arriving response can't toggle a different chapter's buttons.
  useEffect(() => {
    setPending({})
    setOpenResource(null)
  }, [chapterIndex])

  if (markers.length === 0) return null

  function keyFor(m: ResourceMarker): string {
    return `${m.type}::${m.name.toLowerCase()}`
  }

  function findExisting(m: ResourceMarker): BookResource | undefined {
    return existingResources.find(
      (r) =>
        r.chapter_index === chapterIndex &&
        r.resource_type === m.type &&
        r.resource_name.toLowerCase() === m.name.toLowerCase(),
    )
  }

  async function generate(marker: ResourceMarker) {
    const key = keyFor(marker)
    setPending((p) => ({ ...p, [key]: { generating: true, error: null } }))
    try {
      const res = await fetch(`/api/books/${bookId}/generate-resource`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterIndex,
          resourceName: marker.name,
          resourceType: marker.type,
          chapterContent: draft,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Generation failed (${res.status})`)

      // The route returns a partial; rebuild a BookResource for parent state.
      const upserted: BookResource = {
        id:            json.id,
        book_id:       bookId,
        chapter_index: typeof json.chapterIndex === 'number' ? json.chapterIndex : chapterIndex,
        resource_name: json.resource_name,
        resource_type: json.resource_type,
        content:       json.content,
        // The route returns the latest content but not the timestamps; the
        // parent only displays these in the modal copy of the resource and
        // we have a real value the next time we refetch. Filler timestamps
        // are fine here — the column is server-authoritative.
        created_at:    new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      }
      onResourceUpserted(upserted)
      setPending((p) => ({ ...p, [key]: { generating: false, error: null } }))
    } catch (e) {
      setPending((p) => ({
        ...p,
        [key]: { generating: false, error: e instanceof Error ? e.message : 'Generation failed' },
      }))
    }
  }

  return (
    <>
      <div className="mb-6 bg-ink-2 border border-ink-3 rounded-xl p-4 text-cream-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2 mb-2">
          <Paperclip className="w-4 h-4 text-gold" />
          <p className="font-inter font-semibold text-cream-1 text-sm tracking-wide uppercase">
            Chapter Resources
          </p>
        </div>
        <p className="text-xs font-source-serif text-cream-1/60 mb-4 leading-relaxed">
          These resources were referenced in this chapter. Generate them to make them available to your readers.
        </p>

        <div className="space-y-2">
          {markers.map((marker) => {
            const key = keyFor(marker)
            const state = pending[key] ?? { generating: false, error: null }
            const existing = findExisting(marker)
            return (
              <div
                key={key}
                className="bg-ink-3 border border-ink-4 rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {existing ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-gold/80 shrink-0" />
                      )}
                      <span className="text-[10px] font-inter font-semibold uppercase tracking-[0.18em] text-gold">
                        {TYPE_LABEL[marker.type]}
                      </span>
                      {existing && (
                        <span className="text-[10px] font-inter text-emerald-400/80 lowercase">
                          generated
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-source-serif text-cream-1 leading-snug">
                      {marker.name}
                    </p>
                    {existing && (
                      <p className="text-[11px] font-source-serif text-cream-1/55 mt-1 line-clamp-2">
                        {existing.content.replace(/^#\s*.*\n+/, '').slice(0, PREVIEW_CHAR_LIMIT)}
                        {existing.content.length > PREVIEW_CHAR_LIMIT ? '…' : ''}
                      </p>
                    )}
                    {state.error && (
                      <p className="text-[11px] font-inter text-rose-300 mt-1.5">{state.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {existing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setOpenResource(existing)}
                          className="flex items-center gap-1 text-[11px] font-inter text-gold hover:text-gold-soft transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => generate(marker)}
                          disabled={state.generating}
                          className="flex items-center gap-1 text-[11px] font-inter text-cream-1/60 hover:text-cream-1 transition-colors disabled:opacity-50"
                        >
                          {state.generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Regenerate
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => generate(marker)}
                        disabled={state.generating}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gold/50 hover:border-gold text-gold hover:text-gold-soft text-[11px] font-inter transition-colors disabled:opacity-50"
                      >
                        {state.generating ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Generating…
                          </>
                        ) : (
                          <>
                            Generate Resource
                            <span aria-hidden>→</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {openResource && (
        <ResourceModal
          resource={openResource}
          onClose={() => setOpenResource(null)}
        />
      )}
    </>
  )
}

// ── View modal ──────────────────────────────────────────────────────────────
// Shows the rendered resource with Copy + Download as PDF actions. "Download
// as PDF" opens a new window with print-only styling and triggers
// `window.print()` — same approach as /api/books/[id]/export-pdf, just on a
// single resource instead of the full book.

function ResourceModal({
  resource,
  onClose,
}: {
  resource: BookResource
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  // Strip the leading `# Title` line — the modal header already shows the
  // resource name, so re-rendering it as an H1 would be a duplicate.
  const html = useMemo(
    () => renderResourceMarkdown(stripLeadingTitle(resource.content)),
    [resource.content],
  )

  // Trap Escape to close the modal so it behaves like a standard dialog.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copy() {
    try {
      await navigator.clipboard.writeText(resource.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Older browsers without the Async Clipboard API. Best-effort —
      // silently no-op; the print/download action still works.
    }
  }

  function downloadPdf() {
    const win = window.open('', '_blank', 'noopener,noreferrer')
    if (!win) return
    const titleEsc = resource.resource_name
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
    const css = `
      @page { size: A4; margin: 2.2cm 2.4cm; }
      :root { --accent: #C9A84C; }
      * { box-sizing: border-box; }
      body { font-family: 'Source Serif 4', Georgia, serif; color: #1A1A1A; line-height: 1.65; font-size: 11.5pt; margin: 0; padding: 0; background: white; }
      h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 1.8rem; margin: 0 0 0.4rem; }
      h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 1.3rem; margin: 1.4rem 0 0.4rem; }
      h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 1.05rem; margin: 1.1rem 0 0.3rem; }
      .badge { display: inline-block; font-family: 'Inter', system-ui, sans-serif; font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); margin: 0 0 1.2rem; }
      p { margin: 0 0 0.8rem; }
      ul, ol { margin: 0 0 1rem 1.2rem; padding: 0; }
      li { margin: 0.25rem 0; }
      .resource-list { list-style: none; padding-left: 0; }
      .resource-checkitem { display: flex; align-items: flex-start; gap: 0.5rem; }
      .resource-checkbox { display: inline-block; width: 0.8rem; height: 0.8rem; border: 1.5px solid #1A1A1A; border-radius: 2px; margin-top: 0.3rem; }
      .resource-checkbox.checked { background: var(--accent); border-color: var(--accent); }
      .resource-fill { display: inline-block; min-width: 9rem; border-bottom: 1px solid var(--accent); }
      .resource-table { width: 100%; border-collapse: collapse; margin: 0.8rem 0 1.2rem; }
      .resource-table th, .resource-table td { border: 1px solid rgba(0,0,0,0.18); padding: 0.4rem 0.55rem; text-align: left; font-size: 10.5pt; }
      .resource-table th { background: rgba(201,168,76,0.12); color: #111; }
      hr { border: 0; border-top: 1px solid rgba(0,0,0,0.18); margin: 1.2rem 0; }
      .print-banner { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); background: #1A1A1A; color: #F5F0E8; padding: 10px 14px; border-radius: 6px; font-family: 'Inter', system-ui, sans-serif; font-size: 12px; display: flex; align-items: center; gap: 10px; }
      .print-banner button { background: #C9A84C; color: #111; border: 0; padding: 5px 10px; border-radius: 4px; font: inherit; font-weight: 600; cursor: pointer; }
      @media print { .print-banner { display: none; } }
    `
    const doc = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><title>${titleEsc}</title><link rel="preconnect" href="https://fonts.googleapis.com" /><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:wght@400;600&family=Inter:wght@400;600&display=swap" rel="stylesheet" /><style>${css}</style></head><body><div class="print-banner"><span>Use the print dialog and choose Save as PDF.</span><button onclick="window.print()">Print</button></div><div class="badge">${titleEsc.toUpperCase()}</div><h1>${titleEsc}</h1>${html}<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)})</script></body></html>`
    win.document.open()
    win.document.write(doc)
    win.document.close()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Resource: ${resource.resource_name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-1/80 backdrop-blur-sm px-4 py-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[88vh] bg-cream-1 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-cream-3 bg-cream-2">
          <div className="min-w-0">
            <p className="text-[10px] font-inter font-semibold uppercase tracking-[0.2em] text-gold-dim mb-1">
              {TYPE_LABEL[resource.resource_type as ResourceMarker['type']] ?? resource.resource_type}
            </p>
            <h2 className="font-playfair text-xl text-ink-1 leading-tight truncate">
              {resource.resource_name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-1/50 hover:text-ink-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div
          className="flex-1 overflow-y-auto px-6 py-5 resource-body"
          // eslint-disable-next-line react/no-danger -- output is the result of
          // an in-house renderer that escapes every user-supplied string.
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <footer className="flex items-center justify-end gap-2 px-6 py-3 border-t border-cream-3 bg-cream-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cream-3 hover:bg-cream-3/80 text-ink-1 text-xs font-inter rounded-md transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink-1 hover:bg-ink-2 text-cream text-xs font-inter rounded-md transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Download as PDF
          </button>
        </footer>
      </div>

      {/* Scoped styles for the markdown body so the modal renders the renderer's
          output without leaking into the rest of the app. */}
      <style jsx>{`
        .resource-body :global(h1) { font-family: var(--font-playfair, 'Playfair Display'), Georgia, serif; font-size: 1.5rem; margin: 0 0 0.5rem; color: #1A1A1A; }
        .resource-body :global(h2) { font-family: var(--font-playfair, 'Playfair Display'), Georgia, serif; font-size: 1.15rem; margin: 1.1rem 0 0.4rem; color: #1A1A1A; }
        .resource-body :global(h3) { font-family: var(--font-playfair, 'Playfair Display'), Georgia, serif; font-size: 1rem;    margin: 0.9rem 0 0.3rem; color: #1A1A1A; }
        .resource-body :global(p)  { font-family: var(--font-source-serif, 'Source Serif 4'), Georgia, serif; color: #1A1A1A; font-size: 0.9rem; line-height: 1.65; margin: 0 0 0.7rem; }
        .resource-body :global(ul), .resource-body :global(ol) { margin: 0 0 0.9rem 1.1rem; padding: 0; font-family: var(--font-source-serif, 'Source Serif 4'), Georgia, serif; color: #1A1A1A; font-size: 0.9rem; }
        .resource-body :global(.resource-list) { list-style: none; padding-left: 0; }
        .resource-body :global(.resource-checkitem) { display: flex; align-items: flex-start; gap: 0.5rem; margin: 0.3rem 0; }
        .resource-body :global(.resource-checkbox) { display: inline-block; width: 0.85rem; height: 0.85rem; border: 1.5px solid #1A1A1A; border-radius: 2px; margin-top: 0.25rem; flex-shrink: 0; }
        .resource-body :global(.resource-checkbox.checked) { background: #C9A84C; border-color: #C9A84C; }
        .resource-body :global(.resource-fill) { display: inline-block; min-width: 7rem; border-bottom: 1px solid #C9A84C; }
        .resource-body :global(.resource-table) { width: 100%; border-collapse: collapse; margin: 0.7rem 0 1.1rem; font-family: var(--font-source-serif, 'Source Serif 4'), Georgia, serif; font-size: 0.85rem; }
        .resource-body :global(.resource-table th), .resource-body :global(.resource-table td) { border: 1px solid #EDE6D8; padding: 0.45rem 0.55rem; text-align: left; }
        .resource-body :global(.resource-table th) { background: rgba(201,168,76,0.1); color: #1A1A1A; font-weight: 600; }
        .resource-body :global(hr) { border: 0; border-top: 1px solid #EDE6D8; margin: 1rem 0; }
        .resource-body :global(strong) { color: #1A1A1A; font-weight: 600; }
        .resource-body :global(em)     { color: #1A1A1A; font-style: italic; }
      `}</style>
    </div>
  )
}
