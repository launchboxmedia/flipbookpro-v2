import type { Book, Profile } from '@/types/database'

export interface BookTheme {
  vars: Record<string, string>
  googleFontsUrl: string
}

// ── Typography → page layout, fonts, sizes ─────────────────────────────────

const TYPOGRAPHY: Record<string, Record<string, string>> = {
  standard_clean: {
    '--page-bg':          '#FFFFFF',
    '--page-text':        '#1A1A1A',
    '--page-text-muted':  '#999999',
    '--body-font':        "'Inter', system-ui, sans-serif",
    '--heading-font':     "'Playfair Display', Georgia, serif",
    '--body-size':        '12.5px',
    '--heading-size':     '17px',
    '--line-height':      '1.72',
    '--drop-cap-size':    '3.2em',
  },
  executive_serif: {
    '--page-bg':          '#FAFAF7',
    '--page-text':        '#1A1A1A',
    '--page-text-muted':  '#999999',
    '--body-font':        "'Source Serif 4', Georgia, serif",
    '--heading-font':     "'Playfair Display', Georgia, serif",
    '--body-size':        '13px',
    '--heading-size':     '18px',
    '--line-height':      '1.78',
    '--drop-cap-size':    '3.5em',
  },
  editorial_classic: {
    '--page-bg':          '#FAF7F2',
    '--page-text':        '#1C1C1C',
    '--page-text-muted':  '#999999',
    '--body-font':        "'Source Serif 4', Georgia, serif",
    '--heading-font':     "'Playfair Display', Georgia, serif",
    '--body-size':        '12.5px',
    '--heading-size':     '18px',
    '--line-height':      '1.78',
    '--drop-cap-size':    '3.5em',
  },
  bold_display: {
    '--page-bg':          '#F8F8F8',
    '--page-text':        '#0D0D0D',
    '--page-text-muted':  '#888888',
    '--body-font':        "'Inter', system-ui, sans-serif",
    '--heading-font':     "'Playfair Display', Georgia, serif",
    '--body-size':        '12px',
    '--heading-size':     '20px',
    '--line-height':      '1.70',
    '--drop-cap-size':    '3.8em',
  },
}

// ── Cover direction → accent palette, cover/back colors ────────────────────

const DIRECTION: Record<string, Record<string, string>> = {
  bold_operator: {
    '--accent':           '#C9A84C',
    '--accent-muted':     'rgba(201,168,76,0.28)',
    '--accent-subtle':    'rgba(201,168,76,0.10)',
    '--cover-bg':         '#111111',
    '--cover-text':       '#F5F0E8',
    '--cover-band':       '#C9A84C',
    '--back-cover-bg':    '#0C0C0C',
    '--rule-color':       'rgba(201,168,76,0.35)',
    '--chapter-num-color':'#C9A84C',
    '--drop-cap-color':   '#C9A84C',
    '--spine-start':      '#080808',
    '--spine-end':        '#252525',
  },
  clean_corporate: {
    '--accent':           '#2B5BA8',
    '--accent-muted':     'rgba(43,91,168,0.28)',
    '--accent-subtle':    'rgba(43,91,168,0.10)',
    '--cover-bg':         '#0A1628',
    '--cover-text':       '#E8F0FF',
    '--cover-band':       '#2B5BA8',
    '--back-cover-bg':    '#060F1C',
    '--rule-color':       'rgba(43,91,168,0.35)',
    '--chapter-num-color':'#2B5BA8',
    '--drop-cap-color':   '#2B5BA8',
    '--spine-start':      '#040A12',
    '--spine-end':        '#0F1E34',
  },
  editorial_modern: {
    '--accent':           '#C94C4C',
    '--accent-muted':     'rgba(201,76,76,0.28)',
    '--accent-subtle':    'rgba(201,76,76,0.10)',
    '--cover-bg':         '#1A0808',
    '--cover-text':       '#FFF0F0',
    '--cover-band':       '#C94C4C',
    '--back-cover-bg':    '#0D0404',
    '--rule-color':       'rgba(201,76,76,0.35)',
    '--chapter-num-color':'#C94C4C',
    '--drop-cap-color':   '#C94C4C',
    '--spine-start':      '#0A0404',
    '--spine-end':        '#1A0A0A',
  },
  cinematic_abstract: {
    '--accent':           '#8B6BB5',
    '--accent-muted':     'rgba(139,107,181,0.28)',
    '--accent-subtle':    'rgba(139,107,181,0.10)',
    '--cover-bg':         '#0D0918',
    '--cover-text':       '#F0EEFF',
    '--cover-band':       '#6B4C9A',
    '--back-cover-bg':    '#08050F',
    '--rule-color':       'rgba(139,107,181,0.35)',
    '--chapter-num-color':'#8B6BB5',
    '--drop-cap-color':   '#8B6BB5',
    '--spine-start':      '#060410',
    '--spine-end':        '#150F28',
  },
  retro_illustrated: {
    '--accent':           '#D4762E',
    '--accent-muted':     'rgba(212,118,46,0.28)',
    '--accent-subtle':    'rgba(212,118,46,0.10)',
    '--cover-bg':         '#1A0D05',
    '--cover-text':       '#FFF5EC',
    '--cover-band':       '#D4762E',
    '--back-cover-bg':    '#0D0702',
    '--rule-color':       'rgba(212,118,46,0.35)',
    '--chapter-num-color':'#D4762E',
    '--drop-cap-color':   '#D4762E',
    '--spine-start':      '#0A0602',
    '--spine-end':        '#1A0E06',
  },
  studio_product: {
    '--accent':           '#4A7C59',
    '--accent-muted':     'rgba(74,124,89,0.28)',
    '--accent-subtle':    'rgba(74,124,89,0.10)',
    '--cover-bg':         '#0D1A12',
    '--cover-text':       '#EEF5F0',
    '--cover-band':       '#4A7C59',
    '--back-cover-bg':    '#070E09',
    '--rule-color':       'rgba(74,124,89,0.35)',
    '--chapter-num-color':'#4A7C59',
    '--drop-cap-color':   '#4A7C59',
    '--spine-start':      '#050C07',
    '--spine-end':        '#0F1E14',
  },
}

// Always load all three font families; body font usage is controlled by CSS vars
const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400' +
  '&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400' +
  '&family=Inter:wght@400;500&display=swap'

export function deriveTheme(book: Book, profile: Profile | null): BookTheme {
  const typo = book.typography ?? 'standard_clean'
  const dir  = book.cover_direction ?? 'bold_operator'

  const vars: Record<string, string> = {
    '--canvas-bg': '#1A1A1A',
    ...TYPOGRAPHY[typo] ?? TYPOGRAPHY.standard_clean,
    ...DIRECTION[dir]   ?? DIRECTION.bold_operator,
  }

  // Brand colour overrides accent if set
  if (profile?.brand_color) {
    vars['--accent']            = profile.brand_color
    vars['--chapter-num-color'] = profile.brand_color
    vars['--drop-cap-color']    = profile.brand_color
    vars['--cover-band']        = profile.brand_color
  }

  return { vars, googleFontsUrl: GOOGLE_FONTS_URL }
}
