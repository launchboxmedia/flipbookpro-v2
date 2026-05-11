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

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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
    // IMPORTANT: do NOT pass `noopener` / `noreferrer` in the features
    // string here. Chrome returns null for window.open() whenever the
    // features include `noopener`, which made the old version silently
    // open about:blank with nothing in it. We need a usable window
    // reference so we can write the document and trigger print().
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const titleEsc = esc(resource.resource_name)
    const typeEsc  = esc(TYPE_LABEL[resource.resource_type as ResourceMarker['type']] ?? resource.resource_type)
    // Reuse the modal's already-rendered markdown body — same renderer the
    // editor and public PDF appendix use, so the printable output stays
    // visually consistent with what the author sees in the modal.
    const bodyHtml = html

    const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${titleEsc}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:wght@400;600&family=Inter:wght@400;600&display=swap" rel="stylesheet" />
<style>
:root { --accent: #C9A84C; }
@page { size: A4; margin: 2.2cm 2.4cm; }
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: 'Source Serif 4', Georgia, serif;
  color: #1C2333;
  line-height: 1.65;
  max-width: 720px;
  margin: 40px auto;
  padding: 20px 24px;
  background: white;
}
.badge {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--accent);
  margin-bottom: 8px;
}
h1.title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.6rem;
  color: #1C2333;
  border-bottom: 2px solid var(--accent);
  padding-bottom: 8px;
  margin: 0 0 24px;
}
h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; color: #1C2333; }
h1 { font-size: 1.45rem; margin: 1.2rem 0 0.45rem; }
h2 { font-size: 1.18rem; margin: 1.1rem 0 0.4rem; }
h3 { font-size: 1.02rem; margin: 0.95rem 0 0.3rem; }
p { margin: 0 0 0.8rem; }
ul, ol { margin: 0 0 0.95rem 1.2rem; padding: 0; }
li { margin: 0.28rem 0; }
.resource-list { list-style: none; padding-left: 0; }
.resource-checkitem {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0.4rem 0;
  padding: 10px 12px;
  background: #FAF7F2;
  border-radius: 6px;
}
.resource-checkbox {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--accent);
  border-radius: 2px;
  margin-top: 2px;
  flex-shrink: 0;
}
.resource-checkbox.checked { background: var(--accent); }
.resource-fill { display: inline-block; min-width: 8rem; border-bottom: 1px solid var(--accent); }
.resource-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 10.5pt; }
.resource-table th { background: #FAF7F2; padding: 8px; text-align: left; border: 1px solid #EDE6D8; font-weight: 600; color: #1C2333; }
.resource-table td { padding: 8px; border: 1px solid #EDE6D8; }
strong { font-weight: 600; }
em { font-style: italic; }
hr { border: 0; border-top: 1px solid #EDE6D8; margin: 1.1rem 0; }
@media print {
  body { max-width: none; margin: 0; padding: 0; }
  *, *::before, *::after { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
<div class="badge">${typeEsc}</div>
<h1 class="title">${titleEsc}</h1>
${bodyHtml}
</body>
</html>`

    printWindow.document.open()
    printWindow.document.write(doc)
    printWindow.document.close()
    // Focus + delayed print from THIS window. Inline <script> inside the
    // document.write payload is unreliable across browsers (sometimes
    // stripped, sometimes deferred). Calling print() on the child window
    // reference here is the stable pattern.
    printWindow.focus()
    setTimeout(() => {
      try { printWindow.print() } catch { /* tab may have been closed */ }
    }, 500)
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
