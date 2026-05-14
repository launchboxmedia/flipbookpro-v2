import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── BookBuilderPro design system ────────────────────────────────
        // Dark navy stack — sidebars + dark surfaces (ink-1 darkest)
        ink: {
          DEFAULT: '#0F1623',
          0:       '#0A111C',
          1:       '#0F1623',
          2:       '#151C28',
          3:       '#1C2333',
          4:       '#2A3448',
          // muted text on ink surfaces
          muted:   '#5A6478',
          subtle:  '#8893A6',
          // primary text on ink (formalised working value)
          text:    '#E6EAF2',
        },
        // Warm cream — book pages, writing surface
        cream: {
          DEFAULT:     '#F5F0E8',
          1:           '#F5F0E8',
          2:           '#FAF7F2',
          3:           '#EDE6D8',
          line:        '#E3D9C6',
          ink:         '#1B2230',
          'ink-soft':  '#4A5468',
          'ink-muted': '#7A8499',
        },
        // Warm gold — accent, highlights, active states, hover
        gold: {
          DEFAULT: '#C9A84C',
          soft:    '#D4B65A',
          dim:     '#9C7E2F',
          tint:    '#F2E9C8',
          glow:    'rgba(201,168,76,0.18)',
        },
        // Semantic colors — desaturated to coexist with the editorial palette
        success:        '#5C8A6F',
        'success-tint': '#E6EFE8',
        danger:         '#B14B3E',
        'danger-tint':  '#F4E2DC',
        warning:        '#C28A3A',
        'warning-tint': '#F5EAD2',
        info:           '#5A7BA5',
        'info-tint':    '#E1E8F1',
        // Existing tokens kept for compatibility with screens not yet
        // migrated to the new system
        canvas: '#1A1A1A',
        page: '#F5F0E8',
        accent: '#4A7C59',
        muted: {
          DEFAULT: '#2A2A2A',
          foreground: '#888888',
        },
        border: '#333333',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        playfair: ['var(--font-playfair)', 'Playfair Display', 'serif'],
        'source-serif': ['var(--font-source-serif)', 'Source Serif 4', 'serif'],
        inter: ['var(--font-inter)', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      // Editorial type scale (design system §3.2). Includes `sm`/`xs`
      // overrides matching the spec (13/20, 12/18) — these replace
      // Tailwind defaults (14/20, 12/16) project-wide.
      fontSize: {
        'display-xl': ['72px',     { lineHeight: '80px', letterSpacing: '-0.02em',  fontWeight: '600' }],
        'display-lg': ['56px',     { lineHeight: '64px', letterSpacing: '-0.02em',  fontWeight: '600' }],
        'display':    ['44px',     { lineHeight: '52px', letterSpacing: '-0.02em',  fontWeight: '600' }],
        'h1':         ['36px',     { lineHeight: '44px', letterSpacing: '-0.015em', fontWeight: '500' }],
        'h2':         ['28px',     { lineHeight: '36px', letterSpacing: '-0.015em', fontWeight: '500' }],
        'h3':         ['22px',     { lineHeight: '30px', letterSpacing: '-0.01em',  fontWeight: '500' }],
        'h4':         ['18px',     { lineHeight: '26px', fontWeight: '500' }],
        'prose-lg':   ['19px',     { lineHeight: '30px', fontWeight: '400' }],
        'prose':      ['17px',     { lineHeight: '28px', fontWeight: '400' }],
        'body':       ['15px',     { lineHeight: '22px', fontWeight: '400' }],
        'sm':         ['0.8125rem',{ lineHeight: '1.25rem' }],
        'xs':         ['0.75rem',  { lineHeight: '1.125rem' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'cream-1':  '0 1px 0 #E3D9C6',
        'cream-2':  '0 1px 2px rgba(27,34,48,0.06), 0 1px 1px rgba(27,34,48,0.04)',
        'cream-3':  '0 4px 12px rgba(27,34,48,0.08), 0 1px 2px rgba(27,34,48,0.06)',
        'cream-4':  '0 12px 32px rgba(27,34,48,0.12), 0 2px 6px rgba(27,34,48,0.06)',
        'ink-1':    'inset 0 0 0 1px #2A3448',
        'ink-3':    '0 16px 40px rgba(0,0,0,0.45), inset 0 0 0 1px #2A3448',
        'gold-halo':'0 0 0 1px #C9A84C, 0 0 0 4px rgba(201,168,76,0.18)',
      },
      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      transitionDuration: {
        220: '220ms',
        320: '320ms',
        480: '480ms',
      },
      // Loading + reveal motion. Pure CSS — no JS animation libs. Names
      // mirror the design-system spec so any future component can compose
      // them via Tailwind's animate-* utilities.
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '0.7' },
          '50%':      { opacity: '1' },
        },
        pulseLogo: {
          '0%, 100%': { opacity: '0.9', transform: 'scale(1)' },
          '50%':      { opacity: '1',   transform: 'scale(1.03)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,168,76,0.4)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(201,168,76,0)' },
        },
        pulseRing: {
          '0%':   { boxShadow: '0 0 0 0 rgba(201,168,76,0.4)' },
          '70%':  { boxShadow: '0 0 0 6px rgba(201,168,76,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(201,168,76,0)' },
        },
        // 4-page stack uses staggered animation-delay so each page flips
        // in turn. 0–15% holds the page upright before the rotation begins
        // (the "lift") and 85–100% holds at -180deg so the next cycle
        // starts cleanly without a snap-back.
        pageFlip: {
          '0%, 15%':   { transform: 'rotateY(0deg)',    animationTimingFunction: 'ease-in'  },
          '50%':       { transform: 'rotateY(-90deg)',  animationTimingFunction: 'ease-out' },
          '85%, 100%': { transform: 'rotateY(-180deg)' },
        },
        coverOpen: {
          '0%':   { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(-140deg)' },
        },
        revealUp: {
          '0%':   { clipPath: 'inset(100% 0 0 0)', opacity: '0' },
          '100%': { clipPath: 'inset(0% 0 0 0)',   opacity: '1' },
        },
        // Used by SplashScreen — a slow vertical bob so the closed book reads
        // as resting on the canvas rather than glued to it.
        bookFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
        // Used by BookLoading — a single tied scale+opacity breath. Same
        // 1.5s clock as pageSliver so the two read as one motion.
        bookBreathe: {
          '0%, 100%': { transform: 'scale(1)',    opacity: '0.7' },
          '50%':      { transform: 'scale(1.04)', opacity: '1' },
        },
        // Used by BookLoading — a thin sliver of page peeking past the
        // cover edge that slides 2px in time with bookBreathe.
        pageSliver: {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%':      { transform: 'translateX(2px)' },
        },
      },
      animation: {
        'fade-in':      'fadeIn 0.3s ease-out forwards',
        'slide-up':     'slideUp 0.4s ease-out forwards',
        'scale-in':     'scaleIn 0.2s ease-out forwards',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'pulse-logo':   'pulseLogo 2s ease-in-out infinite',
        'shimmer':      'shimmer 2s linear infinite',
        'glow-pulse':   'glowPulse 2s ease-in-out infinite',
        'pulse-ring':   'pulseRing 2s ease-out infinite',
        'page-flip':    'pageFlip 1.2s ease-in-out infinite',
        'cover-open':   'coverOpen 1.2s ease-in-out forwards',
        'reveal-up':    'revealUp 0.6s ease-out forwards',
        'book-float':   'bookFloat 2s ease-in-out infinite',
        'book-breathe': 'bookBreathe 1.5s ease-in-out infinite',
        'page-sliver':  'pageSliver 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.text-overline': {
          fontSize: '11px',
          lineHeight: '16px',
          letterSpacing: '0.12em',
          fontWeight: '500',
          textTransform: 'uppercase',
        },
      })
    }),
  ],
}

export default config
