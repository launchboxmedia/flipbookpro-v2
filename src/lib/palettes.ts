// Client-safe palette definitions. No server-only imports — components in the
// wizard import from here directly. The runtime resolver also lives here so a
// single source of truth covers UI swatches AND server-side prompt assembly.

import type { Book, Profile } from '@/types/database'

export type PaletteId =
  | 'teal-cream'
  | 'navy-gold'
  | 'burgundy-sand'
  | 'slate-copper'
  | 'forest-amber'
  | 'charcoal-rose'
  | 'brand'

export interface PaletteColorNames {
  primary: string
  secondary: string
  background: string
}

export interface Palette {
  id: PaletteId
  name: string
  primary: string
  secondary: string
  background: string
  /** Plain-language color names — these are what get sent to image models.
   *  NEVER pass the hex values to an image prompt; models render them as
   *  literal text. */
  colorNames: PaletteColorNames
  descriptor: string
}

export const PALETTES: ReadonlyArray<Palette> = [
  {
    id: 'teal-cream',
    name: 'Teal & Cream',
    primary: '#4A7C59',
    secondary: '#C9A84C',
    background: '#FAF7F2',
    colorNames: { primary: 'deep teal', secondary: 'warm gold', background: 'warm cream' },
    descriptor: 'Classic, trustworthy, professional.',
  },
  {
    id: 'navy-gold',
    name: 'Navy & Gold',
    primary: '#1A2F5E',
    secondary: '#C9A84C',
    background: '#F5EFD8',
    colorNames: { primary: 'deep navy', secondary: 'warm gold', background: 'soft cream' },
    descriptor: 'Authoritative, premium, financial.',
  },
  {
    id: 'burgundy-sand',
    name: 'Burgundy & Sand',
    primary: '#7C2D3E',
    secondary: '#D4A96A',
    background: '#F8F4ED',
    colorNames: { primary: 'deep burgundy', secondary: 'warm sand', background: 'off-white' },
    descriptor: 'Sophisticated, warm, leadership.',
  },
  {
    id: 'slate-copper',
    name: 'Slate & Copper',
    primary: '#2D3E50',
    secondary: '#B87333',
    background: '#ECEEF0',
    colorNames: { primary: 'dark slate', secondary: 'warm copper', background: 'light grey' },
    descriptor: 'Modern, technical, precise.',
  },
  {
    id: 'forest-amber',
    name: 'Forest & Amber',
    primary: '#2D4A35',
    secondary: '#E8A030',
    background: '#F5EFD8',
    colorNames: { primary: 'forest green', secondary: 'amber', background: 'soft cream' },
    descriptor: 'Natural, grounded, health and wellness.',
  },
  {
    id: 'charcoal-rose',
    name: 'Charcoal & Rose',
    primary: '#2D2D2D',
    secondary: '#C4707A',
    background: '#F8F4F0',
    colorNames: { primary: 'deep charcoal', secondary: 'dusty rose', background: 'warm white' },
    descriptor: 'Contemporary, personal development, memoir.',
  },
]

const PALETTE_BY_ID: ReadonlyMap<PaletteId, Palette> = new Map(
  PALETTES.map((p) => [p.id, p] as const),
)

const DEFAULT_PALETTE_ID: PaletteId = 'teal-cream'

// Neutral fallback used when a user picks "brand colors" but has no
// brand_color set yet, or when the book has no palette saved.
const BRAND_BACKGROUND_FALLBACK = '#FAF7F2'
const BRAND_SECONDARY_FALLBACK = '#C9A84C'

// Approximate hex → color-name conversion for the user's brand color. Image
// models render hex as literal text, so we describe brand colors with words
// even when the exact hue is user-defined. Returns generic family names that
// span the typical brand-color space.
export function describeHex(hex: string): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i)
  if (!m) return 'brand color'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  // Saturation/lightness check for grey
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max - min < 18) {
    if (max < 60) return 'deep charcoal'
    if (max < 130) return 'medium grey'
    if (max < 210) return 'light grey'
    return 'soft white'
  }
  // Hue
  let h: number
  const d = max - min
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  const lightness = (max + min) / 2 / 255
  const dark = lightness < 0.4
  const light = lightness > 0.7
  // Hue → family
  let family: string
  if (h < 15 || h >= 345) family = 'red'
  else if (h < 35) family = 'orange'
  else if (h < 55) family = 'gold'
  else if (h < 75) family = 'yellow'
  else if (h < 100) family = 'lime'
  else if (h < 145) family = 'green'
  else if (h < 175) family = 'teal'
  else if (h < 200) family = 'cyan'
  else if (h < 235) family = 'blue'
  else if (h < 270) family = 'indigo'
  else if (h < 300) family = 'purple'
  else if (h < 330) family = 'magenta'
  else family = 'rose'
  const modifier = dark ? 'deep ' : light ? 'soft ' : 'warm '
  return `${modifier}${family}`
}

export interface ResolvedPaletteColors {
  primary: string
  secondary: string
  background: string
  /** Plain-language color names safe to include in image prompts. */
  primaryName: string
  secondaryName: string
  backgroundName: string
  // Display name for logging / debug
  source: string
}

export function isValidPaletteId(value: string): value is PaletteId {
  return PALETTE_BY_ID.has(value as PaletteId) || value === 'brand'
}

export function getPaletteById(id: string | null | undefined): Palette | null {
  if (!id) return null
  return PALETTE_BY_ID.get(id as PaletteId) ?? null
}

// Resolve the actual hex colors AND descriptive names to inject into image
// prompts. Handles the 'brand' branch by pulling from the profile, with
// sensible fallbacks if a brand color or accent isn't set.
export function resolvePaletteColors(
  book: Pick<Book, 'palette'>,
  profile: Pick<Profile, 'brand_color' | 'accent_color'> | null,
): ResolvedPaletteColors {
  const id = (book.palette ?? DEFAULT_PALETTE_ID) as PaletteId

  if (id === 'brand') {
    const primary = profile?.brand_color ?? PALETTE_BY_ID.get(DEFAULT_PALETTE_ID)!.primary
    const secondary = profile?.accent_color ?? BRAND_SECONDARY_FALLBACK
    return {
      primary,
      secondary,
      background: BRAND_BACKGROUND_FALLBACK,
      primaryName: describeHex(primary),
      secondaryName: describeHex(secondary),
      backgroundName: 'warm cream',
      source: 'brand',
    }
  }

  const palette = PALETTE_BY_ID.get(id) ?? PALETTE_BY_ID.get(DEFAULT_PALETTE_ID)!
  return {
    primary: palette.primary,
    secondary: palette.secondary,
    background: palette.background,
    primaryName: palette.colorNames.primary,
    secondaryName: palette.colorNames.secondary,
    backgroundName: palette.colorNames.background,
    source: palette.id,
  }
}
