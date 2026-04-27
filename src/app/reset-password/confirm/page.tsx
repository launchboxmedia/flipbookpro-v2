'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthCard } from '@/components/auth/AuthCard'

export default function ResetPasswordConfirmPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      setStatus('error')
      setMessage('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setStatus('error')
      setMessage('Password must be at least 8 characters.')
      return
    }

    setStatus('loading')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus('error')
      setMessage(error.message)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-playfair text-4xl text-cream mb-2">FlipBookPro</h1>
          <p className="text-muted-foreground font-source-serif text-sm">
            Set your new password
          </p>
        </div>

        <AuthCard>
          {status === 'error' && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-inter text-cream/80">
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-muted-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="text-sm font-inter text-cream/80">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-md bg-[#2A2A2A] border border-[#333] text-cream placeholder:text-muted-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-2.5 px-4 bg-accent hover:bg-accent/90 text-cream font-inter font-medium text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </AuthCard>
      </div>
    </div>
  )
}
