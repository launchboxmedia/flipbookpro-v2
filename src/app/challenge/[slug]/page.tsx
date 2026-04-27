import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChallengeCaptureForm } from './ChallengeCaptureForm'

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

  if (!pub) return { title: 'Challenge Not Found' }

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/challenge/${pub.slug}`
  const desc = pub.description || `Join The ${pub.title} Challenge and transform your thinking.`

  return {
    title: `The ${pub.title} Challenge`,
    description: desc,
    openGraph: {
      title: `The ${pub.title} Challenge`,
      description: desc,
      url,
      type: 'website',
      images: pub.cover_image_url
        ? [{ url: pub.cover_image_url, width: 768, height: 1024, alt: pub.title }]
        : [],
    },
    twitter: {
      card: pub.cover_image_url ? 'summary_large_image' : 'summary',
      title: `The ${pub.title} Challenge`,
      description: desc,
      images: pub.cover_image_url ? [pub.cover_image_url] : [],
    },
    alternates: { canonical: url },
  }
}

export default async function ChallengePage({ params }: Props) {
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
      {/* Diagonal accent stripe */}
      <div className="absolute top-0 left-0 right-0 h-[60vh] bg-gradient-to-br from-gold/8 via-transparent to-accent/5 pointer-events-none" />

      {/* Dot pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #F5F0E8 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        {/* Challenge badge */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold/30 bg-gold/5 backdrop-blur-sm">
            <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-inter text-xs font-semibold text-gold tracking-widest uppercase">
              Challenge
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-playfair text-4xl sm:text-5xl lg:text-6xl text-cream font-bold leading-[1.1] text-center mb-4 tracking-tight max-w-3xl">
          The {pub.title} Challenge
        </h1>

        {pub.author && (
          <p className="text-cream/40 font-inter text-sm tracking-[0.15em] uppercase mb-8">
            by {pub.author}
          </p>
        )}

        {/* Two-column layout: cover + description */}
        <div className="w-full max-w-4xl flex flex-col md:flex-row items-center gap-10 md:gap-14 mb-14">
          {/* Cover */}
          <div className="flex-shrink-0">
            {pub.cover_image_url ? (
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-gold/15 to-accent/10 rounded-2xl blur-2xl" />
                <img
                  src={pub.cover_image_url}
                  alt={pub.title}
                  className="relative w-40 sm:w-48 rounded-xl shadow-2xl shadow-black/50 ring-1 ring-white/10"
                  style={{ aspectRatio: '3/4', objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div
                className="w-40 sm:w-48 rounded-xl shadow-2xl bg-muted flex items-center justify-center ring-1 ring-white/10"
                style={{ aspectRatio: '3/4' }}
              >
                <span className="font-playfair text-cream/30 text-sm text-center px-4 leading-tight">
                  {pub.title}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="flex-1 text-center md:text-left">
            {pub.subtitle && (
              <p className="font-source-serif text-xl sm:text-2xl text-cream/80 leading-relaxed mb-5">
                {pub.subtitle}
              </p>
            )}
            {pub.description ? (
              <p className="font-source-serif text-base text-cream/50 leading-relaxed mb-6">
                {pub.description}
              </p>
            ) : (
              <p className="font-source-serif text-base text-cream/50 leading-relaxed mb-6">
                Take the challenge. Read the book from cover to cover, absorb the ideas,
                and put them into practice. Ready to commit?
              </p>
            )}

            {/* What you get */}
            <div className="space-y-3">
              {[
                'Full access to the complete book',
                'Read at your own pace, anywhere',
                'Start immediately after signing up',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="font-inter text-sm text-cream/60">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-20 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent mb-10" />

        {/* Email capture */}
        <ChallengeCaptureForm
          publishedBookId={pub.id}
          slug={pub.slug}
          bookTitle={pub.title}
        />

        {/* Footer trust */}
        <p className="mt-10 font-inter text-[11px] text-cream/20 text-center max-w-xs">
          Your email is safe with us. We only use it to give you access to the challenge.
        </p>
      </div>
    </div>
  )
}
