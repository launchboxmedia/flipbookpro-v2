# FlipBookPro v2 — Architecture Notes for Future Sessions

This file is the orientation read-me for any AI session picking up work in
this codebase. Skim it once before making changes; the conventions here are
the result of an audit + several rebuild passes and not all of them are
obvious from reading individual files.

## What this is

A premium, dark-mode, AI-assisted flipbook creator. A user pastes an outline,
the wizard fills in metadata + style, then a co-author writing surface walks
them through chapter-by-chapter writing with AI critique + revision. Each
chapter gets a generated illustration; a cover gets generated from the book
overview. Books publish to a public `/read/<slug>` page with an email gate,
HTML / PDF export, and lead capture flowing into MailerLite + Telegram.

## Stack

- **Next.js 14 App Router** + TypeScript (strict). React 18.
- **Tailwind 3** with a token system (see _Design system_).
- **Supabase** (Postgres + Auth + Storage + RLS).
- **Anthropic SDK** (`@anthropic-ai/sdk`) — Claude Sonnet for drafts/chat,
  Claude Haiku for utilities (scene extraction, critique, JSON tasks).
- **OpenAI SDK** (`openai`) — `gpt-image-2` for chapter + cover images.
  Falls back to **Imagen 4** (`@google/generative-ai`) on any error.
- **Gemini Flash** — fallback text generation if Claude fails.
- **Stripe** — subscription billing (currently configured with placeholder
  price IDs; see _External integrations_).
- **Lucide** icons; **Playfair Display / Source Serif 4 / Inter** fonts via
  `next/font/google`.
- **Playwright** for e2e tests (`e2e/`).

## Run it

```sh
npm install
npm run dev   # next dev -p 3002
```

`.env.local` should set `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`GEMINI_API_KEY`, `MAILERLITE_API_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHAT_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_APP_URL`, plus the Supabase project URL + publishable key.
For Stripe pricing, also set `STRIPE_PRICE_STANDARD_MONTHLY`,
`STRIPE_PRICE_STANDARD_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`,
`STRIPE_PRICE_PRO_ANNUAL` (see `src/lib/stripe.ts`).

## Project structure

```
src/
  app/
    page.tsx                    # marketing landing (dark)
    login/, signup/             # auth (Supabase + Google OAuth)
    dashboard/                  # book grid (status-grouped)
    book/[bookId]/
      wizard/                   # 8-step setup
      coauthor/                 # writing surface (cream pages, dark sidebar)
      preview/                  # private flipbook (FlipbookViewer)
      publish/                  # publish settings
    read/[slug]/                # public flipbook + email gate
    settings/                   # profile / brand / billing / leads / api-keys
    api/
      books/[bookId]/
        setup/                  # finalise book from wizard
        update-style/           # palette + visual style live updates
        generate-draft/         # streaming chapter draft (SSE)
        generate-chapter-image/ # per-chapter image
        generate-cover-image/
        upload-cover/, upload-back-cover/, upload-chapter-image/
        chat/                   # chapter revision via chat
        critique/               # outline critique (5 flags)
        critique-chapter/       # per-chapter critique (7 flag types)
        critique-back-matter/   # back-cover copy critique
        pre-publish-check/      # blocker / warning / hint check
        publish/                # publish + slug allocation
        approve-chapter/
        back-cover/, back-matter/
        export-html/, export-pdf/  # HTML + print-PDF exports
        analytics/              # auth-gated view tracking
      detect-chapters/          # outline → chapter list (Haiku JSON)
      leads/                    # public lead-capture endpoint
      profile/                  # profile + logo upload
      stripe/                   # checkout, webhook, portal, connect
      resources/title-check, niche-eval
  components/
    coauthor/
      CoauthorShell.tsx         # state owner; spawns the stage components
      CoauthorSidebar.tsx       # legacy nested sidebar (replaced in
                                # dashboard/coauthor by AppSidebar)
      OutlineStage.tsx          # cream chapters + dark critique panel
      ChapterStage.tsx          # cream manuscript surface (left = brief +
                                # chat + illustration; right = draft + flags)
      BackMatterStage.tsx       # back-cover form + image upload
      CompleteStage.tsx         # pre-publish check + export buttons
    wizard/                     # 8 steps in cream; WizardShell is the host
    dashboard/
      DashboardGrid.tsx         # search + status-grouped client component
      BookCard.tsx, NewBookButton.tsx
    layout/AppSidebar.tsx       # global ink-1 sidebar (every authed page)
    preview/FlipbookViewer.tsx  # spread builder + page-flip animation
    read/EmailGate.tsx          # lead capture gate (with honeypot)
    settings/                   # BrandPanel, BillingPanel, ProfilePanel,
                                # StripeConnectButton
    ui/ImageLightbox.tsx        # click-to-enlarge for cover + chapter images
  lib/
    palettes.ts                 # 6 curated palettes + brand fallback +
                                # describeHex() (hex → plain color name)
    imageGeneration.ts          # 5-part prompt assembly, Haiku scene
                                # extraction, generateImage() orchestrator
                                # (gpt-image-2 → imagen-4 fallback)
    imageStyles.ts              # client-safe style options (no SDK imports)
    textGeneration.ts           # Sonnet → Gemini Flash → Flash Lite chain
                                # with timeouts + retries; model param for
                                # Haiku on utility routes
    bookTheme.ts                # CSS variable derivation for the book page
                                # styling (typography + cover_direction)
    rateLimit.ts                # consume_rate_limit RPC client wrapper
    stripe.ts                   # PLANS + isStripeConfigured guard
    supabase/server.ts, client.ts
    writing-standards.ts        # WRITING_STANDARDS + HUMANIZATION_PROMPT
                                # (only injected when humanize=true)
  types/database.ts             # Book, BookPage, Profile, etc.
