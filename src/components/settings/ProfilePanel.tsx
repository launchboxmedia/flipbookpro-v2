'use client'

import { useState } from 'react'
import { Check, Loader2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface Props {
  user: { id: string; email: string }
  profile: Profile | null
}

export function ProfilePanel({ user, profile }: Props) {
  const [displayName, setDisplayName] = useState(profile?.full_name ?? '')
  const [savingName, setSavingName]   = useState(false)
  const [savedName, setSavedName]     = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentPw, setCurrentPw]     = useState('')
  const [newPw, setNewPw]             = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [savingPw, setSavingPw]       = useState(false)
  const [pwError, setPwError]         = useState<string | null>(null)
  const [savedPw, setSavedPw]         = useState(false)

  async function saveName() {
    setSavingName(true)
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: displayName.trim() || null }),
      })
      setSavedName(true)
      setTimeout(() => setSavedName(false), 2500)
    } finally {
      setSavingName(false)
    }
  }

  async function changePassword() {
    setPwError(null)
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }

    setSavingPw(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) { setPwError(error.message); return }
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setSavedPw(true)
      setTimeout(() => setSavedPw(false), 2500)
    } finally {
      setSavingPw(false)
    }
  }

  const planLabel: Record<string, string> = {
    free: 'Free',
    standard: 'Standard',
    pro: 'Pro',
  }

  return (
    <div className="px-8 py-10 max-w-xl mx-auto">
      <div className="mb-8">
        <h2 className="font-playfair text-3xl text-ink-1 dark:text-white">Profile</h2>
        <p className="text-ink-1/60 dark:text-white/60 text-sm font-source-serif mt-1">
          Manage your account details and password.
        </p>
      </div>

      {/* Account info */}
      <div className="bg-white dark:bg-ink-2 border border-cream-3 dark:border-ink-3 rounded-xl p-6 mb-5 space-y-4">
        <p className="text-xs font-inter font-medium text-ink-1/60 dark:text-white/60 uppercase tracking-wider">Account</p>

        <div className="space-y-1">
          <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Email</label>
          <input
            value={user.email}
            disabled
            className="w-full px-3 py-2.5 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1/60 dark:text-white/60 font-inter text-sm cursor-not-allowed"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2.5 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-inter text-ink-1/60 dark:text-white/60">
            Plan: <span className="text-ink-1 dark:text-white capitalize">{planLabel[profile?.plan ?? 'free'] ?? 'Free'}</span>
          </span>
          <button
            onClick={saveName}
            disabled={savingName}
            className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold/90 text-ink-1 font-inter text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedName ? <Check className="w-3.5 h-3.5" /> : null}
            {savedName ? 'Saved' : savingName ? 'Saving…' : 'Save Name'}
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="bg-white dark:bg-ink-2 border border-cream-3 dark:border-ink-3 rounded-xl p-6 mb-5 space-y-4">
        <p className="text-xs font-inter font-medium text-ink-1/60 dark:text-white/60 uppercase tracking-wider">Change Password</p>

        <div className="space-y-1">
          <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">New password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Min 8 characters"
              className="w-full px-3 py-2.5 pr-10 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-1/60 dark:text-white/60 hover:text-ink-1 dark:hover:text-white"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Confirm new password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-3 py-2.5 pr-10 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-1/60 dark:text-white/60 hover:text-ink-1 dark:hover:text-white"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {pwError && (
          <p className="text-xs font-inter text-red-400">{pwError}</p>
        )}

        <button
          onClick={changePassword}
          disabled={savingPw || !newPw || !confirmPw}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-cream-3 dark:bg-ink-3 hover:bg-cream-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
        >
          {savingPw ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedPw ? <Check className="w-3.5 h-3.5 text-accent" /> : null}
          {savedPw ? 'Password updated' : savingPw ? 'Updating…' : 'Update Password'}
        </button>
      </div>
    </div>
  )
}
