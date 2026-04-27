import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const gateType: string = body.gateType ?? 'email'

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Generate a unique slug
  const baseSlug = slugify(book.title || 'untitled')
  let slug = baseSlug
  let attempt = 0
  while (true) {
    const { data: existing } = await supabase
      .from('published_books')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!existing) break
    attempt++
    slug = `${baseSlug}-${attempt}`
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
      user_id: user.id,
      slug,
      title: book.title,
      author: book.author_name,
      subtitle: book.subtitle,
      description,
      cover_image_url: book.cover_image_url,
      gate_type: gateType,
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

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/read/${published.slug}`
  return NextResponse.json({ slug: published.slug, shareUrl })
}