supabase/migrations/            # SQL files; applied via Supabase MCP
e2e/                            # Playwright tests (auth, marketing, plan-gating)
```

## Design system (tokens are everything)

Defined in `tailwind.config.ts`:

- **Ink stack** (dark navy) — `ink-1` `#0F1623`, `ink-2` `#151C28`,
  `ink-3` `#1C2333`, `ink-4` `#2A3448`, plus `ink-muted` `#5A6478` and
  `ink-subtle` `#8893A6`. Used for the global sidebar, dark contrast
  panels (chat, critique), the dark canvas behind the wizard.
- **Cream stack** (warm pages) — `cream-1` `#F5F0E8`, `cream-2` `#FAF7F2`,
  `cream-3` `#EDE6D8`. Used for the chapter writing surface, outline page,
  wizard step card, settings pages.
- **Gold** — `gold` `#C9A84C`, `gold-soft` `#D4B65A`, `gold-dim`
  `#9C7E2F`. The primary accent: hover states, active progress,
  primary CTA buttons, gold-on-cream icons.
- **Compatibility aliases** — `canvas` (`#1A1A1A`), `page` (=cream),
  `accent` (the deep teal `#4A7C59` from book-themes), `cream`
  (singular, = `#F5F0E8`). These exist so unmigrated screens still
  build. Prefer the new tokens (`ink-*`, `cream-*`, `gold-*`) for
  any new UI.

Fonts (loaded once in `src/app/layout.tsx` via `next/font/google` and
exposed as CSS variables):
- `--font-playfair` Playfair Display — all headings (`font-playfair`)
- `--font-source-serif` Source Serif 4 — body prose, draft text
  (`font-source-serif`)
- `--font-inter` Inter — UI labels, buttons, navigation (`font-inter`)

Per-screen aesthetic cheat-sheet:
- **Dashboard** — dark canvas + ink sidebar + ink-2 book cards with
  gold hover ring; status-grouped sections (`Shelf-Ready` / `In
  Production`).
- **Wizard** — dark canvas with subtle radial gold; cream-1 step
  card; gold step pills; cream-on-cream form controls; gold pill CTAs.
- **Coauthor outline** — cream-1 page; white chapter cards w/ gold
  hover; dark ink-1 critique panel (clipboard against the page).
- **Coauthor chapter** — cream-1 right panel (manuscript) with
  ink-1 prose; cream-2 toolbar; emerald Approve; cream-2 footer.
- **Settings** — cream-1 main + ink-1 sidebar; white cards +
  cream-2/3 form wells.
- **Marketing** — dark hero + alternating dark sections; gold lockup;
  recommended-plan card highlighted with gold border + tinted shadow.
