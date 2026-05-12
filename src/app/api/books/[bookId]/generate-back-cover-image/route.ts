import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildBackCoverPrompt,
  buildCustomPrompt,
  buildMascotBackCoverPrompt,
  buildPhotoBackCoverPrompt,
  extractBackCoverScene,
  generateImage,
  generateWithGPTImageEdit,
  personGenerationFor,
  storagePathFromPublicUrl,
} from '@/lib/imageGeneration'
import { resolvePaletteColors } from '@/lib/palettes'
import { consumeRateLimit } from '@/lib/rateLimit'

// Back-cover image generation. Three modes:
//   - 'ai'     — typography-companion design from buildBackCoverPrompt.
//                Haiku extracts a subtle atmospheric element; no rendered text.
//   - 'photo'  — author photo composed into the lower third via
//                openai.images.edit + buildPhotoBackCoverPrompt.
//   - 'mascot' — brand mascot composed into the lower third via
//                openai.images.edit + buildMascotBackCoverPrompt.
// Result lands on books.back_cover_image_url; storage path lives under
// back-covers/ for tidy bucket organisation.

// gpt-image-2 at quality:'high' on a portrait canvas can take ~120s for
// complex prompts (per OpenAI's stated upper bound). A route budget of
// exactly 120s collides with that upper bound — the route was being
// killed precisely as the model would have returned. 180s gives a real
// buffer past the model's worst case without crossing into Enterprise-
// only territory. Pair this with the SDK timeout in imageGeneration.ts
// (also bumped to 180_000ms) so the OpenAI client doesn't abort first.
export const maxDuration = 180

type BackCoverMode = 'ai' | 'mascot' | 'photo'

interface ProfileForBackCover {
  brand_color:  string | null
  accent_color: string | null
  avatar_url:   string | null
  mascot_url:   string | null
}

// 30s ceiling on the Supabase storage hop. Brand assets are at most
// 5 MB and live on Supabase's CDN — a healthy fetch resolves in
// hundreds of ms. Anything past 30s is a hung connection and burns
// the route's openai-call budget for no payoff. Throwing here surfaces
// a clear error instead of letting the route's maxDuration timer
// silently kill the whole request.
const ASSET_FETCH_TIMEOUT_MS = 30_000

async function fetchAssetBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ASSET_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`asset fetch failed (${res.status})`)
    const contentType = res.headers.get('content-type') ?? 'image/png'
    const buffer = Buffer.from(await res.arrayBuffer())
    return { buffer, contentType }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`asset fetch timed out after ${ASSET_FETCH_TIMEOUT_MS / 1000}s`)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
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
  const rawMode = typeof body?.mode === 'string' ? body.mode : 'ai'
  const mode: BackCoverMode = rawMode === 'mascot' || rawMode === 'photo' ? rawMode : 'ai'

  const [{ data: book }, { data: profile }] = await Promise.all([
    supabase.from('books').select('*').eq('id', params.bookId).eq('user_id', user.id).single(),
    supabase.from('profiles').select('brand_color, accent_color, avatar_url, mascot_url').eq('id', user.id).single<ProfileForBackCover>(),
  ])

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const paletteColors = resolvePaletteColors(book, profile ?? null)
    const trimmed = typeof customPrompt === 'string' ? customPrompt.trim() : ''

    let imageBuffer: Buffer

    if (mode === 'mascot' || mode === 'photo') {
      // Edit-mode back covers — same shape as the front-cover edit
      // path, but with the back-cover prompt builders. Custom prompts
      // are ignored in these modes; the layout brief is the whole
      // point.
      const assetUrl = mode === 'mascot' ? profile?.mascot_url : profile?.avatar_url
      if (!assetUrl) {
        const which = mode === 'mascot' ? 'a brand mascot' : 'an author photo'
        return NextResponse.json(
          { error: `Upload ${which} in Settings → Brand before using this back-cover style.` },
          { status: 400 },
        )
      }

      const { buffer: sourceBuf, contentType } = await fetchAssetBuffer(assetUrl)
      const filename = mode === 'mascot'
        ? `mascot.${extFromContentType(contentType)}`
        : `author.${extFromContentType(contentType)}`

      const finalPrompt = mode === 'mascot'
        ? buildMascotBackCoverPrompt(book, paletteColors.primaryName)
        : buildPhotoBackCoverPrompt(book,  paletteColors.primaryName)

      if (process.env.DEBUG_PROMPTS === '1') {
        console.log(`\n========== [generate-back-cover-image] PROMPT (${mode}) ==========`)
        console.log(`asset             : ${assetUrl}`)
        console.log(`palette           : ${paletteColors.primaryName} / ${paletteColors.secondaryName}`)
        console.log('--- final prompt ---')
        console.log(finalPrompt)
        console.log('===================================================================\n')
      }

      imageBuffer = await generateWithGPTImageEdit(
        { buffer: sourceBuf, filename, contentType },
        finalPrompt,
        '1024x1536',
        'high',
      )
    } else {
      // AI Generated path — subtle atmospheric companion to the front
      // cover. Unchanged from the prior behaviour.
      let scene: string | null = null
      let finalPrompt: string
      if (trimmed) {
        finalPrompt = buildCustomPrompt(trimmed, book, paletteColors)
      } else {
        scene = await extractBackCoverScene(book)
        finalPrompt = buildBackCoverPrompt(scene, book, paletteColors)
      }

      if (process.env.DEBUG_PROMPTS === '1') {
        console.log('\n========== [generate-back-cover-image] PROMPT (ai) ==========')
        console.log(`book.persona      : ${book.persona}`)
        console.log(`book.visual_style : ${book.visual_style}`)
        console.log(`book.palette      : ${book.palette} → ${paletteColors.source}`)
        console.log(`palette colors    : primary=${paletteColors.primary} secondary=${paletteColors.secondary}`)
        if (scene) console.log(`scene             : ${scene}`)
        console.log('--- final prompt ---')
        console.log(finalPrompt)
        console.log('=============================================================\n')
      }

      const generated = await generateImage(finalPrompt, {
        aspectRatio: '2:3',
        personGeneration: personGenerationFor(book),
      })
      imageBuffer = generated.buffer
    }

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
