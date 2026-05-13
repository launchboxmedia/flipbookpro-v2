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
      // Editorial type scale (design system §3.2). Tailwind's `sm`/`xs`
      // defaults are intentionally left alone to avoid shifting existing UI.
      fontSize: {
        'display-xl': ['72px', { lineHeight: '80px', letterSpacing: '-0.02em',  fontWeight: '600' }],
        'display-lg': ['56px', { lineHeight: '64px', letterSpacing: '-0.02em',  fontWeight: '600' }],
        'display':    ['44px', { lineHeight: '52px', letterSpacing: '-0.02em',  fontWeight: '600' }],
        'h1':         ['36px', { lineHeight: '44px', letterSpacing: '-0.015em', fontWeight: '500' }],
        'h2':         ['28px', { lineHeight: '36px', letterSpacing: '-0.015em', fontWeight: '500' }],
        'h3':         ['22px', { lineHeight: '30px', letterSpacing: '-0.01em',  fontWeight: '500' }],
        'h4':         ['18px', { lineHeight: '26px', fontWeight: '500' }],
        'prose-lg':   ['19px', { lineHeight: '30px', fontWeight: '400' }],
        'prose':      ['17px', { lineHeight: '28px', fontWeight: '400' }],
        'body':       ['15px', { lineHeight: '22px', fontWeight: '400' }],
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