- **Public read** — dark `bg-[#111]` (gate) + the flipbook viewer's
  own surface from `bookTheme.ts`.

## AI pipeline — image generation

The whole image flow is in `src/lib/imageGeneration.ts`. **Read this
file before changing anything image-related.** Key invariants:

1. **Never put hex codes in image prompts** — `gpt-image-*` and Imagen
   render them as literal text in the image. Palettes carry both `hex`
   (for UI) and `colorNames` (for prompts). `describeHex()` converts
   user brand colors into hue family names (e.g. `#0F1623` →
   `'deep blue'`).

2. **5-part prompt structure** (every image — chapter, cover, custom):
   - Part 1 — Style: `[Visual style] style. Clean minimal professional
     illustration, simple and trustworthy.`
   - Part 2 — Palette: `Color palette: [primary name] as the dominant
     accent color, [secondary name] as the supporting tone, white
     background, plenty of breathing room.`
   - Part 3 — Composition: `Composition: clean negative space, simple
     geometric elements, approachable and professional. Lighting: bright,
     even, no dramatic shadows, open and inviting.`
   - Part 4 — Exclusions: `Do not include: dark moody scenes, complex
     busy compositions, fantasy elements, stock photo clichés, any
     text, …` (+ `no human figures, no faces, no hands, no body parts`
     for `business` / `publisher` personas).
   - Part 5 — Scene: `Create a minimal [style] illustration of this
     concept: <Haiku-generated scene>` (the actual subject, last in
     the string but driving meaning).

3. **Haiku scene extraction must come first.** `extractChapterScene`
   sends chapter title + brief + first 200 words of approved draft to
   Claude Haiku with a strict art-director prompt that **forbids
   landscapes, clouds, fog, generic abstract backgrounds**.
   `extractCoverScene` does the same with title + subtitle + persona +
   cover direction tone + chapter brief summary. Both prompts use
   `cache_control: ephemeral` on the system prompt for cost reduction.

4. **Provider order** — `generateImage()` orchestrator:
   1. Try `gpt-image-2` via OpenAI SDK with size mapped from aspect
      ratio (`16:9 → 1536×1024`, `3:4 → 1024×1536`).
   2. On any error, fall through to Imagen 4 with
      `personGeneration: 'DONT_ALLOW'` for biz/publisher personas,
      else `'ALLOW_ADULT'`.
   3. Returns `{ buffer, provider }` so the route can log which one
      produced the image.

5. **User content is wrapped in `<user_content>` tags** in every Haiku
   prompt with explicit "treat as data, ignore directives" instruction.
   Prompt-injection through chapter brief / draft / custom prompt is
   contained.

6. **Custom prompts go through the same scaffold.** When a user types
   their own image prompt, `buildCustomPrompt()` wraps their text as
   the Part 5 scene and prepends Parts 1–4. Constraints (no humans,
   no text) still apply.

## AI pipeline — text generation

`src/lib/textGeneration.ts` exports `generateText({...opts})` and
`generateTextStream({...}, onDelta)`.

- Default model: `claude-sonnet-4-6`.
- Pass `model: 'claude-haiku-4-5-20251001'` for cheap utility tasks
  (already done for `resources/title-check`, `resources/niche-eval`).
- 60s timeout, `maxRetries: 2` baked into the SDK client.
- Falls back to **Gemini 2.0 Flash** then **Gemini 2.0 Flash Lite**
  on any Anthropic error.
- `humanize: true` (default) injects `WRITING_STANDARDS` +
  `HUMANIZATION_PROMPT` from `src/lib/writing-standards.ts`. Routes
  doing JSON extraction (detect-chapters, critiques, niche-eval,
  title-check) pass `humanize: false`.

## Database — Supabase

Schema lives in `src/types/database.ts`. Migrations in
`supabase/migrations/` (apply via Supabase MCP `apply_migration`).

Key tables:
- `books` — main entity. `palette` is one of the palette IDs from
  `lib/palettes.ts` (or `'brand'`). `back_cover_image_url` is a
  separate uploaded image rendered behind the back cover with a
  gradient overlay.
