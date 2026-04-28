import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildCoverPrompt,
  buildCustomPrompt,
  extractCoverScene,
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

  const rl = await consumeRateLimit(supabase, { key: `gen-cover-img:${user.id}`, max: 20, windowSeconds: 3600 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in an hour.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }

  const body = await req.json().catch(() => ({}))
  const customPrompt: string | undefined = body?.customPrompt

  const [{ data: book }, { data: pages }, { data: profile }] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('book_pages').select('chapter_brief').eq('book_id', params.bookId).gte('chapter_index', 0).order('chapter_index'),
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
      scene = await extractCoverScene(book, pages ?? [])
      finalPrompt = buildCoverPrompt(scene, book, paletteColors)
    }

    if (process.env.DEBUG_PROMPTS === '1') {
      console.log('\n========== [generate-cover-image] PROMPT ==========')
      console.log(`book.persona      : ${book.persona}`)
      console.log(`book.visual_style : ${book.visual_style}`)
      console.log(`book.palette      : ${book.palette} → ${paletteColors.source}`)
      console.log(`palette colors    : primary=${paletteColors.primary} secondary=${paletteColors.secondary}`)
      if (scene) console.log(`scene             : ${scene}`)
      console.log('--- final prompt ---')
      console.log(finalPrompt)
      console.log('====================================================\n')
    }

    const { buffer: imageBuffer } = await generateImage(finalPrompt, {
      aspectRatio: '3:4',
      personGeneration: personGenerationFor(book),
    })

    const filename = `covers/${params.bookId}-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('book-images')
      .upload(filename, imageBuffer, { contentType: 'image/jpeg', upsert: true })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    const { data: { publicUrl } } = supabase.storage.from('book-images').getPublicUrl(filename)

    const oldPath = storagePathFromPublicUrl(book.cover_image_url, 'book-images')
    await supabase.from('books')
      .update({ cover_image_url: publicUrl })
      .eq('id', params.bookId)
      .eq('user_id', user.id)
    if (oldPath && oldPath !== filename) {
      void supabase.storage.from('book-images').remove([oldPath]).then(({ error }) => {
        if (error) console.error('[generate-cover-image] cleanup failed', error.message)
      })
    }

    return NextResponse.json({ imageUrl: publicUrl })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
