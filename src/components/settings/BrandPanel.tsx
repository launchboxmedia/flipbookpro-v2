'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Loader2, Check, X } from 'lucide-react'
import type { Profile } from '@/types/database'

interface Props {
  profile: Profile | null
}

export function BrandPanel({ profile: initial }: Props) {
  const [profile, setProfile] = useState<Profile | null>(initial)
  const [fullName,   setFullName]   = useState(initial?.full_name   ?? '')
  const [authorBio,  setAuthorBio]  = useState(initial?.author_bio  ?? '')
  const [brandColor, setBrandColor] = useState(initial?.brand_color ?? '#C9A84C')
  const [accentColor, setAccentColor] = useState(initial?.accent_color ?? '#C9A84C')
  const [twitter,    setTwitter]    = useState(initial?.social_links?.twitter  ?? '')
  const [linkedin,   setLinkedin]   = useState(initial?.social_links?.linkedin ?? '')
  const [website,    setWebsite]    = useState(initial?.social_links?.website  ?? '')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [logoLoading, setLogoLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleLogoUpload(file: File) {
    setLogoLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/profile/logo', { method: 'POST', body: form })
      const json = await res.json()
      if (json.logoUrl) setProfile((p) => p ? { ...p, logo_url: json.logoUrl } : p)
    } finally {
      setLogoLoading(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:    fullName.trim()  || null,
          author_bio:   authorBio.trim() || null,
          brand_color:  brandColor  || null,
          accent_color: accentColor || null,
          social_links: {
            ...(twitter  ? { twitter }  : {}),
            ...(linkedin ? { linkedin } : {}),
            ...(website  ? { website }  : {}),
          },
        }),
      })
      const json = await res.json()
      if (json.id) setProfile(json)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-xl mx-auto px-6 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-cream font-inter transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        <h1 className="font-playfair text-3xl text-cream mb-1">Brand Identity</h1>
        <p className="text-muted-foreground font-inter text-sm mb-8">
          Your brand settings apply to all books.
        </p>

        {/* Logo */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6 mb-5 space-y-4">
          <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Logo</p>
          <div className="flex items-center gap-4">
            {profile?.logo_url ? (
              <div className="relative">
                <img src={profile.logo_url} alt="Logo" className="h-14 w-auto object-contain rounded" />
                <button
                  onClick={async () => {
                    await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo_url: null }) })
                    setProfile((p) => p ? { ...p, logo_url: null } : p)
                  }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#333] rounded-full flex items-center justify-center text-muted-foreground hover:text-cream"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <div className="h-14 w-24 border border-dashed border-[#333] rounded flex items-center justify-center text-muted-foreground text-xs font-inter">
                No logo
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={logoLoading}
              className="flex items-center gap-2 px-3 py-2 border border-[#333] hover:border-[#444] text-muted-foreground hover:text-cream font-inter text-sm rounded-lg transition-colors disabled:opacity-40"
            >
              {logoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {profile?.logo_url ? 'Replace' : 'Upload'} Logo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
            />
          </div>
          <p className="text-xs font-inter text-muted-foreground">PNG, SVG, or JPEG. Recommended: transparent background.</p>
        </div>

        {/* Author info */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6 mb-5 space-y-4">
          <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Author</p>
          <div className="space-y-1">
            <label className="text-xs font-inter text-cream/70">Display name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2.5 rounded-lg bg-[#111] border border-[#333] text-cream font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-inter text-cream/70">Author bio</label>
            <textarea
              value={authorBio}
              onChange={(e) => setAuthorBio(e.target.value)}
              rows={3}
              placeholder="A sentence or two about you and your work."
              className="w-full px-3 py-2.5 rounded-lg bg-[#111] border border-[#333] text-cream font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>
        </div>

        {/* Brand colors */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6 mb-5 space-y-5">
          <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Brand Colors</p>

          <div className="space-y-2">
            <label className="text-xs font-inter text-cream/70">Primary</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent"
              />
              <input
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                placeholder="#C9A84C"
                className="w-32 px-3 py-2 rounded-lg bg-[#111] border border-[#333] text-cream font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <span className="text-xs font-inter text-muted-foreground">Used for accents, chapter numbers, and drop caps.</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-inter text-cream/70">Accent</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent"
              />
              <input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#C9A84C"
                className="w-32 px-3 py-2 rounded-lg bg-[#111] border border-[#333] text-cream font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <span className="text-xs font-inter text-muted-foreground">Pairs with primary when you choose &ldquo;Use my brand colors&rdquo; in a book.</span>
            </div>
          </div>
        </div>

        {/* Social links */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-6 mb-8 space-y-4">
          <p className="text-xs font-inter font-medium text-muted-foreground uppercase tracking-wider">Social Links</p>
          {[
            { key: 'website',  label: 'Website',  value: website,  setter: setWebsite,  placeholder: 'https://yoursite.com' },
            { key: 'twitter',  label: 'X / Twitter', value: twitter, setter: setTwitter, placeholder: 'https://x.com/you' },
            { key: 'linkedin', label: 'LinkedIn', value: linkedin,  setter: setLinkedin, placeholder: 'https://linkedin.com/in/you' },
          ].map((s) => (
            <div key={s.key} className="space-y-1">
              <label className="text-xs font-inter text-cream/70">{s.label}</label>
              <input
                value={s.value}
                onChange={(e) => s.setter(e.target.value)}
                placeholder={s.placeholder}
                className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[#333] text-cream font-inter text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-accent hover:bg-accent/90 text-cream font-inter font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save Brand Settings'}
        </button>
      </div>
    </div>
  )
}
