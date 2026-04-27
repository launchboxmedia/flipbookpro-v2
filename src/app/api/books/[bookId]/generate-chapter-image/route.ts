import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildChapterPrompt,
  buildCustomPrompt,
  extractChapterScene,
  generateWithImagen,
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
    supabase.from('book_pages').select('*').eq('id', pageId).eq('book_id', params.bookId).single(),
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
      scene = await extractChapterScene(page, book)
      finalPrompt = buildChapterPrompt(scene, book, paletteColors)
    }

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

    const imageBuffer = await generateWithImagen(finalPrompt, '16:9')

    const filename = `chapters/${params.bookId}/${pageId}-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('book-images')
      .upload(filename, imageBuffer, { contentType: 'image/jpeg', upsert: true })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    const { data: { publicUrl } } = supabase.storage.from('book-images').getPublicUrl(filename)

    await supabase.from('book_pages').update({ image_url: publicUrl }).eq('id', pageId)

    return NextResponse.json({
      imageUrl: publicUrl,
      _debug: {
        persona: book.persona,
        visualStyle: book.visual_style,
        palette: book.palette,
        paletteColors,
        scene,
        finalPrompt,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[generate-chapter-image]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
