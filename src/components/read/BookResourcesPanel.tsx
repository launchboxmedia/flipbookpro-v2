'use client'

import { useEffect, useMemo, useState } from 'react'
import { Paperclip, X, Download } from 'lucide-react'
import type { BookResource } from '@/types/database'

interface ChapterTitle {
  chapter_index: number
  chapter_title: string
}

interface Props {
  slug: string
  resources: BookResource[]
  /** Chapter titles keyed by chapter_index so the panel can label each
   *  group with the chapter's real name instead of "Chapter N". */
  chapterTitles: ChapterTitle[]
}

const TYPE_LABEL: Record<BookResource['resource_type'], string> = {
  'checklist':  'Checklist',
  'template':   'Template',
  'script':     'Script',
  'matrix':     'Matrix',
  'workflow':   'Workflow',
  'swipe-file': 'Swipe File',
}

interface ChapterGroup {
  chapterIndex: number
  title:        string
  items:        BookResource[]
}

/** Floating "Resources" button + slide-out panel anchored to the bottom-
 *  right of the public flipbook view. Renders nothing when the book has no
 *  resources, so it adds no visual weight to books that never adopted the
 *  feature. Each row is a link to /read/[slug]/r/[id] which returns a
 *  print-ready HTML document for that single resource. */
export function BookResourcesPanel({ slug, resources, chapterTitles }: Props) {
  const [open, setOpen] = useState(false)

  // Close on Escape, mirroring the FlipbookViewer dialog conventions.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const groups = useMemo<ChapterGroup[]>(() => {
    if (resources.length === 0) return []
    const byChapter = new Map<number, BookResource[]>()
    for (const r of resources) {
      const arr = byChapter.get(r.chapter_index) ?? []
      arr.push(r)
      byChapter.set(r.chapter_index, arr)
    }
    const titleByIdx = new Map(chapterTitles.map((c) => [c.chapter_index, c.chapter_title]))
    return Array.from(byChapter.entries())
      .sort(([a], [b]) => a - b)
      .map(([chapterIndex, items]) => ({
        chapterIndex,
        title: titleByIdx.get(chapterIndex) ?? `Chapter ${chapterIndex + 1}`,
        items: items
          .slice()
          .sort((a, b) => a.resource_name.localeCompare(b.resource_name)),
      }))
  }, [resources, chapterTitles])

  if (groups.length === 0) return null

  const totalCount = resources.length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open chapter resources — ${totalCount} available`}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 pl-4 pr-3 py-3 rounded-full bg-gold hover:bg-gold-soft text-ink-1 font-inter font-semibold shadow-[0_12px_32px_-8px_rgba(201,168,76,0.6)] hover:shadow-[0_14px_38px_-8px_rgba(201,168,76,0.75)] transition-all"
      >
        <Paperclip className="w-4 h-4" />
        <span className="text-sm">Resources</span>
        <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-ink-1 text-gold text-[11px] font-bold tabular-nums">
          {totalCount}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Book resources"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full sm:max-w-md max-h-[88vh] sm:my-6 sm:mr-6 bg-[#151C28] border border-[#2A3448] rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-[#2A3448] bg-[#0F1623]">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-gold" />
                <p className="font-inter font-semibold text-cream-1 text-sm tracking-wide uppercase">
                  Book Resources
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-cream-1/50 hover:text-cream-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <p className="px-5 py-3 text-xs font-source-serif text-cream-1/55 border-b border-[#2A3448]">
              Working documents referenced in the book. Each opens in a new tab — use your browser&rsquo;s print dialog and choose &ldquo;Save as PDF&rdquo;.
            </p>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {groups.map((group) => (
                <section key={group.chapterIndex}>
                  <p className="text-[10px] font-inter font-semibold uppercase tracking-[0.2em] text-gold-dim mb-2">
                    Chapter {group.chapterIndex + 1} · {group.title}
                  </p>
                  <ul className="space-y-1.5">
                    {group.items.map((r) => (
                      <li key={r.id}>
                        <a
                          href={`/read/${slug}/r/${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-[#1C2333] hover:bg-[#2A3448] border border-[#2A3448] hover:border-gold/40 transition-colors"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10px] font-inter font-semibold uppercase tracking-[0.18em] text-gold mb-0.5">
                              {TYPE_LABEL[r.resource_type] ?? r.resource_type}
                            </span>
                            <span className="block text-sm font-source-serif text-cream-1 leading-snug truncate">
                              {r.resource_name}
                            </span>
                          </span>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-inter text-cream-1/60 group-hover:text-gold">
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
