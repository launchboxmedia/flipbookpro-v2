// Post-process pass for the generated PNGs from generate-style-samples.ts.
// Resizes to wizard-display dimensions and converts to JPG to shrink the
// repo footprint from ~27MB (raw gpt-image-2 PNGs) to ~1-2MB total.
//
// Run with:
//   npx tsx scripts/compress-style-samples.ts
//
// Style samples are displayed at ~250×140 in the wizard; 2× retina is
// 500×280. We resize to 768×432 for headroom on larger viewports. Cover
// samples display at ~180×270; 2× retina is 360×540, target 512×768.
//
// Source PNGs are deleted after the JPG is written. Idempotent — running
// it twice after the same generation is a no-op (no PNG left to read).

import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'

interface Target {
  dir:    string
  width:  number
  height: number
}

const TARGETS: Target[] = [
  { dir: 'public/style-samples',  width: 768, height: 432 },   // 16:9
  { dir: 'public/cover-samples',  width: 512, height: 768 },   // 2:3
]

async function compressDir(t: Target) {
  let entries: string[] = []
  try {
    entries = await fs.readdir(t.dir)
  } catch {
    console.log(`(${t.dir} not found, skipping)`)
    return
  }

  const pngs = entries.filter((e) => e.toLowerCase().endsWith('.png'))
  if (pngs.length === 0) {
    console.log(`(${t.dir} — no PNGs to compress)`)
    return
  }

  console.log(`--- ${t.dir} (${t.width}×${t.height} JPG q85) ---`)
  for (const name of pngs) {
    const srcPath = path.join(t.dir, name)
    const dstPath = path.join(t.dir, name.replace(/\.png$/i, '.jpg'))
    try {
      const before = (await fs.stat(srcPath)).size
      await sharp(srcPath)
        .resize(t.width, t.height, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 85, progressive: true, mozjpeg: true })
        .toFile(dstPath)
      const after = (await fs.stat(dstPath)).size
      await fs.unlink(srcPath)
      const ratio = ((1 - after / before) * 100).toFixed(0)
      console.log(`  ✓ ${name.padEnd(28)} ${(before / 1024).toFixed(0).padStart(5)} KB → ${(after / 1024).toFixed(0).padStart(4)} KB  (-${ratio}%)`)
    } catch (e) {
      console.log(`  ✗ ${name.padEnd(28)} ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }
}

async function main() {
  for (const t of TARGETS) await compressDir(t)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