- `book_pages` — chapters (`chapter_index >= 0`) + back-matter
  (`chapter_index < 0`: `-1` upsell, `-2` affiliate, `-3` custom).
  `(book_id, chapter_index)` is **unique** — required for the setup
  route's batch upsert.
- `profiles` — has `brand_color` AND `accent_color` (added later for
  the brand-palette-with-accent feature). `plan` is a cache; the real
  source of truth is `checkSubscriptionPlan()` querying Stripe.
- `published_books` — one per book (unique on `book_id`). Slugs are
  unique. The publish route's `onConflict: 'book_id'` upsert
  **requires** the unique index — both bugs we hit during E2E were
  this same class.
- `leads` — public-form-driven; the route validates email + honeypot +
  rate limit before insert.
- `rate_limits` — fixed-window counter; `consume_rate_limit(key,
  window_seconds)` RPC is the only entry point.
- `stripe_events` — webhook idempotency table; PK on `id`,
  unique-violation = "already processed".

RLS is on for every public table. Policies use `(SELECT auth.uid())`
(per-query) instead of bare `auth.uid()` (per-row) — important for
performance.

`SECURITY DEFINER` functions (`consume_rate_limit`,
`increment_books_created`, `increment_book_views`) had `EXECUTE`
revoked from `anon`; only `authenticated` can call them.

## Auth + plan gating

- Supabase email-password + Google OAuth. Email auto-confirm is on
  in this project (see `auth.users.email_confirmed_at`).
- The middleware (`src/middleware.ts`) refreshes the session on every
  request; pages that need auth call `supabase.auth.getUser()` and
  redirect.
- **Plan check** is centralised in `lib/stripe.ts` →
  `checkSubscriptionPlan(stripeCustomerId)`: queries Stripe for the
  active subscription and maps the price ID to `'free' | 'standard' |
  'pro'`. Don't read `profiles.plan` directly for gating decisions.
- `PLAN_LIMITS` in the same file: free 1/mo + 6 chapters, standard
  3/mo + 8, pro 10/mo + 15. The wizard caps chapter detection to the
  user's `maxChapters`.
- `/api/books/check-limit` returns `{ allowed, plan, used, limit }`
  and is called from `NewBookButton` before book creation.

## Rate limiting

Every AI route calls `consumeRateLimit(supabase, { key, max,
windowSeconds })` after auth and bails with 429 + `Retry-After` on
exceedance. Limits per user per hour:
- detect-chapters 20, generate-draft 60, chat 60, critique 20,
  critique-chapter 30, critique-back-matter 20, pre-publish-check 15,
  generate-chapter-image 30, generate-cover-image 20, title-check 30,
  niche-eval 30. Leads route is per-IP at 10/hour.

## Conventions / pitfalls

- **`onConflict` upserts require unique indexes.** Both `book_pages`
  and `published_books` have hit this. If you add another upsert
  pattern, also add the unique index in the same migration.
- **Defense-in-depth `.eq('user_id', user.id)` on every UPDATE** even
  when the prior `.single()` already verified ownership. RLS would
  catch it, but keeping the explicit filter in code makes review
  trivial.
- **`.select('*')` is OK on dashboard / preview / publish where the
  Book / BookPage / Profile types are fed into many components.**
  Hot AI routes were narrowed to specific columns (chat, back-matter
  GET, generate-cover-image, generate-chapter-image).
- **`reviewWithHaiku` is gone** — the older "rewrite the prompt for
  clarity" pass was removed. The 5-part scaffold is correct the first
  time; don't re-introduce a second Haiku pass.
- **Image storage cleanup** — when a chapter image is regenerated
  (or replaced via upload), the previous blob is best-effort deleted
  via `storagePathFromPublicUrl(url, 'book-images')` + `storage.remove`.
- **The flipbook bottom-edge fade** is intentional — `bodyFadeMask` in
  `FlipbookViewer.tsx` masks the bottom of chapter text so a clipped
  half-line softens to invisible instead of being sliced through
  letters. Don't remove it.
- **Console logs guarded by `DEBUG_PROMPTS=1`** in the image routes —
  full prompts contain user content, don't log them in prod.

## Lightbox + uploads

