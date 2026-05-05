/**
 * Client-only DOM-measurement-based pagination.
 *
 * The heuristic word-budget paginator (paginateText.ts) is a coarse
 * approximation that occasionally clips the bottom line of a page when:
 *   - The active typography theme has a larger body-size or line-height
 *     than the calibration assumes
 *   - A paragraph contains an unusually long word that bumps line wraps
 *   - The first chunk's heading wraps to two lines (eats more chrome than
 *     the budget assumes)
 *
 * This module mounts an off-screen measurer mirroring the rendered body
 * container's exact width/typography, then sentence-by-sentence builds
 * each page until adding another sentence would overflow. The result is
 * an array of chunks where each chunk is guaranteed to fit by
 * pixel-measured rendered height — no clipping.
 *
 * Pure DOM API; do NOT call from the server. The viewer falls back to the
 * heuristic paginator for SSR and re-paginates after mount.
 */

interface PaginateMeasuredOptions {
  /** Inner content width in CSS pixels (page width minus side padding). */
  bodyWidth: number
  /** Available body height in pixels for the FIRST chunk of a chapter
   *  (smaller because the chapter title + accent rule + label header eats
   *  vertical space). */
  firstPageHeight: number
  /** Available body height in pixels for continuation chunks (compact
   *  one-line header, more room for prose). */
  continuationHeight: number
  /** Body font family — same value the renderer applies to the chapter
   *  body container. Pulled from the active theme's --body-font. */
  fontFamily: string
  /** Body font size with units (e.g. "13px"). */
  fontSize: string
  /** Body line height (unitless or with units). */
  lineHeight: string
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]!))
}

/** Heuristic sentence splitter — same regex shape as paginateText so the
 *  measurer's chunk boundaries align with the renderer's prose flow. */
function splitSentences(text: string): string[] {
  const out: string[] = []
  const re = /[^.!?]+[.!?]+["'”’]?(?=\s+|$)/g
  let match: RegExpExecArray | null
  let lastIndex = 0
  while ((match = re.exec(text)) !== null) {
    const piece = match[0].trim()
    if (piece) out.push(piece)
    lastIndex = re.lastIndex
  }
  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex).trim()
    if (tail) out.push(tail)
  }
  return out.length > 0 ? out : [text]
}

/**
 * Splits content into page-sized chunks by measuring rendered height.
 *
 * Returns at least one chunk (empty string when content is empty so the
 * viewer still renders a "Chapter not yet written" placeholder).
 */
export function paginateMeasured(
  content: string,
  opts: PaginateMeasuredOptions,
): string[] {
  if (typeof document === 'undefined') return [content ?? '']
  const text = (content ?? '').trim()
  if (!text) return ['']

  const measurer = document.createElement('div')
  measurer.style.cssText = [
    'position: absolute',
    'top: -10000px',
    'left: 0',
    `width: ${opts.bodyWidth}px`,
    `font-family: ${opts.fontFamily}`,
    `font-size: ${opts.fontSize}`,
    `line-height: ${opts.lineHeight}`,
    'visibility: hidden',
    'pointer-events: none',
    // Mirror the renderer's <p> margin behaviour so the per-paragraph
    // bottom margin counts toward the measured height.
    'box-sizing: content-box',
  ].join('; ')
  document.body.appendChild(measurer)

  // Paint paragraphs into the measurer with the same paragraph-bottom
  // margin the renderer uses (0.8em). We also strip the last paragraph's
  // bottom margin to match the renderer's "last child" zero-margin rule —
  // otherwise the final page would be reported 0.8em too tall.
  function renderInto(paragraphs: string[]): void {
    measurer.innerHTML = paragraphs
      .map((p) => `<p style="margin: 0 0 0.8em;">${escapeHtml(p)}</p>`)
      .join('')
    const last = measurer.lastElementChild as HTMLElement | null
    if (last) last.style.marginBottom = '0'
  }

  function fits(paragraphs: string[], targetHeight: number): boolean {
    if (paragraphs.length === 0) return true
    renderInto(paragraphs)
    return measurer.offsetHeight <= targetHeight
  }

  try {
    const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)

    const chunks: string[] = []
    // Paragraphs already committed to the current page.
    let pageParas: string[] = []
    // Sentence buffer for the paragraph currently being built into the page.
    let pendingSentences: string[] = []

    const targetHeight = (): number =>
      chunks.length === 0 ? opts.firstPageHeight : opts.continuationHeight

    const flushPage = (): void => {
      if (pendingSentences.length > 0) {
        pageParas.push(pendingSentences.join(' '))
        pendingSentences = []
      }
      chunks.push(pageParas.join('\n\n'))
      pageParas = []
    }

    for (const para of paragraphs) {
      const sentences = splitSentences(para)

      for (const sentence of sentences) {
        // Provisionally add this sentence to the in-progress paragraph and
        // measure. If it overflows, the prior in-progress paragraph state
        // is the cut-off point for this page.
        const candidatePending = [...pendingSentences, sentence]
        const candidatePage = pendingSentences.length === 0 && pageParas.length === 0 && candidatePending.length === 1
          // First sentence of an empty page — always fits even if oversize,
          // otherwise we'd loop forever flushing empty pages.
          ? candidatePending
          : candidatePending
        const candidateParas = pageParas.concat([candidatePage.join(' ')])

        if (fits(candidateParas, targetHeight())) {
          pendingSentences = candidatePending
          continue
        }

        // Doesn't fit. If the page already has *any* content, flush it and
        // retry with this sentence on a fresh page.
        if (pendingSentences.length > 0 || pageParas.length > 0) {
          flushPage()
          // Retry: fresh page with just this sentence.
          if (fits([sentence], targetHeight())) {
            pendingSentences = [sentence]
          } else {
            // A single sentence longer than the page — accept overflow on
            // its own page rather than splitting mid-sentence.
            pendingSentences = [sentence]
            flushPage()
          }
        } else {
          // Fresh empty page and a single sentence still overflows. Same
          // fallback: emit it alone.
          pendingSentences = [sentence]
          flushPage()
        }
      }

      // End of source paragraph: commit pendingSentences as a paragraph on
      // the current page.
      if (pendingSentences.length > 0) {
        pageParas.push(pendingSentences.join(' '))
        pendingSentences = []
      }
    }

    if (pageParas.length > 0 || pendingSentences.length > 0) flushPage()

    return chunks.length > 0 ? chunks : ['']
  } finally {
    document.body.removeChild(measurer)
  }
}
