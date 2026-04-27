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

export interface Palette {
  id: PaletteId
  name: string
  primary: string
  secondary: string
  background: string
  descriptor: string
}

export const PALETTES: ReadonlyArray<Palette> = [
  {
    id: 'teal-cream',
    name: 'Teal & Cream',
    primary: '#4A7C59',
    secondary: '#C9A84C',
    background: '#FAF7F2',
    descriptor: 'Classic, trustworthy, professional.',
  },
  {
    id: 'navy-gold',
    name: 'Navy & Gold',
    primary: '#1A2F5E',
    secondary: '#C9A84C',
    background: '#F5EFD8',
    descriptor: 'Authoritative, premium, financial.',
  },
  {
    id: 'burgundy-sand',
    name: 'Burgundy & Sand',
    primary: '#7C2D3E',
    secondary: '#D4A96A',
    background: '#F8F4ED',
    descriptor: 'Sophisticated, warm, leadership.',
  },
  {
    id: 'slate-copper',
    name: 'Slate & Copper',
    primary: '#2D3E50',
    secondary: '#B87333',
    background: '#ECEEF0',
    descriptor: 'Modern, technical, precise.',
  },
  {
    id: 'forest-amber',
    name: 'Forest & Amber',
    primary: '#2D4A35',
    secondary: '#E8A030',
    background: '#F5EFD8',
    descriptor: 'Natural, grounded, health and wellness.',
  },
  {
    id: 'charcoal-rose',
    name: 'Charcoal & Rose',
    primary: '#2D2D2D',
    secondary: '#C4707A',
    background: '#F8F4F0',
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

export interface ResolvedPaletteColors {
  primary: string
  secondary: string
  background: string
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

// Resolve the actual hex colors to inject into image prompts. Handles the
// 'brand' branch by pulling from the profile, with sensible fallbacks if a
// brand color or accent isn't set.
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
      source: 'brand',
    }
  }

  const palette = PALETTE_BY_ID.get(id) ?? PALETTE_BY_ID.get(DEFAULT_PALETTE_ID)!
  return {
    primary: palette.primary,
    secondary: palette.secondary,
    background: palette.background,
    source: palette.id,
  }
}
