/**
 * Detect "acronym blocks" inside chapter prose — paragraphs whose lines all
 * follow the pattern `<single uppercase letter> <dash> <definition>`. The
 * C.R.E.D.I.T. Cleanse uses this for its framework breakdown:
 *
 *     C — Control Payment History
 *     R — Reduce Existing Debt
 *     E — Eliminate Errors
 *     …
 *
 * Renderers use this to switch to a vertical-list layout (large gold letter
 * on the left, definition on the right) instead of running the lines as
 * normal prose.
 */

export interface AcronymEntry {
  letter: string
  definition: string
}

// Single uppercase letter, optional ".", whitespace, dash (-, –, —), space,
// then the definition. The definition is everything until the line break.
const ACRONYM_LINE = /^\s*([A-Z])\.?\s*[-–—]\s*(.+?)\s*$/

/**
 * Returns the acronym entries if EVERY line in the paragraph matches the
 * pattern AND there are at least two such lines. Otherwise returns null —
 * the caller renders the paragraph as ordinary prose.
 */
export function detectAcronymBlock(paragraph: string): AcronymEntry[] | null {
  const lines = paragraph.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return null

  const entries: AcronymEntry[] = []
  for (const line of lines) {
    const m = line.match(ACRONYM_LINE)
    if (!m) return null
    entries.push({ letter: m[1].toUpperCase(), definition: m[2] })
  }
  return entries
}
