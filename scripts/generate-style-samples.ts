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

// Per-style scenes and palettes — different subjects to showcase style differences.
const VISUAL_STYLE_SAMPLES: Record<string, { scene: string; palette: { primaryName: string; secondaryName: string } }> = {
  watercolor: {
    scene: 'a woman reading in a cozy armchair by a rainy window with bookshelves behind her',
    palette: { primaryName: 'deep charcoal', secondaryName: 'dusty rose' },
  },
  photorealistic: {
    scene: 'a modern city skyline at golden hour with dramatic clouds and sharp glass buildings',
    palette: { primaryName: 'deep navy', secondaryName: 'warm gold' },
  },
  cinematic: {
    scene: 'a lone figure walking down a rain-slicked city street at night with neon light reflections',
    palette: { primaryName: 'deep teal', secondaryName: 'warm gold' },
  },
  illustrated: {
    scene: 'an entrepreneur climbing a geometric staircase made of stacked books rising toward a bright goal',
    palette: { primaryName: 'forest green', secondaryName: 'amber' },
  },
  minimalist: {
    scene: 'a single small plant on a vast empty white surface with one thin shadow',
    palette: { primaryName: 'dark slate', secondaryName: 'warm copper' },
  },
  vintage: {
    scene: 'a grand old library with floor-to-ceiling bookshelves, a rolling ladder, and warm lamplight casting long shadows',
    palette: { primaryName: 'deep burgundy', secondaryName: 'warm sand' },
  },
}

function part1Style(visualStyle: string): string {
  const label = STYLE_LABELS[visualStyle] ?? 'Editorial illustration'
  return `${label} style. Clean minimal professional illustration, simple and trustworthy. Mood: clean, professional, aspirational, trustworthy.`
}

function part2Palette(palette: { primaryName: string; secondaryName: string }): string {
  return `Color palette: ${palette.primaryName} as the dominant accent color, ${palette.secondaryName} as the supporting tone, white background, plenty of breathing room.`
}

const PART3_COMPOSITION =
  'Composition: clean negative space, simple geometric elements, approachable and professional. Lighting: bright, even, no dramatic shadows, open and inviting.'

const PART4_EXCLUSIONS =
  'Do not include: dark moody scenes, complex busy compositions, fantasy elements, stock photo clichés, any text, any letters, any numbers, any labels, any captions, any typography of any kind, any written elements whatsoever, watermarks, logos, signatures. No human figures, no faces, no hands, no body parts of any kind.'

function buildStylePrompt(visualStyle: string, scene: string, palette: { primaryName: string; secondaryName: string }): string {
  const label = (STYLE_LABELS[visualStyle] ?? 'Editorial illustration').toLowerCase()
  return [
    part1Style(visualStyle),
    part2Palette(palette),
    PART3_COMPOSITION,
    PART4_EXCLUSIONS,
    `Create a minimal ${label} illustration of this concept: ${scene}`,
  ].join(' ')
}

// Cover direction → design style. Each direction now has its own unique
// layout, matching the expanded COVER_DESIGN_STYLES in imageGeneration.ts.
const COVER_DESIGN_STYLES: Record<string, (primary: string, secondary: string) => string> = {
  bold_operator: (p) =>
    `Full bleed dark ${p} background. OVERSIZED title text fills the entire upper two-thirds — the typography IS the design element. No central object needed. Author name small at very bottom in gold or white. The boldness comes purely from the scale and weight of the title words.`,

  clean_corporate: (_, s) =>
    `White or light cream background. Single strong central object in upper half — clean, precise, professional (a graph, compass, or geometric symbol). Title below the object in dark refined sans-serif typography. Thin horizontal rule separating title from author. Maximum white space. Object-led composition. ${s} accent elements.`,

  editorial_modern: (p) =>
    `Bold color blocking — upper half ${p} solid color, lower half white or cream. Large confident title sits at the color boundary spanning both halves. Author name small at bottom. No illustration needed — the geometric color split IS the design. Magazine-editorial aesthetic.`,

  cinematic_abstract: (p) =>
    `Full bleed atmospheric scene fills the entire cover — deep space, dramatic sky, or abstract environmental mood in ${p} tones. Title floats in the middle third with subtle dark gradient behind text for legibility. Author name very small at bottom edge. Immersive, cinematic, no hard borders.`,

  retro_illustrated: (_, s) =>
    `Warm ${s} background with ornate decorative border frame. Central hand-illustrated scene inside the frame — a character, landscape, or symbolic object. Title in vintage lettering at top inside the border. Author name at bottom in smaller vintage type. Classic paperback aesthetic.`,

  studio_product: (p) =>
    `Pure white background. Single premium object floating in center with perfect studio lighting and subtle drop shadow — feels like luxury product photography. Title below center in minimal refined ${p} typography. Maximum negative space. Premium, restrained, Apple-aesthetic.`,
}

