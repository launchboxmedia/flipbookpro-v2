// Shared helpers for the Book Resources system.
//
//   1. `parseResourceMarkers` pulls `[[RESOURCE: Name | type]]` markers out
//      of chapter prose. Used by ChapterStage (writing surface) and by
//      retroactive extraction (Part 7).
//
//   2. `renderResourceMarkdown` is a tiny, dependency-free markdown→HTML
//      renderer scoped to what a generated resource actually contains:
//      headings, paragraphs, bulleted + numbered lists, `[ ]`/`[x]`
//      checkboxes, simple pipe tables, bold/italic, horizontal rules.
//      No links, no code blocks — generators are instructed not to emit
//      them, and we don't want stray HTML from the model to leak into
//      either the editor modal or the printed PDF.
//
// Both functions are pure and run safely in server routes and client
// components alike.

import type { BookResourceType } from '@/types/database'

const ALLOWED_TYPES = new Set<BookResourceType>([
  'checklist', 'template', 'script', 'matrix', 'workflow', 'swipe-file',
])

export interface ResourceMarker {
  name: string
  type: BookResourceType
}

export interface ParsedResourceMarkers {
  cleanContent: string
  markers: ResourceMarker[]
}

const MARKER_REGEX = /\[\[RESOURCE:\s*([^|\]]+?)\s*\|\s*([^\]]+?)\]\]/g

/** Pull `[[RESOURCE: Name | type]]` markers out of chapter content. Markers
 *  with an unknown type are dropped silently — the model occasionally
 *  emits typos like "checklists" — better to surface nothing than to
 *  render an unrecognised resource the author can't generate. */
export function parseResourceMarkers(content: string): ParsedResourceMarkers {
  const markers: ResourceMarker[] = []
  const seen = new Set<string>()
  // Use replaceAll-with-callback so we can collect markers and strip them
  // from the body in a single pass.
  const cleanContent = content.replace(MARKER_REGEX, (_match, rawName, rawType) => {
    const name = String(rawName).trim()
    const type = String(rawType).trim().toLowerCase() as BookResourceType
    if (!name || !ALLOWED_TYPES.has(type)) return ''
    // Dedupe by (name + type) so the same resource referenced twice in the
    // prose only renders one card.
    const key = `${type}::${name.toLowerCase()}`
    if (seen.has(key)) return ''
    seen.add(key)
    markers.push({ name, type })
    return ''
  })
  // The marker is usually on its own line — collapse the now-empty lines so
  // the chapter prose reads cleanly without a gap where the marker was.
  const collapsed = cleanContent.replace(/\n{3,}/g, '\n\n').trim()
  return { cleanContent: collapsed, markers }
}

/** The generator is instructed to put `# Title` at the top of every
 *  resource. When the surrounding chrome (modal header, appendix card,
 *  print page heading) already renders the title, the leading H1 is a
 *  duplicate. Use this to drop just the first H1 line, leaving the rest
 *  of the markdown untouched. */
export function stripLeadingTitle(content: string): string {
  return content.replace(/^\s*#\s+[^\n]+\n+/, '')
}

// ── Markdown renderer ──────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Inline transforms applied to already-escaped text: bold, italic, and the
 *  long underscore "fill-in" sequence (which we render as a styled blank). */
function renderInline(escaped: string): string {
  let out = escaped
  // Fill-in field — 3+ underscores. Render as a thin gold rule.
  out = out.replace(/_{3,}/g, '<span class="resource-fill">&nbsp;</span>')
  // Bold (**…**)
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // Italic (*…*) — only when not adjacent to another asterisk (to avoid
  // colliding with the bold pattern above)
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  return out
}

function parseTableRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return inner.split('|').map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  // | --- | :---: | ---: |
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.trim())
}

/** Render a generated resource's markdown to HTML for the editor modal and
 *  the PDF export appendix. Intentionally minimal — only the constructs the
 *  generator is told to emit. Anything unsupported is rendered as a
 *  paragraph rather than dropped, so no content is silently lost. */
