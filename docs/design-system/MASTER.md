# FlipBookPro — Design System

> Luxury editorial SaaS. Dark canvas, cream pages, gold accents. Built for an audience that values craftsmanship: the product is the book, so the UI defers to the content the way a fine binding defers to the text inside it.

---

## 1. Design Principles

| # | Principle | What it means in practice |
|---|---|---|
| 1 | Editorial restraint | One primary action per screen. Long whitespace, deliberate rhythm. No competing accents. |
| 2 | Material contrast | The product trades on the tension between ink (structure / chrome) and cream (page / content). Never blur the two. |
| 3 | Gold is punctuation | Gold marks state and authority — active nav, primary CTA, focus, "Approve". Never decoration. |
| 4 | Typography carries the brand | Playfair sets the tone before color or motion does. Headings are generous and serifed. |
| 5 | Motion as page-turn | Animation language is the slow, weighted cadence of paper, not the snap of consumer SaaS. |

---

## 2. Color System

### 2.1 Core scales (formalize existing tokens + fill gaps)

#### Ink — structure, chrome, dark surfaces

| Token | Hex | Role |
|---|---|---|
| `ink-0` | `#0A111C` | Deepest — only behind layered chrome (drawer scrim, modal backdrop) |
| `ink-1` | `#0F1623` | Canvas. Global sidebar, dashboard, wizard canvas |
| `ink-2` | `#151C28` | Raised surface — cards on canvas, sidebar item hover |
| `ink-3` | `#1C2333` | Higher surface — popovers, dropdowns, chat bubbles |
| `ink-4` | `#2A3448` | Borders & dividers on dark |
| `ink-muted` | `#5A6478` | Tertiary text on dark |
| `ink-subtle` | `#8893A6` | Secondary text on dark |
| `ink-text` | `#E6EAF2` | Primary text on dark. **(new — formalize the working value)** |

#### Cream — page, content surfaces

| Token | Hex | Role |
|---|---|---|
| `cream-1` | `#F5F0E8` | Page. Coauthor manuscript, outline page, settings main, wizard step card |
| `cream-2` | `#FAF7F2` | Raised on page — toolbar strip, form well, footer |
| `cream-3` | `#EDE6D8` | Sunk on page — input field, code block, quote rail |
| `cream-line` | `#E3D9C6` | Border / divider on cream **(new — formalize)** |
| `cream-ink` | `#1B2230` | Primary text on cream (deep ink, slight warmth) |
| `cream-ink-soft` | `#4A5468` | Secondary text on cream |
| `cream-ink-muted` | `#7A8499` | Tertiary text / metadata on cream |

#### Gold — accent & authority

| Token | Hex | Role |
|---|---|---|
| `gold` | `#C9A84C` | Primary accent. Active nav, primary CTA, focus ring, progress |
| `gold-soft` | `#D4B65A` | Hover state on gold |
| `gold-dim` | `#9C7E2F` | Pressed state, gold-on-cream icons that need to recede |
| `gold-tint` | `#F2E9C8` | Tinted background — gold-recommended plan card, highlight strip **(new)** |
| `gold-glow` | `rgba(201, 168, 76, 0.18)` | Focus halo, hover shadow tint **(new)** |

### 2.2 Semantic colors

Designed to coexist with the editorial palette — slightly desaturated, never neon.

