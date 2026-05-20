// One-time generator for the wizard's visual-style + cover-direction
// sample images. Run with:
//
//   npx tsx scripts/generate-style-samples.ts
//
// Outputs to public/style-samples/<id>.png and public/cover-samples/<id>.png.
// PNGs (not JPGs) because gpt-image-2 returns PNG bytes — saving with the
// wrong extension would be misleading and may upset content negotiation.
//
// Self-contained on purpose: doesn't import from src/ so tsx doesn't need
// to resolve the @/* path aliases. The 5-part prompt assembly is inlined
// here and tracks the structure in src/lib/imageGeneration.ts; if that
// pipeline changes meaningfully, re-mirror it here and re-run.
//
// Per-image failures are logged but don't halt the run — partial output
// is acceptable, the components fall back to their CSS previews for any
// missing file.

import OpenAI from 'openai'
import fs from 'node:fs/promises'
import path from 'node:path'

// ── env loader (avoids the dotenv dep) ──────────────────────────────────────
// Next.js auto-loads .env.local for the app; standalone scripts don't.
// Minimal KEY=VALUE parser, ignores blank/comment lines.
async function loadEnvLocal() {
  try {
    const raw = await fs.readFile('.env.local', 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (key && !process.env[key]) process.env[key] = value
    }
  } catch {
    // No .env.local — env may already be populated by the shell.
  }
}

// ── Inline prompt assembly (mirrors src/lib/imageGeneration.ts) ─────────────

const STYLE_LABELS: Record<string, string> = {
  watercolor:     'Watercolor',
  photorealistic: 'Photorealistic',
  cinematic:      'Cinematic',
  illustrated:    'Editorial illustration',
  minimalist:     'Minimalist',
  vintage:        'Vintage print',
}

const PALETTE = {
  primaryName:   'deep teal',
  secondaryName: 'warm gold',
} as const

function part1Style(visualStyle: string): string {
  const label = STYLE_LABELS[visualStyle] ?? 'Editorial illustration'
  return `${label} style. Clean minimal professional illustration, simple and trustworthy. Mood: clean, professional, aspirational, trustworthy.`
}

function part2Palette(): string {
  return `Color palette: ${PALETTE.primaryName} as the dominant accent color, ${PALETTE.secondaryName} as the supporting tone, white background, plenty of breathing room.`
}

const PART3_COMPOSITION =
  'Composition: clean negative space, simple geometric elements, approachable and professional. Lighting: bright, even, no dramatic shadows, open and inviting.'

const PART4_EXCLUSIONS =
  'Do not include: dark moody scenes, complex busy compositions, fantasy elements, stock photo clichés, any text, any letters, any numbers, any labels, any captions, any typography of any kind, any written elements whatsoever, watermarks, logos, signatures. No human figures, no faces, no hands, no body parts of any kind.'

function buildStylePrompt(visualStyle: string, scene: string): string {
  const label = (STYLE_LABELS[visualStyle] ?? 'Editorial illustration').toLowerCase()
  return [
    part1Style(visualStyle),
    part2Palette(),
    PART3_COMPOSITION,
    PART4_EXCLUSIONS,
    `Create a minimal ${label} illustration of this concept: ${scene}`,
  ].join(' ')
}

// Cover direction → archetype, mirrors imageGeneration.ts.
const COVER_DIRECTION_TO_ARCHETYPE: Record<string, 'studio_product' | 'editorial' | 'lifestyle'> = {
  studio_product:     'studio_product',
  bold_operator:      'studio_product',
  cinematic_abstract: 'studio_product',
  clean_corporate:    'editorial',
  editorial_modern:   'editorial',
  retro_illustrated:  'lifestyle',
}

