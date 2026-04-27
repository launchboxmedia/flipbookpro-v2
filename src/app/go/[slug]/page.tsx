import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeadCaptureForm } from './LeadCaptureForm'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: pub } = await supabase
    .from('published_books')
    .select('title, author, subtitle, description, cover_image_url, slug')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!pub) return { title: 'Book Not Found' }

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/go/${pub.slug}`
  const desc = pub.description || pub.subtitle || `Get free access to ${pub.title}.`

  return {
    title: `${pub.title} — Free Access`,
    description: desc,
    openGraph: {
      title: pub.title,
      description: desc,
      url,
      type: 'book',
      images: pub.cover_image_url
        ? [{ url: pub.cover_image_url, width: 768, height: 1024, alt: pub.title }]
        : [],
    },
    twitter: {
      card: pub.cover_image_url ? 'summary_large_image' : 'summary',
      title: pub.title,
      description: desc,
      images: pub.cover_image_url ? [pub.cover_image_url] : [],
    },
    alternates: { canonical: url },
  }
}

export default async function FunnelPage({ params }: Props) {
  const supabase = await createClient()

  const { data: pub } = await supabase
    .from('published_books')
    .select('id, book_id, slug, title, author, subtitle, description, cover_image_url')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!pub) notFound()

  return (
    <div className="min-h-screen bg-canvas relative overflow-hidden">
      {/* Hero section with cover background */}
      <div className="relative min-h-screen flex flex-col">
        {/* Background cover image with overlay */}
        {pub.cover_image_url && (
          <div className="absolute inset-0">
            <img
              src={pub.cover_image_url}
              alt=""
              className="w-full h-full object-cover opacity-20 blur-sm scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-canvas/70 via-canvas/85 to-canvas" />
          </div>
        )}

        {/* Decorative top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

        {/* Content */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
          {/* Cover image */}
          <div className="mb-10 relative group">
            {pub.cover_image_url ? (
              <div className="relative">
                <div className="absolute -inset-3 bg-gold/10 rounded-2xl blur-xl" />
                <img
                  src={pub.cover_image_url}
                  alt={pub.title}
                  className="relative w-44 sm:w-52 rounded-xl shadow-2xl shadow-black/50 ring-1 ring-white/10"
                  style={{ aspectRatio: '3/4', objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div
                className="w-44 sm:w-52 rounded-xl shadow-2xl bg-muted flex items-center justify-center ring-1 ring-white/10"
                style={{ aspectRatio: '3/4' }}
              >
                <span className="font-playfair text-cream/30 text-sm text-center px-4 leading-tight">
                  {pub.title}
                </span>
              </div>
            )}
          </div>

          {/* Title block */}
          <div className="text-center max-w-2xl mb-12">
            <h1 className="font-playfair text-4xl sm:text-5xl lg:text-6xl text-cream font-bold leading-[1.1] mb-4 tracking-tight">
              {pub.title}
            </h1>
            {pub.author && (
              <p className="text-gold/80 font-inter text-sm tracking-[0.2em] uppercase mb-6">
                by {pub.author}
              </p>
            )}
            {pub.subtitle && (
              <p className="font-source-serif text-xl sm:text-2xl text-cream/70 leading-relaxed mb-4">
                {pub.subtitle}
              </p>
            )}
            {pub.description && (
              <p className="font-source-serif text-base text-cream/50 leading-relaxed max-w-lg mx-auto">
                {pub.description}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="w-16 h-px bg-gold/30 mb-10" />

          {/* Lead capture */}
          <LeadCaptureForm
            publishedBookId={pub.id}
            slug={pub.slug}
            bookTitle={pub.title}
          />

          {/* Trust indicators */}
          <div className="mt-8 flex items-center gap-6 text-cream/30 font-inter text-xs">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              No spam, ever
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Instant access
            </span>
          </div>
        </div>

        {/* Decorative bottom element */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
      </div>
    </div>
  )
}
