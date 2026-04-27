'use client'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <p className="font-inter text-sm tracking-[0.2em] uppercase text-red-400 mb-4">Error</p>
        <h1 className="font-playfair text-3xl font-bold text-cream mb-3">Something went wrong</h1>
        <div className="w-12 h-0.5 bg-red-400/50 mx-auto mb-6" />
        <p className="font-source-serif text-cream/60 text-sm leading-relaxed mb-8">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent/90 text-white font-inter text-sm rounded-md transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
