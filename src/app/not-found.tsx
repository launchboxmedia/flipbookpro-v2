import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <p className="font-inter text-sm tracking-[0.2em] uppercase text-gold mb-4">404</p>
        <h1 className="font-playfair text-4xl font-bold text-cream mb-3">Page Not Found</h1>
        <div className="w-12 h-0.5 bg-accent mx-auto mb-6" />
        <p className="font-source-serif text-cream/60 text-base leading-relaxed mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent/90 text-white font-inter text-sm rounded-md transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