// Per-direction tones — differentiates directions that share an archetype.
const COVER_DIRECTION_TONES: Record<string, string> = {
  bold_operator:      'Bold, dominant, commanding authority — power through restraint',
  clean_corporate:    'Precise, credible, institutional — trust through order',
  editorial_modern:   'Sophisticated, editorial, typographic energy — clarity through contrast',
  cinematic_abstract: 'Atmospheric, cinematic, dramatic depth — emotion through light',
  retro_illustrated:  'Nostalgic, crafted, timeless character — heritage through detail',
  studio_product:     'Premium, minimal, object-centric — value through restraint',
}

// Per-direction cover scenes — visually distinct subjects, not a shared generic.
const COVER_DIRECTION_SCENES: Record<string, string> = {
  bold_operator:      'a powerful chess queen piece casting a long shadow',
  clean_corporate:    'a precise geometric network diagram with connected nodes',
  editorial_modern:   'bold overlapping abstract typographic shapes',
  cinematic_abstract: 'volumetric light rays piercing through atmospheric darkness',
  retro_illustrated:  'a vintage compass rose with ornamental detailing',
  studio_product:     'a single premium object — a watch or wireless earbuds — on a minimal surface',
}

// Per-direction palettes — each direction has its own dominant + accent pair.
const COVER_DIRECTION_PALETTES: Record<string, { primaryName: string; secondaryName: string }> = {
  bold_operator:      { primaryName: 'deep navy',     secondaryName: 'warm gold' },
  clean_corporate:    { primaryName: 'dark slate',    secondaryName: 'warm copper' },
  editorial_modern:   { primaryName: 'deep charcoal', secondaryName: 'dusty rose' },
  cinematic_abstract: { primaryName: 'deep teal',     secondaryName: 'warm gold' },
  retro_illustrated:  { primaryName: 'forest green',  secondaryName: 'amber' },
  studio_product:     { primaryName: 'deep burgundy', secondaryName: 'warm sand' },
}

function buildCoverPrompt(
  direction: string,
  scene: string,
  palette: { primaryName: string; secondaryName: string },
  tone: string,
): string {
  const archetype = COVER_DIRECTION_TO_ARCHETYPE[direction] ?? 'studio_product'
  const designStyle =
    archetype === 'studio_product'
      ? `Dark ${palette.primaryName} background. Gold or white bold title. One strong central object (phone, card, symbol) in the middle third. Clean border frame in gold. Author at bottom in gold or white.`
      : archetype === 'editorial'
        ? 'White or cream background. Dark bold title filling upper half. One minimal graphic element in center. Thin rule lines as dividers. Author at bottom in dark ink.'
        : `Deep ${palette.primaryName} background with subtle texture. ${palette.secondaryName} accent title. Central graphic object. Author at bottom.`

  return [
    'Professional book cover design for a business nonfiction book. Typography-first layout.',
    '',
    'REQUIRED TEXT TO RENDER (must appear legibly):',
    '- TITLE: "Sample Title" — large bold display font, upper portion of cover, high contrast',
    '- SUBTITLE: "A Subtitle Goes Here" — smaller, below title or below central graphic',
    '- AUTHOR: "Author Name" — bottom of cover, clean sans-serif',
    '',
    `DESIGN STYLE (${archetype}): ${designStyle}`,
    `Tonal direction: ${tone}`,
    '',
    `COLOR: ${palette.primaryName} and ${palette.secondaryName} from the palette. High contrast between background and title text is mandatory.`,
    '',
    `CENTRAL GRAPHIC: ${scene}`,
    'The graphic is ONE object — not a scene. It sits in the center third of the cover, below the title, above the author name. It is secondary to the typography.',
    '',
    'QUALITY REQUIREMENTS:',
    '- All text must be crisp and fully legible',
    '- No blurry, distorted, or illegible letters',
    '- Spacing between title, graphic, and author must be balanced and intentional',
    '- Looks like a published book from a major publisher, not a self-published template',
    '- Similar quality to: Atomic Habits, Psychology of Money, I Will Teach You To Be Rich',
    '',
    'Do not include: busy complex backgrounds, multiple people, lifestyle photography, blurry text, decorative borders that look cheap, clipart, watermarks, false brand logos. Human figures allowed only as small non-face silhouettes if essential to the concept.',
  ].join('\n')
}

