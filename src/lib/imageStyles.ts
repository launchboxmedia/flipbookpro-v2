// Client-safe constants for the visual-style picker.
// Kept separate from imageGeneration.ts so client components can import these
// without pulling the Anthropic SDK (and other server-only deps) into the bundle.

export const STYLE_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'photorealistic', label: 'Photorealistic' },
  { id: 'cinematic',      label: 'Cinematic' },
  { id: 'illustrated',    label: 'Illustrated' },
  { id: 'watercolor',     label: 'Watercolor' },
  { id: 'minimalist',     label: 'Minimalist' },
  { id: 'vintage',        label: 'Vintage' },
]

const VALID_STYLE_IDS: ReadonlySet<string> = new Set(STYLE_OPTIONS.map((o) => o.id))

export function isValidVisualStyle(value: string): boolean {
  return VALID_STYLE_IDS.has(value)
}
