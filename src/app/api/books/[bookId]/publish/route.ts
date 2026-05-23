import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@/lib/supabase/server'
import { generateEmailSequence } from '@/lib/generateEmailSequence'
import { validateApiKey } from '@/lib/apiKeys'
import { supabaseAdmin } from '@/lib/supabase/admin'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  let supabase = await createClient()
  let userId: string

  const authResult = await supabase.auth.getUser()
  if (authResult.data.user) {
    userId = authResult.data.user.id
  } else {
    const apiAuth = await validateApiKey(req)
    if (!apiAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = apiAuth.userId
    supabase = supabaseAdmin
  }

  const body = await req.json().catch(() => ({}))

  // accessType is the new authoritative gating field. If a legacy client
  // still posts gateType, derive accessType from it so old code keeps
  // working. Both columns are written to keep them in sync.
  const RAW_ACCESS = (body.accessType ?? body.gateType) as string | undefined
  const accessType: 'free' | 'email' | 'paid' = (() => {
    switch (RAW_ACCESS) {
      case 'free':    return 'free'
      case 'paid':    return 'paid'
      case 'email':   return 'email'
      // legacy gate_type values
      case 'none':    return 'free'
      case 'payment': return 'paid'
      default:        return 'email'
    }
  })()

  const gateType: 'none' | 'email' | 'payment' =
    accessType === 'free' ? 'none' :
    accessType === 'paid' ? 'payment' :
                            'email'

  // Price is only meaningful for paid books. Stored as integer cents.
  // Minimum $1 (100¢) when paid; ignored otherwise.
  const rawPriceCents = Number(body.priceCents)
  const priceCents: number = accessType === 'paid'
    ? (Number.isFinite(rawPriceCents) && rawPriceCents >= 100 ? Math.round(rawPriceCents) : 100)
    : 0

  if (accessType === 'paid' && (!Number.isFinite(rawPriceCents) || rawPriceCents < 100)) {
    return NextResponse.json(
      { error: 'Paid books require a price of at least $1 (100 cents).' },
      { status: 400 },
    )
  }

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('user_id', userId)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Generate a unique slug — bounded retries so a pathological collision
  // (or a DB outage) can't hang the route.
  const baseSlug = slugify(book.title || 'untitled') || 'book'
  const MAX_SLUG_ATTEMPTS = 50
  let slug = baseSlug
  let attempt = 0
  while (attempt < MAX_SLUG_ATTEMPTS) {
    const { data: existing } = await supabase
      .from('published_books')
      .select('id, book_id')
      .eq('slug', slug)
      .maybeSingle()
    if (!existing) break
    // Allow re-publishing the same book to keep its existing slug
    if (existing.book_id === params.bookId) break
    attempt++
    slug = `${baseSlug}-${attempt}`
  }
  if (attempt >= MAX_SLUG_ATTEMPTS) {
    return NextResponse.json({ error: 'Could not allocate a unique slug.' }, { status: 409 })
  }

  // Build a two-sentence description from back-cover fields or chapters
  const { data: pages } = await supabase
    .from('book_pages')
    .select('chapter_title, chapter_brief')
    .eq('book_id', params.bookId)
    .gte('chapter_index', 0)
    .order('chapter_index')
    .limit(3)

  const description = book.back_cover_description ||
    (pages && pages.length > 0
      ? `${book.title} covers ${pages.slice(0, 2).map((p: { chapter_title: string }) => p.chapter_title).join(', ')} and more.`
      : null)

  // Upsert published_books record
  const { data: published, error } = await supabase
    .from('published_books')
    .upsert({
      book_id: params.bookId,
      user_id: userId,
      slug,
      title: book.title,
      author: book.author_name,
      subtitle: book.subtitle,
      description,
      cover_image_url: book.cover_image_url,
      gate_type: gateType,
      access_type: accessType,
      price_cents: priceCents,
      is_active: true,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'book_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update book status and slug
  await supabase
    .from('books')
    .update({ status: 'published', slug: published.slug, published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', params.bookId)

  // Generate the AI welcome sequence after the response is sent. waitUntil
  // keeps the serverless function alive until this resolves — the previous
  // fire-and-forget self-fetch died on Vercel teardown before the child
  // request completed. Direct call (no HTTP round-trip); runs as this
  // author so the email_sequences write satisfies RLS. Pro-gated +
  // idempotent inside generateEmailSequence; never blocks the response.
  waitUntil(
    generateEmailSequence({ bookId: params.bookId, userId: userId, supabase })
      .then((r) => {
        if (!r.success) {
          console.error('[publish] email sequence generation failed:', r.error)
        }
      })
      .catch((err) => console.error('[publish] email sequence generation threw:', err)),
  )

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/read/${published.slug}`
  return NextResponse.json({ slug: published.slug, shareUrl })
}
