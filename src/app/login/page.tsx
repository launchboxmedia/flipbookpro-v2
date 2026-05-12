import Link from 'next/link'
import { login } from './actions'
import { AuthCard } from '@/components/auth/AuthCard'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

export const metadata = {
  title: 'Sign in — FlipBookPro',
  description: 'Sign in to FlipBookPro to write, illustrate, and publish your flipbook.',
  robots: { index: false, follow: false },
}

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
          {searchParams.error && (() => {
            // Friendly mapping for the two well-known error codes the
            // auth flow redirects with. Anything else falls back to the
            // raw (decoded) string so we never blank out an unfamiliar
            // failure mode.
            const code = decodeURIComponent(searchParams.error)
            const message =
              code === 'confirmation_failed'  ? 'Sign in failed. Please try again.'      :
              code === 'auth_callback_failed' ? 'Authentication failed. Please try again.' :
              code
            return (
              <div className="text-red-400 text-sm text-center bg-red-400/10 rounded-lg p-3 mb-4">
                {message}
              </div>
            )
          })()}

          <GoogleSignInButton />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#333]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#222] px-3 text-xs font-inter text-cream/40">or continue with email</span>
            </div>
          </div>

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
              className="w-full py-2.5 px-4 bg-gold hover:bg-gold-soft text-ink-1 font-inter font-semibold text-sm rounded-md transition-colors"
            >
              Sign In
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm font-inter text-muted-foreground">
            <Link href="/reset-password" className="hover:text-cream transition-colors">
              Forgot password?
            </Link>
            <span>
              No account?{' '}
              <Link href="/signup" className="text-gold hover:text-gold/80 transition-colors">
                Create one
              </Link>
            </span>
          </div>
        </AuthCard>
      </div>
    </div>
  )
}