// Per-direction tones — aesthetic description for context.
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
  const designStyle = (COVER_DESIGN_STYLES[direction] ?? COVER_DESIGN_STYLES['studio_product'])(
    palette.primaryName,
    palette.secondaryName,
  )

  // Direction-specific openers that match the design style
  const openers: Record<string, string> = {
    bold_operator: 'Bold typographic book cover. The title text IS the design.',
    clean_corporate: 'Clean professional book cover. Object-led composition.',
    editorial_modern: 'Editorial magazine-style book cover. Color blocking layout.',
    cinematic_abstract: 'Cinematic atmospheric book cover. Full bleed scene.',
    retro_illustrated: 'Vintage illustrated book cover. Classic paperback style.',
    studio_product: 'Premium minimal book cover. Luxury product aesthetic.',
  }
  const opener = openers[direction] ?? 'Professional book cover design.'

  // Directions that use a central object vs those that don't
  const usesObject = ['clean_corporate', 'retro_illustrated', 'studio_product'].includes(direction)

  const sceneSection = usesObject
    ? [
        `CENTRAL GRAPHIC: ${scene}`,
        'The graphic is ONE object — not a scene. Sits below the title, above the author name. Secondary to the typography.',
      ]
    : [
        `ATMOSPHERE: ${scene}`,
        'This is mood/atmosphere only — NOT a central object. Let the design style instruction above determine the layout. Do not place an object in the center.',
      ]

  return [
    opener,
    '',
    'REQUIRED TEXT TO RENDER (must appear legibly):',
    '- TITLE: "Sample Title" — large bold display font, upper portion of cover, high contrast',
    '- SUBTITLE: "A Subtitle Goes Here" — smaller, below title or below central graphic',
    '- AUTHOR: "Author Name" — bottom of cover, clean sans-serif',
    '',
    `DESIGN STYLE (${direction}): ${designStyle}`,
    `Tonal direction: ${tone}`,
    '',
    `COLOR: ${palette.primaryName} and ${palette.secondaryName} from the palette. High contrast between background and title text is mandatory.`,
    '',
    ...sceneSection,
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

  console.log('--- Visual style samples (16:9, high) ---')
  for (const id of STYLE_IDS) {
    const sample = VISUAL_STYLE_SAMPLES[id]
    if (!sample) {
      console.log(`  ✗ ${id.padEnd(15)} no sample data defined`)
      continue
    }
    const t0 = Date.now()
    const result = await generateOne(
      client,
      buildStylePrompt(id, sample.scene, sample.palette),
      '1536x1024',
      path.join('public', 'style-samples', `${id}.jpg`),
    )
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    if (result.ok) {
      console.log(`  ✓ ${id.padEnd(15)} ${result.bytes.toLocaleString()} bytes  (${elapsed}s)`)
    } else {
      console.log(`  ✗ ${id.padEnd(15)} ${result.error}  (${elapsed}s)`)
    }
  }

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
      path.join('public', 'cover-samples', `${id}.jpg`),
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
