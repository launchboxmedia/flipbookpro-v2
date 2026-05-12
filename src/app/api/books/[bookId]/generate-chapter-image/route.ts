import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildChapterPrompt,
  buildCustomPrompt,
  extractChapterScene,
  generateImage,
  personGenerationFor,
  storagePathFromPublicUrl,
} from '@/lib/imageGeneration'
import { resolvePaletteColors } from '@/lib/palettes'
import { consumeRateLimit } from '@/lib/rateLimit'

export const maxDuration = 120

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await consumeRateLimit(supabase, { key: `gen-chapter-img:${user.id}`, max: 30, windowSeconds: 3600 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in an hour.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }

  const { pageId, customPrompt } = await req.json()
  if (!pageId) return NextResponse.json({ error: 'pageId required' }, { status: 400 })

  const [{ data: book }, { data: page }, { data: profile }] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('book_pages').select('id, chapter_title, chapter_brief, content, image_url, image_scene').eq('id', pageId).eq('book_id', params.bookId).single(),
    supabase.from('profiles').select('brand_color, accent_color').eq('id', user.id).single(),
  ])

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 })

  try {
    const paletteColors = resolvePaletteColors(book, profile ?? null)
    const trimmed = typeof customPrompt === 'string' ? customPrompt.trim() : ''

    let scene: string | null = null
    let finalPrompt: string

    if (trimmed) {
      finalPrompt = buildCustomPrompt(trimmed, book, paletteColors)
    } else {
      // Pass the previously-saved scene (if any) so Sonnet can take a
      // visually different approach when this is a regenerate. First-time
      // generations have image_scene = null and produce a fresh brief
      // without the regen-context block.
      scene = await extractChapterScene(
        page,
        book,
        paletteColors.primaryName,
        paletteColors.secondaryName,
        page.image_scene ?? null,
      )
      finalPrompt = buildChapterPrompt(scene, book, paletteColors)

      // Persist the new scene BEFORE generateImage() runs. If image
      // generation fails (gpt-image-2 timeout / 5xx / content policy),
      // we still want the latest brief saved so the next regenerate
      // diverges from THIS attempt instead of the older stale one. The
      // image_url update happens later, after upload — losing the image
      // step doesn't lose the scene step.
      await supabase
        .from('book_pages')
        .update({ image_scene: scene })
        .eq('id', pageId)
        .eq('user_id', user.id)
    }

    if (process.env.DEBUG_PROMPTS === '1') {
      console.log('\n========== [generate-chapter-image] PROMPT ==========')
      console.log(`book.persona      : ${book.persona}`)
      console.log(`book.visual_style : ${book.visual_style}`)
      console.log(`book.palette      : ${book.palette} → ${paletteColors.source}`)
      console.log(`palette colors    : primary=${paletteColors.primary} secondary=${paletteColors.secondary}`)
      console.log(`page.chapter_title: ${page.chapter_title}`)
      if (scene) console.log(`scene             : ${scene}`)
      console.log('--- final prompt ---')
      console.log(finalPrompt)
      console.log('======================================================\n')
    }

    const { buffer: imageBuffer, provider } = await generateImage(finalPrompt, {
      aspectRatio: '3:4',
      personGeneration: personGenerationFor(book),
    })

    const filename = `chapters/${params.bookId}/${pageId}-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('book-images')
      .upload(filename, imageBuffer, { contentType: 'image/jpeg', upsert: true })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    const { data: { publicUrl } } = supabase.storage.from('book-images').getPublicUrl(filename)

    const oldPath = storagePathFromPublicUrl(page.image_url, 'book-images')
    // Only the image_url update happens here — image_scene was already
    // persisted right after extractChapterScene() returned, before
    // generateImage(). Custom-prompt regenerations leave image_scene
    // untouched (scene is null in that branch), so a future auto-regen
    // can still surface the last auto-scene as a starting point.
    await supabase
      .from('book_pages')
      .update({ image_url: publicUrl })
      .eq('id', pageId)
      .eq('user_id', user.id)
    // Best-effort cleanup of the previous image. Don't block on errors.
    if (oldPath && oldPath !== filename) {
      void supabase.storage.from('book-images').remove([oldPath]).then(({ error }) => {
        if (error) console.error('[generate-chapter-image] cleanup failed', error.message)
      })
    }

    return NextResponse.json({
      imageUrl: publicUrl,
      provider,
      scene,
      _debug: {
        persona: book.persona,
        visualStyle: book.visual_style,
        palette: book.palette,
        paletteColors,
        scene,
        finalPrompt,
        provider,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[generate-chapter-image]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
