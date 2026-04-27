import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: pub } = await supabase
    .from('published_books')
    .select('title, slug')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!pub) return { title: 'Challenge Not Found' }

  return {
    title: `You're In! — The ${pub.title} Challenge`,
    robots: { index: false },
  }
}

export default async function ChallengeJoinedPage({ params }: Props) {
  const supabase = await createClient()

  const { data: pub } = await supabase
    .from('published_books')
    .select('id, slug, title, author, cover_image_url')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!pub) notFound()

  return (
    <div className="min-h-screen bg-canvas relative overflow-hidden">
      {/* Radial glow behind content */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #F5F0E8 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16">
        {/* Success icon */}
        <div className="mb-8">
          <div className="w-20 h-20 rounded-full bg-accent/15 flex items-center justify-center ring-2 ring-accent/20">
            <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-playfair text-4xl sm:text-5xl text-cream font-bold text-center mb-3 tracking-tight">
          You&apos;re In!
        </h1>
        <p className="font-source-serif text-lg sm:text-xl text-cream/60 text-center max-w-md mb-10 leading-relaxed">
          Welcome to The {pub.title} Challenge.
          Your journey starts now.
        </p>

        {/* Cover */}
        {pub.cover_image_url && (
          <div className="mb-10 relative">
            <div className="absolute -inset-3 bg-accent/8 rounded-2xl blur-xl" />
            <img
              src={pub.cover_image_url}
              alt={pub.title}
              className="relative w-36 sm:w-44 rounded-xl shadow-2xl shadow-black/50 ring-1 ring-white/10"
              style={{ aspectRatio: '3/4', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* Encouragement card */}
        <div className="w-full max-w-md bg-muted/50 border border-border rounded-2xl p-8 text-center backdrop-blur-sm mb-8">
          <p className="font-source-serif text-cream/70 text-base leading-relaxed mb-6">
            The best time to start was yesterday.
            The second best time is right now.
            Open the book and dive in &mdash; you&apos;ve got this.
          </p>

          <Link
            href={`/read/${pub.slug}`}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-accent hover:bg-accent/90 text-cream font-inter font-semibold text-sm rounded-xl transition-colors shadow-lg shadow-accent/20"
          >
            Start Reading
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

        {/* Subtle footer */}
        <p className="font-inter text-[11px] text-cream/20 text-center max-w-xs">
          Check your email for confirmation and updates about the challenge.
        </p>
      </div>
    </div>
  )
}
