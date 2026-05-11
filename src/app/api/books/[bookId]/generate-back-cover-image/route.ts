import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildBackCoverPrompt,
  buildCustomPrompt,
  extractBackCoverScene,
  generateImage,
  personGenerationFor,
  storagePathFromPublicUrl,
} from '@/lib/imageGeneration'
import { resolvePaletteColors } from '@/lib/palettes'
import { consumeRateLimit } from '@/lib/rateLimit'

// Back-cover image generation. Mirrors generate-cover-image, with three
// deliberate differences:
//   1. Scene comes from book metadata + the back-cover tagline/description
//      (no chapter content), so the result reads as a closing image rather
//      than a chapter scene.
//   2. Prompt uses buildBackCoverPrompt — same palette + style + exclusions
//      as the front cover, but a quieter, more atmospheric composition.
//   3. Result is saved to books.back_cover_image_url and the storage path
//      lives under back-covers/ for tidy bucket organisation.

export const maxDuration = 120

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await consumeRateLimit(supabase, {
    key: `gen-back-cover-img:${user.id}`,
    max: 20,
    windowSeconds: 3600,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in an hour.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const body = await req.json().catch(() => ({}))
  const customPrompt: string | undefined = body?.customPrompt

  const [{ data: book }, { data: profile }] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('profiles').select('brand_color, accent_color').eq('id', user.id).single(),
  ])

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const paletteColors = resolvePaletteColors(book, profile ?? null)
    const trimmed = typeof customPrompt === 'string' ? customPrompt.trim() : ''

    let scene: string | null = null
    let finalPrompt: string

    if (trimmed) {
      finalPrompt = buildCustomPrompt(trimmed, book, paletteColors)
    } else {
      scene = await extractBackCoverScene(book)
      finalPrompt = buildBackCoverPrompt(scene, book, paletteColors)
    }

    if (process.env.DEBUG_PROMPTS === '1') {
      console.log('\n========== [generate-back-cover-image] PROMPT ==========')
      console.log(`book.persona      : ${book.persona}`)
      console.log(`book.visual_style : ${book.visual_style}`)
      console.log(`book.palette      : ${book.palette} → ${paletteColors.source}`)
      console.log(`palette colors    : primary=${paletteColors.primary} secondary=${paletteColors.secondary}`)
      if (scene) console.log(`scene             : ${scene}`)
      console.log('--- final prompt ---')
      console.log(finalPrompt)
      console.log('=========================================================\n')
    }

    const { buffer: imageBuffer } = await generateImage(finalPrompt, {
      aspectRatio: '2:3',
      personGeneration: personGenerationFor(book),
    })

    const filename = `back-covers/${params.bookId}-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('book-images')
      .upload(filename, imageBuffer, { contentType: 'image/jpeg', upsert: true })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    const { data: { publicUrl } } = supabase.storage.from('book-images').getPublicUrl(filename)

    const oldPath = storagePathFromPublicUrl(book.back_cover_image_url, 'book-images')
    const { error: updateError } = await supabase
      .from('books')
      .update({ back_cover_image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', params.bookId)
      .eq('user_id', user.id)
    if (updateError) {
      console.error('[generate-back-cover-image] update failed:', updateError.message)
      return NextResponse.json({ error: 'Save failed' }, { status: 500 })
    }
    if (oldPath && oldPath !== filename) {
      void supabase.storage.from('book-images').remove([oldPath]).then(({ error }) => {
        if (error) console.error('[generate-back-cover-image] cleanup failed', error.message)
      })
    }

    return NextResponse.json({ imageUrl: publicUrl })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[generate-back-cover-image] failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
