import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildCoverPrompt,
  buildCustomPrompt,
  buildMascotCoverPrompt,
  buildPhotoCoverPrompt,
  extractCoverScene,
  generateImage,
  generateWithGPTImageEdit,
  personGenerationFor,
  storagePathFromPublicUrl,
} from '@/lib/imageGeneration'
import { resolvePaletteColors } from '@/lib/palettes'
import { consumeRateLimit } from '@/lib/rateLimit'

export const maxDuration = 120

type CoverMode = 'ai' | 'mascot' | 'photo'

interface ProfileForCover {
  brand_color:  string | null
  accent_color: string | null
  avatar_url:   string | null
  mascot_url:   string | null
}

/** Fetch a brand asset URL into memory so we can hand it to gpt-image-2's
 *  edit endpoint. The URL is a public Supabase storage URL produced by
 *  /api/profile/{logo|author-photo|mascot}; fetching is straightforward
 *  HTTP. */
async function fetchAssetBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`asset fetch failed (${res.status})`)
  const contentType = res.headers.get('content-type') ?? 'image/png'
  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer, contentType }
}

function extFromContentType(ct: string): string {
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  return 'png'
}

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
  const rawMode = typeof body?.mode === 'string' ? body.mode : 'ai'
  const mode: CoverMode = rawMode === 'mascot' || rawMode === 'photo' ? rawMode : 'ai'

  const [{ data: book }, { data: pages }, { data: profile }] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('book_pages').select('chapter_brief').eq('book_id', params.bookId).gte('chapter_index', 0).order('chapter_index'),
    supabase.from('profiles').select('brand_color, accent_color, avatar_url, mascot_url').eq('id', user.id).single<ProfileForCover>(),
  ])

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const paletteColors = resolvePaletteColors(book, profile ?? null)
    const trimmed = typeof customPrompt === 'string' ? customPrompt.trim() : ''

    let scene: string | null = null
    let imageBuffer: Buffer

    if (mode === 'mascot' || mode === 'photo') {
      // Edit-mode covers — the brand asset becomes the seed image and
      // gpt-image-2 composes the typography layout around it. Custom
      // prompts are ignored in these modes; the layout prompt is the
      // whole point.
      const assetUrl = mode === 'mascot' ? profile?.mascot_url : profile?.avatar_url
      if (!assetUrl) {
        const which = mode === 'mascot' ? 'a brand mascot' : 'an author photo'
        return NextResponse.json(
          { error: `Upload ${which} in Settings → Brand before using this cover style.` },
          { status: 400 },
        )
      }

      const { buffer: sourceBuf, contentType } = await fetchAssetBuffer(assetUrl)
      const filename = mode === 'mascot'
        ? `mascot.${extFromContentType(contentType)}`
        : `author.${extFromContentType(contentType)}`

      const finalPrompt = mode === 'mascot'
        ? buildMascotCoverPrompt(book, paletteColors.primaryName, paletteColors.secondaryName)
        : buildPhotoCoverPrompt(book,  paletteColors.primaryName, paletteColors.secondaryName)

      if (process.env.DEBUG_PROMPTS === '1') {
        console.log(`\n========== [generate-cover-image] PROMPT (${mode}) ==========`)
        console.log(`asset             : ${assetUrl}`)
        console.log(`palette           : ${paletteColors.primaryName} / ${paletteColors.secondaryName}`)
        console.log('--- final prompt ---')
        console.log(finalPrompt)
        console.log('=============================================================\n')
      }

      imageBuffer = await generateWithGPTImageEdit(
        { buffer: sourceBuf, filename, contentType },
        finalPrompt,
        '1024x1536',
        'high',
      )
    } else {
      // AI Generated (Phase 1 path). Unchanged.
      let finalPrompt: string
      if (trimmed) {
        finalPrompt = buildCustomPrompt(trimmed, book, paletteColors)
      } else {
        scene = await extractCoverScene(book, pages ?? [])
        finalPrompt = buildCoverPrompt(scene, book, paletteColors)
      }

      if (process.env.DEBUG_PROMPTS === '1') {
        console.log('\n========== [generate-cover-image] PROMPT (ai) ==========')
        console.log(`book.persona      : ${book.persona}`)
        console.log(`book.visual_style : ${book.visual_style}`)
        console.log(`book.palette      : ${book.palette} → ${paletteColors.source}`)
        console.log(`palette colors    : primary=${paletteColors.primary} secondary=${paletteColors.secondary}`)
        if (scene) console.log(`scene             : ${scene}`)
        console.log('--- final prompt ---')
        console.log(finalPrompt)
        console.log('========================================================\n')
      }

      const generated = await generateImage(finalPrompt, {
        aspectRatio: '2:3',
        personGeneration: personGenerationFor(book),
        // Covers render typography directly into the image (title +
        // subtitle + author). 'high' costs more but is noticeably
        // sharper on the rendered letterforms — worth it for the one
        // image readers see first.
        quality: 'high',
      })
      imageBuffer = generated.buffer
    }

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
