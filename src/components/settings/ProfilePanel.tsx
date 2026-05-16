'use client'

import { useRef, useState } from 'react'
import { Check, Loader2, Eye, EyeOff, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
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

  // Author bio — saved on blur via the client supabase, only when the
  // value actually changed (mirrors the author-name pattern elsewhere).
  // Stored trimmed; an emptied bio clears to null like full_name does.
  const [authorBio, setAuthorBio] = useState(profile?.author_bio ?? '')
  const lastSavedBio = useRef(profile?.author_bio ?? '')

  async function saveAuthorBio() {
    const value = authorBio.trim()
    if (value === lastSavedBio.current) return
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ author_bio: value || null })
      .eq('id', user.id)
    if (error) {
      toast.error('Failed to save bio')
      return
    }
    lastSavedBio.current = value
    toast.success('Bio saved')
  }

  // ── AI bio generator ──────────────────────────────────────────────────
  const [isAIPanelOpen,      setIsAIPanelOpen]      = useState(false)
  const [aiPrompt,           setAiPrompt]           = useState('')
  const [isGenerating,       setIsGenerating]       = useState(false)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)

  /** Immediate explicit save of a known value (used after an AI fill).
   *  Updates the on-blur baseline so the textarea's blur handler doesn't
   *  redundantly re-save and double-toast. */
  async function saveBioValue(value: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ author_bio: value || null })
      .eq('id', user.id)
    if (!error) lastSavedBio.current = value
    return !error
  }

  async function runGenerateBio() {
    setShowReplaceConfirm(false)
    setIsGenerating(true)
    try {
      const res = await fetch('/api/profile/generate-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim(), name: profile?.display_name ?? '' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.bio) {
        toast.error('Couldn’t generate bio. Try again.')
        return // keep panel open
      }
      const bio = String(json.bio).slice(0, 500)
      setAuthorBio(bio)
      await saveBioValue(bio)
      setIsAIPanelOpen(false)
      setAiPrompt('')
      toast.success('Bio written — review and save any edits.')
    } catch {
      toast.error('Couldn’t generate bio. Try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  function handleGenerateClick() {
    // Guard the existing bio behind an explicit confirm.
    if (authorBio.trim() && !showReplaceConfirm) {
      setShowReplaceConfirm(true)
      return
    }
    void runGenerateBio()
  }

  function closeAIPanel() {
    setIsAIPanelOpen(false)
    setShowReplaceConfirm(false)
    setAiPrompt('')
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

      {/* Author bio */}
      <div className="bg-white dark:bg-ink-2 border border-cream-3 dark:border-ink-3 rounded-xl p-6 mb-5 space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="author-bio" className="text-xs font-inter font-medium text-ink-1/60 dark:text-white/60 uppercase tracking-wider">
            Author Bio
          </label>
          <span className="text-xs font-inter text-ink-1/40 dark:text-white/40">{authorBio.length}/500</span>
        </div>
        <textarea
          id="author-bio"
          value={authorBio}
          onChange={(e) => setAuthorBio(e.target.value)}
          onBlur={() => void saveAuthorBio()}
          rows={4}
          maxLength={500}
          placeholder="Tell readers about yourself, your expertise, and what drives your work..."
          className="bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-4 text-ink-1 dark:text-white rounded-lg p-3 w-full resize-none focus:border-gold/50 focus:outline-none transition-colors font-inter text-sm"
        />

        <button
          type="button"
          onClick={() => { setIsAIPanelOpen((o) => !o); setShowReplaceConfirm(false) }}
          className="text-gold text-xs hover:text-gold-soft transition-colors cursor-pointer flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" />
          Write with AI
        </button>

        {isAIPanelOpen && (
          <div className="bg-cream-2 dark:bg-ink-3 rounded-xl p-4 border border-gold/20 mt-2 animate-slide-up">
            <p className="text-ink-1/60 dark:text-white/40 text-xs mb-2">
              Tell Claude about yourself
            </p>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. I'm a funding broker with 10 years experience helping small businesses get capital..."
              className="bg-cream-1 dark:bg-ink-2 border border-cream-3 dark:border-ink-4 rounded-lg p-3 w-full text-sm resize-none text-ink-1 dark:text-white focus:border-gold/50 focus:outline-none transition-colors"
            />

            {showReplaceConfirm && (
              <div className="mt-3 text-xs text-ink-1/50 dark:text-white/50">
                <p className="mb-1.5">This will replace your existing bio.</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => void runGenerateBio()}
                    className="text-gold hover:text-gold-soft transition-colors"
                  >
                    Yes, replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReplaceConfirm(false)}
                    className="hover:text-ink-1 dark:hover:text-white transition-colors"
                  >
                    Keep current
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleGenerateClick}
                disabled={isGenerating || !aiPrompt.trim()}
                className="flex items-center gap-1.5 bg-gold text-ink-1 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-gold-soft transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Writing…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    Generate Bio
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={closeAIPanel}
                className="text-ink-1/40 dark:text-white/30 text-xs px-4 py-2 hover:text-ink-1 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <p className="text-xs font-inter text-ink-1/50 dark:text-white/50">
          Displayed on your book landing pages in the About the Author section.
        </p>
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
