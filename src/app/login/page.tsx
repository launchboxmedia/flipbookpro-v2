import Link from 'next/link'
import { login } from './actions'
import { AuthCard } from '@/components/auth/AuthCard'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-playfair text-4xl text-cream mb-2">FlipBookPro</h1>
          <p className="text-muted-foreground font-source-serif text-sm">
            Sign in to your account
          </p>
        </div>

        <AuthCard>
          {searchParams.error && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {decodeURIComponent(searchParams.error)}
            </div>
          )}

          <form action={login} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-inter text-cream/80">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-muted-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-inter text-cream/80">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-muted-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-accent hover:bg-accent/90 text-cream font-inter font-medium text-sm rounded-md transition-colors"
            >
              Sign In
            </button>
          </form>

          <p className="mt-4 text-center text-sm font-inter text-muted-foreground">
            No account?{' '}
            <Link href="/signup" className="text-gold hover:text-gold/80 transition-colors">
              Create one
            </Link>
          </p>
        </AuthCard>
      </div>
    </div>
  )
}
