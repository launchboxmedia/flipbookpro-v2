'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AuthCard } from '@/components/auth/AuthCard'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
    } else {
      setStatus('success')
      setMessage('Check your email for a password reset link.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-playfair text-4xl text-cream mb-2">FlipBookPro</h1>
          <p className="text-muted-foreground font-source-serif text-sm">
            Reset your password
          </p>
        </div>

        <AuthCard>
          {status === 'success' ? (
            <div className="text-center space-y-4">
              <div className="p-3 rounded-md bg-accent/10 border border-accent/20 text-accent text-sm">
                {message}
              </div>
              <Link
                href="/login"
                className="inline-block text-sm font-inter text-gold hover:text-gold/80 transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {status === 'error' && (
                <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {message}
                </div>
              )}

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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-muted-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full py-2.5 px-4 bg-accent hover:bg-accent/90 text-cream font-inter font-medium text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link
                  href="/login"
                  className="text-sm font-inter text-muted-foreground hover:text-cream transition-colors"
                >
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </AuthCard>
      </div>
    </div>
  )
}