export function renderResourceMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      out.push(`<h${level}>${renderInline(escapeHtml(h[2].trim()))}</h${level}>`)
      i++
      continue
    }

    // Horizontal rule
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) {
      out.push('<hr />')
      i++
      continue
    }

    // Table — header row followed by a separator row of dashes/colons.
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(parseTableRow(lines[i]))
        i++
      }
      const thead = `<thead><tr>${headers.map((c) => `<th>${renderInline(escapeHtml(c))}</th>`).join('')}</tr></thead>`
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${renderInline(escapeHtml(c))}</td>`).join('')}</tr>`)
        .join('')}</tbody>`
      out.push(`<table class="resource-table">${thead}${tbody}</table>`)
      continue
    }

    // Unordered list (including `[ ]` / `[x]` checkboxes)
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const raw = lines[i].replace(/^\s*[-*+]\s+/, '')
        const checkbox = raw.match(/^\[(\s|x|X)\]\s*(.*)$/)
        if (checkbox) {
          const checked = checkbox[1].toLowerCase() === 'x'
          const body = renderInline(escapeHtml(checkbox[2]))
          items.push(`<li class="resource-checkitem"><span class="resource-checkbox${checked ? ' checked' : ''}" aria-hidden="true"></span><span>${body}</span></li>`)
        } else {
          items.push(`<li>${renderInline(escapeHtml(raw))}</li>`)
        }
        i++
      }
      out.push(`<ul class="resource-list">${items.join('')}</ul>`)
      continue
    }

    // Ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        const raw = lines[i].replace(/^\s*\d+[.)]\s+/, '')
        items.push(`<li>${renderInline(escapeHtml(raw))}</li>`)
        i++
      }
      out.push(`<ol class="resource-list">${items.join('')}</ol>`)
      continue
    }

    // Blank line — paragraph separator
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph — accumulate consecutive non-empty, non-block lines.
    const para: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^\s*[-*+]\s/.test(lines[i]) &&
      !/^\s*\d+[.)]\s/.test(lines[i]) &&
      !/^\s*(?:---+|\*\*\*+)\s*$/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      para.push(lines[i])
      i++
    }
    out.push(`<p>${renderInline(escapeHtml(para.join(' ').trim()))}</p>`)
  }

  return out.join('\n')
}

// ── Retroactive extraction heuristics ──────────────────────────────────────
// Used by Part 7 to flag approved chapters that probably contain inline
// resources the author could lift out into the downloads system. Detecting
// these is intentionally permissive — false positives just surface an
// optional "Extract Resources" banner; false negatives just mean the
// banner doesn't appear.

const CHECKBOX_LINE_REGEX = /^\s*[-*+]?\s*\[[\sxX]\]\s/m
const TABLE_LINE_REGEX    = /^\s*\|.+\|.*\n\s*\|?\s*:?-{3,}/m
// Case-sensitive — the signal is "a deliberate ALL-CAPS section heading",
// not the prose words "checklist" / "workflow" / "template" used in normal
// sentences. The `/i` form fired on ordinary writing and was unreliable.
const LABEL_REGEX         = /\b(CHECKLIST|TEMPLATE|SCRIPT|MATRIX|WORKFLOW|SWIPE\s*FILE)\b/
const BULLET_BLOCK_REGEX  = /(?:^|\n)\s*[-*+]\s+.+(?:\n\s*[-*+]\s+.+){3,}/m
// Imperative-question cluster — catches checklist-style prose where the
// author wrote the items as flowing questions instead of bullets. Example
// from the TikTok book compliance chapter:
//   "Does the video name a specific loan amount…? Does anything in the
//    script imply approval odds…?"
// Picks up at least two consecutive sentences that start with a yes/no
// auxiliary and end in "?". Real bullet-formatted checklists are caught
// by CHECKBOX_LINE / BULLET_BLOCK; this fills in the gap when the author
// wrote the same content as prose.
const IMPERATIVE_QUESTION_REGEX = /(Does|Is|Are|Have|Can|Did)[^.!]*\?[^.!]*\n.*?(Does|Is|Are|Have|Can|Did)/

/** Heuristic for "this approved chapter probably has inline resource
 *  content". Returns true when the body has any of:
 *   - a `[ ]` / `[x]` checkbox-style bullet
 *   - a pipe table
 *   - an ALL-CAPS section label naming a resource type
 *   - a 4+ item bullet run that looks like a checklist
 *   - a cluster of imperative questions (prose-style checklist)
 *  Cheap to compute; runs on every approved chapter render. */
export function hasInlineResourceSignals(content: string | null | undefined): boolean {
  if (!content) return false
  if (CHECKBOX_LINE_REGEX.test(content))       return true
  if (TABLE_LINE_REGEX.test(content))          return true
  if (LABEL_REGEX.test(content))               return true
  if (BULLET_BLOCK_REGEX.test(content))        return true
  if (IMPERATIVE_QUESTION_REGEX.test(content)) return true
  return false
}
