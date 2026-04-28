import type { Config } from 'tailwindcss'

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
          1:       '#0F1623',
          2:       '#151C28',
          3:       '#1C2333',
          4:       '#2A3448',
          // muted text on ink surfaces
          muted:   '#5A6478',
          subtle:  '#8893A6',
        },
        // Warm cream — book pages, writing surface
        cream: {
          DEFAULT: '#F5F0E8',
          1:       '#F5F0E8',
          2:       '#FAF7F2',
          3:       '#EDE6D8',
        },
        // Warm gold — accent, highlights, active states, hover
        gold: {
          DEFAULT: '#C9A84C',
          soft:    '#D4B65A',
          dim:     '#9C7E2F',
        },
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
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}

export default config
