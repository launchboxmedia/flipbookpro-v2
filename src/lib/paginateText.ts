/**
 * Sentence-aware pagination for chapter text.
 *
 * The flipbook viewer renders fixed-size pages (400×550px). With long chapters
 * the body overflows and the bottom fade mask was clipping content silently.
 * This module produces page-sized chunks so the viewer (and HTML/PDF exports)
 * can emit one spread per chunk and never lose words.
 *
 * Budgets are word counts — a coarse proxy for "how much fits in the body
 * area". Calibrated against actual page geometry rather than guessed:
 *
 *   • Page area: 400 × 550 px
 *   • padRight padding: 34/38/26/24 (T/R/B/L) → body width 338, height 490
 *   • Header (first chunk): label + heading + rule + margin ≈ 57 px
 *   • Header (continuation): single-row baseline ≈ 26 px
 *   • Page-number footer: ≈ 14 px
 *   • → first chunk body height ≈ 419, continuation ≈ 450
 *   • Worst-case theme (executive_serif: 13px / line-height 1.78):
 *       line height 23 px → first 18 lines, continuation 19 lines
 *       avg ~8 words/line on serif at 338 px wide
 *       → first ≈ 144 words, continuation ≈ 152 words
 *
 * The previous values (145 / 230) were calibrated for words-per-line on a
 * narrower font; on serif at 13px the continuation pages overflowed by ~5 lines
 * and the bottom fade mask was clipping the last sentence. New values:
 *
 *   • FIRST_PAGE_BUDGET = 125 (drop cap eats a couple of lines of width too)
 *   • WORDS_PER_PAGE   = 180
 *
 * The ~180 figure comes from re-checking words/line: 13px serif at 338px wide
 * fits ~9.5 words/line × 19 lines ≈ 180 words/page. Smaller fonts fit more,
 * so this is the safe-for-worst-case ceiling. The viewer pairs continuation
 * chunks across left+right pages so a chapter of N chunks renders in
 * ceil((N+1)/2) spreads, which keeps text density high.
 */

export const WORDS_PER_PAGE = 180
export const FIRST_PAGE_BUDGET = 125

interface PaginateOptions {
  /** Words on the first page of a chapter (drop cap + chapter header eat
   *  vertical space, so the budget is smaller). */
  firstPageBudget?: number
  /** Words on each continuation page. */
  pageBudget?: number
}

/**
 * Splits chapter content into page-sized chunks at sentence boundaries.
 *
 *   - Returns ['' ] for empty/whitespace input so the caller can still render
 *     a "Chapter not yet written" placeholder spread.
 *   - Each chunk is a string with paragraph breaks (`\n\n`) preserved.
 *   - Sentence boundaries: `.`, `!`, `?` followed by whitespace. Quotes after
 *     the punctuation are kept with the sentence ("…end." vs "…end".) — the
 *     regex matches an optional closing quote.
 *   - A single sentence longer than the page budget will overflow that page
 *     rather than being split mid-sentence (keeps reading flow intact).
 */
export function paginateText(content: string, opts: PaginateOptions = {}): string[] {
  const firstBudget = opts.firstPageBudget ?? FIRST_PAGE_BUDGET
  const laterBudget = opts.pageBudget ?? WORDS_PER_PAGE

  const text = (content ?? '').trim()
  if (!text) return ['']

  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)

  const pages: string[] = []
  let pageBuf: string[] = [] // paragraph strings on the current page
  let pageWords = 0
  let pageIdx = 0

  const budget = () => (pageIdx === 0 ? firstBudget : laterBudget)

  function flushPage() {
    pages.push(pageBuf.join('\n\n'))
    pageBuf = []
    pageWords = 0
    pageIdx++
  }

  for (const paragraph of paragraphs) {
    const sentences = splitSentences(paragraph)

    // Within this paragraph, accumulate sentences into a sub-buffer. When we
    // exceed the page budget we flush the page, taking the buffered partial
    // paragraph with us. The next page's first paragraph is the remaining
    // sentences from the same source paragraph.
    let paraBuf: string[] = []
    let paraWords = 0

    for (const sentence of sentences) {
      const sentWords = countWords(sentence)

      if (pageWords + paraWords + sentWords > budget()) {
        // Flush whatever we accumulated for THIS paragraph onto the current
        // page (may be empty if this is the first sentence of a fresh
        // paragraph that doesn't fit).
        if (paraBuf.length > 0) {
          pageBuf.push(paraBuf.join(' '))
          pageWords += paraWords
          paraBuf = []
          paraWords = 0
        }

        // Flush the current page if it has any content. If it's empty AND
        // we still can't fit this sentence, the sentence is alone-too-long;
        // it lands on the new page and overflows visually rather than being
        // cut mid-word.
        if (pageBuf.length > 0) {
          flushPage()
        }
      }

      paraBuf.push(sentence)
      paraWords += sentWords
    }

    // End of source paragraph: append the buffer to the current page as one
    // paragraph string. This preserves \n\n boundaries between source paras.
    if (paraBuf.length > 0) {
      pageBuf.push(paraBuf.join(' '))
      pageWords += paraWords
    }
  }

  if (pageBuf.length > 0) flushPage()

  return pages.length > 0 ? pages : ['']
}

/**
 * Heuristic sentence splitter. Doesn't handle every edge case (e.g.,
 * "Mr. Smith" creates a false break) but produces stable, readable chunks
 * for the prose we generate, which is full sentences. We accept the rare
 * abbreviation false-positive in exchange for simplicity.
 */
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
  // Trailing content with no closing punctuation
  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex).trim()
    if (tail) out.push(tail)
  }
  return out.length > 0 ? out : [text]
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
