/**
 * Sentence-aware pagination for chapter text.
 *
 * The flipbook viewer renders fixed-size pages (400×550px). With long chapters
 * the body overflows and the bottom fade mask was clipping content silently.
 * This module produces page-sized chunks so the viewer (and HTML/PDF exports)
 * can emit one spread per chunk and never lose words.
 *
 * Budgets are word counts, not characters — they're a coarse proxy for
 * "how much fits in the body area at body-size 11pt with line-height 1.65".
 * Tested empirically against the existing flipbook page geometry.
 */

export const WORDS_PER_PAGE = 230
export const FIRST_PAGE_BUDGET = 145

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