// ── Image generation ────────────────────────────────────────────────────────

async function generateOne(
  client: OpenAI,
  prompt: string,
  size: '1024x1024' | '1024x1536' | '1536x1024',
  outPath: string,
): Promise<{ ok: true; bytes: number } | { ok: false; error: string }> {
  try {
    const result = await client.images.generate({
      model:   'gpt-image-2',
      prompt,
      size,
      quality: 'high',
      n:       1,
    })
    const data = result.data?.[0]
    if (!data) return { ok: false, error: 'no data returned' }

    let buffer: Buffer
    if (data.b64_json) {
      buffer = Buffer.from(data.b64_json, 'base64')
    } else if (data.url) {
      const res = await fetch(data.url)
      if (!res.ok) return { ok: false, error: `fetch ${res.status}` }
      buffer = Buffer.from(await res.arrayBuffer())
    } else {
      return { ok: false, error: 'no b64_json or url' }
    }

    if (buffer.byteLength < 1000) return { ok: false, error: 'image too small' }
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, buffer)
    return { ok: true, bytes: buffer.byteLength }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────

const STYLE_IDS = ['watercolor', 'photorealistic', 'cinematic', 'illustrated', 'minimalist', 'vintage'] as const
const COVER_IDS = ['bold_operator', 'clean_corporate', 'editorial_modern', 'cinematic_abstract', 'retro_illustrated', 'studio_product'] as const

// Shared scene for visual style samples (neutral subject to let style dominate).
const STYLE_SCENE = 'a professional desk with a laptop, a coffee cup, and a notebook on a clean wooden surface'

async function main() {
  await loadEnvLocal()
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set — aborting')
    process.exit(1)
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 180_000, maxRetries: 1 })

  const startedAt = Date.now()

  // Visual style samples — uncomment to regenerate (not needed this run).
  // console.log('--- Visual style samples (16:9, high) ---')
  // for (const id of STYLE_IDS) {
  //   const t0 = Date.now()
  //   const result = await generateOne(
  //     client,
  //     buildStylePrompt(id, STYLE_SCENE),
  //     '1536x1024',
  //     path.join('public', 'style-samples', `${id}.png`),
  //   )
  //   const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  //   if (result.ok) {
  //     console.log(`  ✓ ${id.padEnd(15)} ${result.bytes.toLocaleString()} bytes  (${elapsed}s)`)
  //   } else {
  //     console.log(`  ✗ ${id.padEnd(15)} ${result.error}  (${elapsed}s)`)
  //   }
  // }

  // Suppress unused-variable warning while style loop is commented out.
  void STYLE_IDS
  void STYLE_SCENE
  void buildStylePrompt

  console.log('--- Cover direction samples (2:3, high) ---')
  for (const id of COVER_IDS) {
    const scene   = COVER_DIRECTION_SCENES[id]   ?? 'a minimalist abstract icon'
    const palette = COVER_DIRECTION_PALETTES[id] ?? PALETTE
    const tone    = COVER_DIRECTION_TONES[id]    ?? ''
    const t0 = Date.now()
    const result = await generateOne(
      client,
      buildCoverPrompt(id, scene, palette, tone),
      '1024x1536',
      path.join('public', 'cover-samples', `${id}.png`),
    )
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    if (result.ok) {
      console.log(`  ✓ ${id.padEnd(20)} ${result.bytes.toLocaleString()} bytes  (${elapsed}s)`)
    } else {
      console.log(`  ✗ ${id.padEnd(20)} ${result.error}  (${elapsed}s)`)
    }
  }

  const totalMin = ((Date.now() - startedAt) / 60_000).toFixed(1)
  console.log('')
  console.log(`Done in ${totalMin} min`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