- `<ImageLightbox>` from `@/components/ui/ImageLightbox` — wraps a
  thumbnail; provides a focus-trapped dialog + dark backdrop.
  `<ImageLightboxOverlay>` is the controlled-mode version (use it
  when the thumbnail already has other clickable controls, like the
  cover thumbnail with regen + upload icons).
- Three uploads: `/api/books/[id]/upload-cover`,
  `/api/books/[id]/upload-chapter-image`,
  `/api/books/[id]/upload-back-cover`. All enforce MIME allowlist
  (PNG/JPEG/WebP only — **SVG is explicitly blocked** because of
  inline-script XSS), 5 MB cap, sanitised server-generated filename,
  defense-in-depth `user_id` on the update, best-effort cleanup of
  the previous blob.

## External integrations status

| Integration | Status |
|---|---|
| Anthropic | Working. Sonnet for drafts/chat, Haiku for utilities + scenes. |
| OpenAI gpt-image-2 | Wired as primary. If the model ID isn't available in your account, falls through to Imagen 4 transparently. |
| Imagen 4 | Working. Used as fallback. |
| Gemini Flash / Flash Lite | Used as text fallback if Claude fails. |
| Supabase | Working. Auth, storage, RLS, MCP migrations. |
| MailerLite | Wired. The leads route fires the enroll on every lead capture and logs failures. Receipt verification needs the MailerLite dashboard. |
| Telegram | Same shape — fires `sendMessage` on lead capture, logs failures. |
| Stripe — webhooks | Wired with idempotency table. Won't activate plans unless real `STRIPE_PRICE_*` IDs are set. |
| Stripe — checkout / portal | Working contract; uses `isStripeConfigured()` guard. |
| Stripe Connect | Wired (`/api/stripe/connect/*`) for author payouts. |

If `OPENAI_API_KEY` isn't set the OpenAI client is `null` and
`generateImage()` skips straight to Imagen — no error.

## Recent significant changes (chronological highlights)

- **8-pass audit + fix sweep** (commits `eedddff` … `d1c7465`) —
  IDOR fixes, rate limiting, prompt-injection wrapping, Stripe
  idempotency, FK indexes, RLS perf rewrite, JSON-LD on read pages.
  See `git log --grep "Pass [0-9]"` for the per-pass commit messages.
- **Image pipeline rebuild** (commit `271228d`) — palettes carry
  color names, `gpt-image-2` primary, 5-part prompt scaffold, Haiku
  scene extraction, `reviewWithHaiku` removed.
- **Coauthor analysis surface** (commits `753e90a`, `9e3db1a`,
  `130c5ff`) — per-chapter critique with Apply/Dismiss; back-matter
  copy critique; pre-publish check.
- **Lightbox + uploads everywhere** (commits `8ad372c`, `7ec0c8a`,
  `5aeedde`) — click-to-enlarge for cover + chapter; per-chapter
  upload; back-cover image rendered in viewer + PDF.
- **Design tokens + redesign** (commits `9aeddef`, `d70ca0f`,
  `940124b`, `710088e`, `5379bfa`) — ink/cream/gold tokens, dashboard
  redesign with status grouping, chapter cream surface, outline cream
  surface, wizard cream step controls, settings white surfaces,
  marketing token cleanup.
- **E2E bugs found via Playwright + fixed**: missing unique index on
  `book_pages(book_id, chapter_index)` (commit `86cc8ed`), same on
  `published_books(book_id)` (commit `7083b85`), dashboard slot
  counter spacing (commit `d70ca0f`).

## When picking up work

1. Run `npm run dev` and `npx tsc --noEmit` in parallel — confirm a
   clean baseline before editing.
2. Use the existing tokens (`ink-*`, `cream-*`, `gold-*`) for new UI;
   don't add hardcoded hex.
3. New AI routes: include auth check → rate-limit check → input
   validation → prompt-injection-tag-wrapping → output shape validation.
4. New DB writes that use `onConflict`: ship the unique index in the
   same commit.
5. Migrations: write the `.sql` file in `supabase/migrations/` AND
   apply it via Supabase MCP. Include rollback notes if non-trivial.
6. Image generation changes: respect the 5-part order. The scene
   description (Part 5) drives the meaning even though it appears
   last in the prompt string — image models weight it correctly when
   the modifiers come first.