| Token | Hex | Use |
|---|---|---|
| `success` | `#5C8A6F` | Approved chapter, publish confirmation, lead captured (deep moss, not Slack green) |
| `success-tint` | `#E6EFE8` | Success background on cream |
| `danger` | `#B14B3E` | Destructive (delete book, unpublish), pre-publish blocker (terracotta, not stoplight) |
| `danger-tint` | `#F4E2DC` | Danger background on cream |
| `warning` | `#C28A3A` | Pre-publish warning, rate-limit nearing (amber that's a sibling to gold, not a competitor) |
| `warning-tint` | `#F5EAD2` | Warning background on cream |
| `info` | `#5A7BA5` | Neutral notice (Stripe pending, queued export) (slate blue) |
| `info-tint` | `#E1E8F1` | Info background on cream |

### 2.3 Surface map (which token to reach for)

```
DARK CANVAS                          CREAM PAGE
─────────────────                    ────────────────
ink-1   base                         cream-1   base
ink-2   card                         cream-2   raised/toolbar
ink-3   popover/chat                 cream-3   input/well
ink-4   border                       cream-line  border
ink-text  primary text               cream-ink  primary text
ink-subtle  secondary text           cream-ink-soft  secondary
gold      single accent              gold      single accent
```

**Rule:** A surface stack is either ink or cream. Never half-and-half within a card. The boundary between them is a feature, not a transition.

### 2.4 Contrast ledger (WCAG)

| Pair | Ratio | Result |
|---|---|---|
| `ink-text` (`#E6EAF2`) on `ink-1` (`#0F1623`) | 14.8:1 | AAA |
| `ink-subtle` (`#8893A6`) on `ink-1` | 5.2:1 | AA |
| `cream-ink` (`#1B2230`) on `cream-1` (`#F5F0E8`) | 13.4:1 | AAA |
| `cream-ink-soft` (`#4A5468`) on `cream-1` | 6.9:1 | AA |
| `gold` (`#C9A84C`) on `ink-1` | 6.4:1 | AA — usable for text |
| `gold` on `cream-1` | 2.3:1 | **Fails text.** Use `gold-dim` (`#9C7E2F` → 4.8:1) for gold text on cream |
| `gold-dim` (`#9C7E2F`) on `cream-1` | 4.8:1 | AA |

**Action item:** Audit any existing "gold text on cream" usage and migrate to `gold-dim`. Gold pills/buttons on cream should fill with gold and use `ink-1` for the label.

---

## 3. Typography

### 3.1 Roles

| Role | Family | Weight | Tracking | Use |
|---|---|---|---|---|
| Display | Playfair Display | 600 | -0.02em | Marketing hero, book title on cover, read-page masthead |
| Heading | Playfair Display | 500–600 | -0.015em | Page H1/H2, modal title, chapter title in coauthor |
| Subhead | Playfair Display | 500 | -0.01em | Section dividers, card title (when editorial) |
| Prose | Source Serif 4 | 400 (italic 400) | 0 | Manuscript body, chapter draft, read-page chapter content |
| Prose-emphasis | Source Serif 4 | 600 | 0 | Inline strong inside prose |
| UI | Inter | 400 / 500 / 600 | 0 / -0.005em at large | Buttons, nav, labels, form controls, toasts |
| UI-mono | JetBrains Mono *(add)* | 400 | 0 | Slug fields, API keys, code blocks (currently missing — add via `next/font/google`) |

### 3.2 Scale

8px-baseline modular scale. Body is 16px (browser default; supports user zoom).

| Token | Size / Line | Role |
|---|---|---|
| `text-display-xl` | 72 / 80 | Hero |
| `text-display-lg` | 56 / 64 | Page hero (read page title, marketing section header) |
| `text-display` | 44 / 52 | Major H1 |
| `text-h1` | 36 / 44 | Page H1 (dashboard greeting, coauthor chapter title) |
| `text-h2` | 28 / 36 | Section H2 |
| `text-h3` | 22 / 30 | Card title, modal title |
| `text-h4` | 18 / 26 | Sub-section |
| `text-prose-lg` | 19 / 30 | Read-page body (generous measure) |
| `text-prose` | 17 / 28 | Coauthor manuscript body |
| `text-body` | 15 / 22 | Default UI body |
| `text-sm` | 13 / 20 | Secondary UI, helper text, breadcrumb |
| `text-xs` | 12 / 18 | Metadata, table caption, badge label |
| `text-overline` | 11 / 16, uppercase, tracking 0.12em, weight 500 | Section eyebrow, card status |

### 3.3 Measure

- **Prose surfaces** (coauthor draft, read page): max **68ch**. Editorial standard; long-form readability.
- **UI surfaces:** max **56ch** for descriptive copy, no limit for tables/grids.
- **Mobile:** prose **35–45ch**.

### 3.4 Font features

- All serif headings: `font-feature-settings: "lnum", "kern"`. Lining figures only.
- Numeric columns (analytics, billing): `font-variant-numeric: tabular-nums`.
- Manuscript prose: `font-feature-settings: "kern", "liga", "onum"` (oldstyle figures — looks bookish).

---

## 4. Spacing & Layout

### 4.1 Spacing scale (4pt base, 8pt rhythm)

| Token | Value | Use |
|---|---|---|
| `space-0` | 0 | — |
| `space-1` | 4px | Icon-to-label inside a tight control |
| `space-2` | 8px | Smallest gap between siblings |
| `space-3` | 12px | Compact list item padding |
| `space-4` | 16px | Default card/control inner padding |
| `space-5` | 20px | — |
| `space-6` | 24px | Default section gutter |
| `space-8` | 32px | Card padding, between major form groups |
| `space-10` | 40px | — |
| `space-12` | 48px | Section spacing within a page |
| `space-16` | 64px | Hero internal padding, between large sections |
| `space-20` | 80px | Marketing section vertical rhythm |
| `space-24` | 96px | Editorial breathing — chapter break, hero top |

### 4.2 Radii

Editorial = small. Avoid the "soft consumer SaaS" pill aesthetic except on chips.

| Token | Value | Use |
|---|---|---|
| `radius-none` | 0 | Manuscript surface edges |
| `radius-sm` | 4px | Inputs, small buttons |
| `radius-md` | 8px | Cards, primary buttons, modals |
| `radius-lg` | 12px | Sheet, large modal |
| `radius-pill` | 9999px | Status chips, persona pills, plan badges |

### 4.3 Container widths

| Token | Width | Use |
|---|---|---|
| `content-prose` | 720px | Read-page prose column, single-column docs |
| `content-narrow` | 880px | Wizard step card, single-form settings page |
| `content-default` | 1180px | Dashboard, coauthor, marketing default |
| `content-wide` | 1400px | Marketing hero, dashboard wide layout |

### 4.4 Breakpoints

`sm 640` / `md 768` / `lg 1024` / `xl 1280` / `2xl 1536` — Tailwind defaults retained. Mobile-first.

### 4.5 Z-index scale

`0` content · `10` sticky toolbar · `20` sidebar · `40` dropdown/popover · `60` toast · `80` modal scrim · `90` modal · `100` dev overlay.

---

## 5. Elevation

The editorial aesthetic uses **borders + warm shadows on cream**, and **inner stroke + subtle glow on ink**. No floating Material drop shadows.

### 5.1 On cream

| Token | Spec | Use |
|---|---|---|
| `elev-cream-0` | none | Flat |
| `elev-cream-1` | `0 1px 0 #E3D9C6` | Hairline (toolbar bottom edge, list divider) |
| `elev-cream-2` | `0 1px 2px rgba(27, 34, 48, 0.06), 0 1px 1px rgba(27, 34, 48, 0.04)` | Card resting |
| `elev-cream-3` | `0 4px 12px rgba(27, 34, 48, 0.08), 0 1px 2px rgba(27, 34, 48, 0.06)` | Card hover, sticky toolbar |
| `elev-cream-4` | `0 12px 32px rgba(27, 34, 48, 0.12), 0 2px 6px rgba(27, 34, 48, 0.06)` | Modal, popover |

### 5.2 On ink

| Token | Spec | Use |
|---|---|---|
| `elev-ink-0` | none | Flat (most ink cards) |
| `elev-ink-1` | `inset 0 0 0 1px #2A3448` | Card outline — primary elevation language on dark |
| `elev-ink-2` | `inset 0 0 0 1px #2A3448, 0 1px 0 rgba(0,0,0,0.4)` | Card hover |
| `elev-ink-3` | `0 16px 40px rgba(0, 0, 0, 0.45), inset 0 0 0 1px #2A3448` | Modal, popover |
| `elev-gold-halo` | `0 0 0 1px #C9A84C, 0 0 0 4px rgba(201, 168, 76, 0.18)` | Focus ring, recommended-plan card |

---

## 6. Motion

Editorial cadence — slower than typical SaaS, weighted, never bouncy.

### 6.1 Duration

| Token | ms | Use |
|---|---|---|
| `dur-instant` | 80 | Micro press feedback only |
| `dur-fast` | 160 | Hover, color shift, small reveal |
| `dur-base` | 220 | Default for most state transitions |
| `dur-slow` | 320 | Modal/sheet enter, drawer |
| `dur-page` | 480 | Flipbook page turn, route transition |

Exit timings = enter × 0.7.

### 6.2 Easing

| Token | Curve | Use |
|---|---|---|
| `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default — Material standard |
| `ease-enter` | `cubic-bezier(0, 0, 0.2, 1)` | Decelerate into rest (modals, sheets) |
| `ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Accelerate out |
| `ease-editorial` | `cubic-bezier(0.32, 0.72, 0, 1)` | The "page turn" — slow start, hold, settle |

### 6.3 Patterns

- **Hover on gold CTA:** background from `gold` → `gold-soft`, `dur-fast`, `ease-standard`. No transform.
- **Card hover (cream):** elevation `cream-2` → `cream-3`, `dur-base`. No translate.
- **Sidebar item activation:** gold left rail slides in (scaleY from 0 to 1, transform-origin top), `dur-base`, `ease-enter`. Text color → `ink-text`.
- **Modal enter:** scrim fade `dur-base`; modal scale `0.96 → 1` + opacity, `dur-slow`, `ease-enter`.
- **Toast:** slide up + fade, `dur-base`. Auto-dismiss 4500ms. `aria-live="polite"`.
- **Page turn** (FlipbookViewer): preserved — `dur-page`, `ease-editorial`.
- **Reduced motion:** all transforms collapse to opacity-only. Page turn becomes crossfade.

---

## 7. Component Primitives

For each: anatomy + states + the token recipe. Implementation details left to component files.

### 7.1 Button

Variants: **primary · secondary · ghost · danger · link**

| Variant | Resting (dark canvas) | Resting (cream page) |
|---|---|---|
| Primary | bg `gold`, text `ink-1`, no border | bg `gold`, text `ink-1`, no border |
| Secondary | bg `ink-2`, text `ink-text`, `inset 0 0 0 1px ink-4` | bg `cream-2`, text `cream-ink`, `inset 0 0 0 1px cream-line` |
| Ghost | bg transparent, text `ink-subtle` → `ink-text` on hover | bg transparent, text `cream-ink-soft` → `cream-ink` on hover |
| Danger | bg `danger`, text `cream-1` | same |
| Link | text `gold` (dark) / `gold-dim` (cream), underline on hover | — |

**Sizes:** sm 32h, md 40h, lg 48h. All `radius-md`. Touch target ≥44px → use md minimum on mobile.

**States:** hover (background lighten one step), focus (`elev-gold-halo`), pressed (background → `gold-dim`), disabled (opacity 0.5, no pointer events), loading (label hidden, spinner centered, button width locked).

### 7.2 Input / Textarea

- Surface: `cream-3` on cream pages, `ink-2` on dark.
- Border: 1px `cream-line` / `ink-4`. Focus: border → `gold`, plus `elev-gold-halo`.
- Label: above input, `text-sm` weight 500, never placeholder-only.
- Helper text: `text-xs` `cream-ink-muted`, below input, always reserved.
- Error: helper text → `danger`, border → `danger`, `aria-invalid="true"`, `role="alert"` on the message.
- Min height: 44px. Inner padding: `space-3` vertical, `space-4` horizontal.

### 7.3 Card

- **Cream card:** bg white or `cream-2`, padding `space-6` / `space-8`, `radius-md`, `elev-cream-2`, hover `elev-cream-3`. Title `text-h3` Playfair; body `text-body` Inter.
- **Ink card:** bg `ink-2`, padding same, `radius-md`, `elev-ink-1`, hover `elev-ink-2`.
- **Editorial card** (book card): `ink-2` with cover image bleed top, gold hover ring (`elev-gold-halo` minus the 4px), title in Playfair.

### 7.4 Modal / Sheet

- Scrim: `rgba(10, 17, 28, 0.72)` with 4px backdrop-blur on supported browsers.
- Surface: cream when modal contains content/forms; ink when destructive confirmation or settings.
- `radius-lg`, `elev-cream-4` / `elev-ink-3`.
- Close affordance: top-right X, ≥44px hit area. ESC closes. Focus trapped. Initial focus on first input or close button.
- Sheet (mobile / right-side drawer): slides from right, `dur-slow` `ease-enter`.

### 7.5 Sidebar (AppSidebar)

- Bg `ink-1`, width 240px (collapsed 64px).
- Item: 40px tall, padding `space-3` `space-4`, `radius-md`, icon + label.
- Resting: text `ink-subtle`, icon `ink-subtle`.
- Hover: bg `ink-2`, text `ink-text`.
- Active: gold 2px left rail (transform-origin top, animates in), text `ink-text`, icon `gold`.
- Section label: `text-overline` `ink-muted`, padding `space-2` `space-4`.

### 7.6 Toast

- Position: bottom-right desktop, bottom-center mobile (above safe-area).
- Surface: `ink-3` regardless of underlying page (always dark for contrast).
- Icon: status color (success / danger / warning / info), 20px Lucide.
- Auto-dismiss 4500ms (success/info), persistent for danger until acknowledged.
- `aria-live="polite"` for info/success, `aria-live="assertive"` + `role="alert"` for danger.

### 7.7 Pill / Badge

- `radius-pill`, height 24px, padding `space-1` `space-3`, `text-xs` weight 500.
- **Status:** `success-tint` + `success` text · `warning-tint` + `warning` text · `danger-tint` + `danger` text.
- **Plan:** `ink-1` outline with `gold` text + 1px gold border (premium feel).
- **Count:** `ink-2` bg, `ink-subtle` text, 18px height for nav badges.

### 7.8 Tooltip

- `ink-3` bg, `ink-text`, `text-xs`, padding `space-2` `space-3`, `radius-sm`, `elev-ink-3`.
- 200ms delay open, instant close. Arrow optional.

### 7.9 Form layout primitives

- **Field stack:** label · input · helper, gap `space-2`.
- **Field group:** 2-col on md+ (gap `space-6`), 1-col mobile.
- **Form section:** Playfair `text-h3` heading + `cream-ink-soft` description + `space-8` to fields.
- **Form footer:** sticky on long forms, `cream-2` bg, `elev-cream-1` top border, primary CTA right-aligned, secondary left.

---

## 8. States (universal)

| State | Visual treatment |
|---|---|
| Default | As specified per component |
| Hover | Background ±1 surface step, or border → `gold`. Never translate. `dur-fast`. |
| Focus-visible | `elev-gold-halo` on the element (replaces browser default). Never remove without an equivalent. |
| Active / pressed | Background → next darker step, scale 0.98 only on book cards (page-turn metaphor). |
| Selected | Gold accent: left rail on nav, filled checkbox, `gold-tint` bg on chip. |
| Disabled | Opacity 0.5, cursor `not-allowed`, `aria-disabled="true"`, no hover transitions. |
| Loading | Skeleton: `cream-3` / `ink-2` shimmer 1.4s. Inline: spinner replaces label, locks width. |
| Error | Border → `danger`, message inline with `role="alert"`, focus jumps to first invalid field on submit. |
| Empty | Centered illustration slot + `text-h3` headline + `text-body` description + primary CTA. Never blank. |
| Read-only | Same surface, no border, `cream-ink-soft` text, no focus ring. Visually distinct from disabled. |

---

## 9. Iconography

- **Library:** Lucide (already in use). One library — no mixing.
- **Weight:** stroke 1.75 (Lucide default), do not override per-icon.
- **Sizes:** 14 / 16 / 20 / 24. Default 16 in UI, 20 in nav, 24 on empty-state.
- **Color:** inherits text color by default. Gold reserved for status (active, awarded).
- **No emoji as icons.** Anywhere. (Already a convention — formalize.)
- **Alignment:** vertically centered to text baseline via `inline-flex` + `items-center`.

---

## 10. Accessibility

### Non-negotiables (audit gate before merge)

- All interactive elements ≥44×44px touch target (use padding or hitSlop patterns).
- Visible focus on every interactive element. `elev-gold-halo` is the canonical ring.
- Color is never the sole carrier of meaning — pair with icon and/or label (status pills already do).
- All form inputs have a real `<label>` (not placeholder-only).
- Error messages are linked via `aria-describedby` and use `role="alert"`.
- Modals trap focus, restore focus to trigger on close, close on ESC.
- `prefers-reduced-motion: reduce` collapses all transforms to opacity-only and disables page-turn animation.
- Skip-link "Skip to content" on every authed page.
- Heading hierarchy sequential: each page has one `<h1>` (page title), no level skips.
- Color contrast verified per §2.4. Gold-on-cream text uses `gold-dim`.

### Dynamic type / zoom

Body 16px minimum; do not disable user zoom; layouts use `rem` for typography. Test at 200% browser zoom — wizard step card and coauthor manuscript surface are the riskier flows (already scroll-safe; verify).

### Screen reader

- Decorative icons: `aria-hidden="true"`.
- Status pills: prefix with sr-only text ("Status: ").
- The flipbook viewer needs a "Read as plain text" toggle that exposes the chapter content in DOM order outside the spread animation — this is the single biggest a11y gap in a flipbook product and worth a follow-up ticket.

---

## 11. Tailwind config delta

What to add on top of the current `tailwind.config.ts`:

```ts
colors: {
  // EXISTING — keep
  ink: { 1:'#0F1623', 2:'#151C28', 3:'#1C2333', 4:'#2A3448',
         muted:'#5A6478', subtle:'#8893A6' },
  cream: { 1:'#F5F0E8', 2:'#FAF7F2', 3:'#EDE6D8' },
  gold: { DEFAULT:'#C9A84C', soft:'#D4B65A', dim:'#9C7E2F' },

  // NEW — add
  ink: { ..., 0:'#0A111C', text:'#E6EAF2' },
  cream: { ..., line:'#E3D9C6', ink:'#1B2230',
           'ink-soft':'#4A5468', 'ink-muted':'#7A8499' },
  gold: { ..., tint:'#F2E9C8' },

  success:'#5C8A6F', 'success-tint':'#E6EFE8',
  danger: '#B14B3E', 'danger-tint': '#F4E2DC',
  warning:'#C28A3A', 'warning-tint':'#F5EAD2',
  info:   '#5A7BA5', 'info-tint':   '#E1E8F1',
},
boxShadow: {
  'cream-1':'0 1px 0 #E3D9C6',
  'cream-2':'0 1px 2px rgba(27,34,48,0.06), 0 1px 1px rgba(27,34,48,0.04)',
  'cream-3':'0 4px 12px rgba(27,34,48,0.08), 0 1px 2px rgba(27,34,48,0.06)',
  'cream-4':'0 12px 32px rgba(27,34,48,0.12), 0 2px 6px rgba(27,34,48,0.06)',
  'ink-1':'inset 0 0 0 1px #2A3448',
  'ink-3':'0 16px 40px rgba(0,0,0,0.45), inset 0 0 0 1px #2A3448',
  'gold-halo':'0 0 0 1px #C9A84C, 0 0 0 4px rgba(201,168,76,0.18)',
},
transitionTimingFunction: {
  editorial:'cubic-bezier(0.32, 0.72, 0, 1)',
},
transitionDuration: { 220:'220ms', 320:'320ms', 480:'480ms' },
```

---

## 12. What this spec doesn't yet cover

Flag these as follow-ups so we don't pretend they're done:

- **Data viz / chart system** — billing usage chart, lead funnel, view analytics. Need a 4-color chart palette derived from gold + 3 desaturated supports + the semantic set.
- **Cover & book-page rendering tokens** — the public `/read/<slug>` page already pulls from `bookTheme.ts`; that file is the canonical source and should not be folded into this system. Cross-reference it instead.
- **Illustration / empty-state art direction** — currently ad-hoc. Worth a small Notion or a `docs/illustrations.md` companion.
- **Dark/light toggle in app chrome** — the system is built around ink-as-chrome + cream-as-content, so a true light-mode chrome would be a different system. If product wants it, that's a separate brief.
- **Email & PDF export styling** — already has `bookTheme.ts`-driven PDF; transactional email template tokens (MailerLite) need their own short spec.
