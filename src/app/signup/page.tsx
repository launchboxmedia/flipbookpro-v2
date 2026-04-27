'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthCard } from '@/components/auth/AuthCard'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    if (!data.session) {
      setMessage('Check your email to confirm your account')
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-playfair text-4xl text-cream mb-2">FlipBookPro</h1>
          <p className="text-muted-foreground font-source-serif text-sm">
            Create your account
          </p>
        </div>

        <AuthCard>
          {message && (
            <div className="mb-4 p-3 rounded-md bg-accent/10 border border-accent/20 text-accent text-sm font-inter">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <GoogleSignInButton />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#333]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#222] px-3 text-xs font-inter text-cream/40">or sign up with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                minLength={8}
                className="w-full px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-muted-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
              />
              <p className="text-xs text-muted-foreground font-inter">Minimum 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-accent hover:bg-accent/90 text-cream font-inter font-medium text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm font-inter text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-gold hover:text-gold/80 transition-colors">
              Sign in
            </Link>
          </p>
        </AuthCard>
      </div>
    </div>
  )
}
