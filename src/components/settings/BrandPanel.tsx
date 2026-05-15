'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Loader2, Check, X, Sparkles, Globe } from 'lucide-react'
import type { Profile } from '@/types/database'

interface Props {
  profile: Profile | null
}

/** Maps server-side column names (returned in fieldsUpdated) to the local
 *  state keys we use for the gold-ring highlight. Keeps the highlight code
 *  decoupled from snake_case vs camelCase. */
const HIGHLIGHT_KEY_BY_COLUMN: Record<string, string> = {
  display_name:         'fullName',
  author_bio:           'authorBio',
  primary_color:        'brandColor',
  accent_color:         'accentColor',
  background_color:     'backgroundColor',
  brand_voice_tone:     'voiceTone',
  brand_voice_style:    'voiceStyle',
  brand_name:           'brandName',
  brand_tagline:        'brandTagline',
  cta_url:              'ctaUrl',
  cta_text:             'ctaText',
  expertise:            'expertise',
  offer_types:          'offerTypes',
  audience_description: 'audienceDescription',
  website_url:          'websiteUrl',
}

interface ToastState {
  kind: 'success' | 'error'
  message: string
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)))
}

/** Wrapping a field with this gives it a 3-second gold ring after enrichment.
 *  Highlights vanish on next field edit so the user can clearly see what was
 *  filled in by AI vs. what they're about to save themselves. */
function ringClass(active: boolean): string {
  return active
    ? 'ring-2 ring-gold/50 ring-offset-2 ring-offset-white rounded-lg transition-shadow'
    : ''
}

export function BrandPanel({ profile: initial }: Props) {
  const [profile, setProfile] = useState<Profile | null>(initial)
  const [fullName,   setFullName]   = useState(initial?.display_name ?? initial?.full_name ?? '')
  const [authorBio,  setAuthorBio]  = useState(initial?.author_bio  ?? '')
  const [brandColor, setBrandColor] = useState(initial?.brand_color ?? initial?.primary_color ?? '#C9A84C')
  const [accentColor, setAccentColor] = useState(initial?.accent_color ?? '#C9A84C')
  const [backgroundColor, setBackgroundColor] = useState(initial?.background_color ?? '')
  const [twitter,    setTwitter]    = useState(initial?.social_links?.twitter   ?? '')
  const [linkedin,   setLinkedin]   = useState(initial?.social_links?.linkedin  ?? '')
  const [website,    setWebsite]    = useState(initial?.social_links?.website   ?? initial?.website_url ?? '')
  const [instagram,  setInstagram]  = useState(initial?.social_links?.instagram ?? '')
  const [tiktok,     setTiktok]     = useState(initial?.social_links?.tiktok    ?? '')
  const [youtube,    setYoutube]    = useState(initial?.social_links?.youtube   ?? '')
  const [voiceTone,    setVoiceTone]    = useState(initial?.brand_voice_tone    ?? '')
  const [voiceStyle,   setVoiceStyle]   = useState(initial?.brand_voice_style   ?? '')
  const [voiceAvoid,   setVoiceAvoid]   = useState(initial?.brand_voice_avoid   ?? '')
  const [voiceExample, setVoiceExample] = useState(initial?.brand_voice_example ?? '')
  // Enrichment-populated fields the panel doesn't yet have full editor UIs
  // for. We keep them in state so save() includes them and the highlight
  // works, but render them as read-only summaries near the auto-fill block.
  const [brandName,    setBrandName]    = useState(initial?.brand_name    ?? '')
  const [brandTagline, setBrandTagline] = useState(initial?.brand_tagline ?? '')
  const [ctaUrl,       setCtaUrl]       = useState(initial?.cta_url       ?? '')
  const [ctaText,      setCtaText]      = useState(initial?.cta_text      ?? '')
  const [expertise,    setExpertise]    = useState<string[]>(initial?.expertise ?? [])
  const [offerTypes,   setOfferTypes]   = useState<string[]>(initial?.offer_types ?? [])
  const [audienceDescription, setAudienceDescription] = useState(initial?.audience_description ?? '')

  const [enrichUrl, setEnrichUrl] = useState(initial?.website_url ?? '')
  const [enriching, setEnriching] = useState(false)
  const [highlightKeys, setHighlightKeys] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<ToastState | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [logoLoading,        setLogoLoading]        = useState(false)
  const [authorPhotoLoading, setAuthorPhotoLoading] = useState(false)
  const [mascotLoading,      setMascotLoading]      = useState(false)
  const fileRef         = useRef<HTMLInputElement>(null)
  const authorPhotoRef  = useRef<HTMLInputElement>(null)
  const mascotRef       = useRef<HTMLInputElement>(null)

  // Drop the highlight ring after 3s. The dependency on highlightKeys means
  // a fresh enrichment restarts the timer.
  useEffect(() => {
    if (highlightKeys.size === 0) return
    const t = setTimeout(() => setHighlightKeys(new Set()), 3000)
    return () => clearTimeout(t)
  }, [highlightKeys])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

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

  async function handleAuthorPhotoUpload(file: File) {
    setAuthorPhotoLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/profile/author-photo', { method: 'POST', body: form })
      const json = await res.json()
      if (json.avatarUrl) setProfile((p) => p ? { ...p, avatar_url: json.avatarUrl } : p)
    } finally {
      setAuthorPhotoLoading(false)
    }
  }

  async function handleMascotUpload(file: File) {
    setMascotLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/profile/mascot', { method: 'POST', body: form })
      const json = await res.json()
      if (json.mascotUrl) setProfile((p) => p ? { ...p, mascot_url: json.mascotUrl } : p)
    } finally {
      setMascotLoading(false)
    }
  }

  async function clearAsset(field: 'logo_url' | 'avatar_url' | 'mascot_url') {
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: null }),
    })
    setProfile((p) => p ? { ...p, [field]: null } : p)
  }

  async function autoFill() {
    if (!enrichUrl.trim() || enriching) return
    setEnriching(true)
    setToast(null)
    try {
      const res = await fetch('/api/profile/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: enrichUrl.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error ?? `Enrichment failed (${res.status})`)
      }
      const p = json.profile as {
        displayName?:         string
        authorBio?:           string
        brandName?:           string
        brandTagline?:        string
        ctaUrl?:              string
        ctaText?:             string
        primaryColor?:        string
        accentColor?:         string
        backgroundColor?:     string
        expertise?:           string[]
        audienceDescription?: string
        offerTypes?:          string[]
        brandVoiceTone?:      string
        brandVoiceStyle?:     string
        websiteUrl?:          string
      }
      // Populate every form field that came back. Empty-string is interpreted
      // as "no value returned" — leave existing state untouched in that case.
      if (p.displayName)         setFullName(p.displayName)
      if (p.authorBio)           setAuthorBio(p.authorBio)
      if (p.brandName)           setBrandName(p.brandName)
      if (p.brandTagline)        setBrandTagline(p.brandTagline)
      if (p.ctaUrl)              setCtaUrl(p.ctaUrl)
      if (p.ctaText)             setCtaText(p.ctaText)
      if (p.primaryColor)        setBrandColor(p.primaryColor)
      if (p.accentColor)         setAccentColor(p.accentColor)
      if (p.backgroundColor)     setBackgroundColor(p.backgroundColor)
      if (p.expertise)           setExpertise(p.expertise)
      if (p.audienceDescription) setAudienceDescription(p.audienceDescription)
      if (p.offerTypes)          setOfferTypes(p.offerTypes)
      if (p.brandVoiceTone)      setVoiceTone(p.brandVoiceTone)
      if (p.brandVoiceStyle)     setVoiceStyle(p.brandVoiceStyle)
      if (p.websiteUrl)          setWebsite(p.websiteUrl)

      const cols = Array.isArray(json.fieldsUpdated) ? (json.fieldsUpdated as string[]) : []
      const keys = new Set<string>()
      for (const col of cols) {
        const k = HIGHLIGHT_KEY_BY_COLUMN[col]
        if (k) keys.add(k)
      }
      setHighlightKeys(keys)

      // Reflect the new enrich_ran_at locally so the "Last enriched" hint
      // updates without a router refresh.
      setProfile((prev) => prev ? { ...prev, enrich_ran_at: new Date().toISOString() } : prev)

      setToast({ kind: 'success', message: 'Profile auto-filled from your website. Review and save.' })
    } catch (e) {
      setToast({ kind: 'error', message: e instanceof Error ? e.message : 'Enrichment failed' })
    } finally {
      setEnriching(false)
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
          display_name: fullName.trim()  || null,
          author_bio:   authorBio.trim() || null,
          brand_color:  brandColor  || null,
          primary_color: brandColor || null,
          accent_color: accentColor || null,
          background_color: backgroundColor || null,
          brand_name:    brandName.trim()    || null,
          brand_tagline: brandTagline.trim() || null,
          cta_url:       ctaUrl.trim()       || null,
          cta_text:      ctaText.trim()      || null,
          expertise:     expertise.length > 0  ? expertise  : null,
          offer_types:   offerTypes.length > 0 ? offerTypes : null,
          audience_description: audienceDescription.trim() || null,
          website_url:   website.trim() || null,
          social_links: {
            ...(twitter   ? { twitter }   : {}),
            ...(linkedin  ? { linkedin }  : {}),
            ...(website   ? { website }   : {}),
            ...(instagram ? { instagram } : {}),
            ...(tiktok    ? { tiktok }    : {}),
            ...(youtube   ? { youtube }   : {}),
          },
          brand_voice_tone:    voiceTone.trim()    || null,
          brand_voice_style:   voiceStyle.trim()   || null,
          brand_voice_avoid:   voiceAvoid.trim()   || null,
          brand_voice_example: voiceExample.trim() || null,
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

  const enrichDays = daysSince(profile?.enrich_ran_at ?? null)

  return (
    <div className="min-h-screen bg-cream-1 dark:bg-ink-1">
      <div className="max-w-xl mx-auto px-6 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-1/60 dark:text-white/60 hover:text-ink-1 dark:hover:text-white font-inter transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>

        <h1 className="font-playfair text-3xl text-ink-1 dark:text-white mb-1">Brand Identity</h1>
        <p className="text-ink-1/60 dark:text-white/60 font-inter text-sm mb-8">
          Your brand settings apply to all books.
        </p>

        {/* Auto-fill from website — top of panel. Sits above all manual
            fields so a brand-new user sees it first. */}
        <div className="bg-white dark:bg-ink-2 border border-cream-3 dark:border-ink-3 rounded-xl p-6 mb-5 space-y-4 shadow-[0_2px_18px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            <p className="text-xs font-inter font-semibold text-ink-1/70 dark:text-white/70 uppercase tracking-wider">
              Auto-fill from your website
            </p>
          </div>
          <p className="text-sm font-inter text-ink-1/65 leading-relaxed">
            Let AI read your website and populate your brand profile automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-1/30" />
              <input
                type="url"
                value={enrichUrl}
                onChange={(e) => setEnrichUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
                disabled={enriching}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white placeholder:text-ink-1/40 font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={autoFill}
              disabled={enriching || !enrichUrl.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 dark:text-white font-inter font-semibold text-sm rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {enriching
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Reading your website…</>
                : <><Sparkles className="w-4 h-4" /> Auto-fill</>}
            </button>
          </div>
          {enrichDays !== null && (
            <p className="text-xs font-inter text-ink-1/50">
              Last enriched {enrichDays === 0 ? 'today' : `${enrichDays} day${enrichDays === 1 ? '' : 's'} ago`}.
            </p>
          )}
        </div>

        {/* Brand assets — Logo, Author Photo, Mascot. The latter two
            drive the Mascot Cover / Photo Cover modes in Book Design.
            Each is independent; uploading one doesn't affect the others.
            Squares are 14 × 14 (logo keeps the wider auto-width landscape
            look — logos are usually wordmarks). */}
        <div className="bg-white dark:bg-ink-2 border border-cream-3 dark:border-ink-3 rounded-xl p-6 mb-5 space-y-6">
          <p className="text-xs font-inter font-medium text-ink-1/60 dark:text-white/60 uppercase tracking-wider">Brand Assets</p>

          {/* Logo ── */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-inter font-medium text-ink-1 dark:text-white">Logo</p>
              <p className="text-[10px] font-inter text-ink-1/50">PNG / JPEG / WebP · max 2 MB</p>
            </div>
            <div className="flex items-center gap-4">
              {profile?.logo_url ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.logo_url} alt="Logo" className="h-14 w-auto object-contain rounded" />
                  <button
                    onClick={() => clearAsset('logo_url')}
                    aria-label="Remove logo"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-cream-3 dark:bg-ink-3 rounded-full flex items-center justify-center text-ink-1/60 dark:text-white/60 hover:text-ink-1 dark:hover:text-white"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ) : (
                <div className="h-14 w-24 border border-dashed border-cream-3 dark:border-ink-3 rounded flex items-center justify-center text-ink-1/60 dark:text-white/60 text-xs font-inter">
                  No logo
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={logoLoading}
                className="flex items-center gap-2 px-3 py-2 border border-cream-3 dark:border-ink-3 hover:border-gold/40 text-ink-1/60 dark:text-white/60 hover:text-ink-1 dark:hover:text-white font-inter text-sm rounded-lg transition-colors disabled:opacity-40"
              >
                {logoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {profile?.logo_url ? 'Replace' : 'Upload'} Logo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
              />
            </div>
            <p className="text-xs font-inter text-ink-1/55">
              Used in flipbook headers and PDF exports.
            </p>
          </div>

          <div className="border-t border-cream-3 dark:border-ink-3" />

          {/* Author Photo ── */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-inter font-medium text-ink-1 dark:text-white">Author Photo</p>
              <p className="text-[10px] font-inter text-ink-1/50">PNG / JPEG / WebP · max 5 MB</p>
            </div>
            <div className="flex items-center gap-4">
              {profile?.avatar_url ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.avatar_url} alt="Author photo" className="h-16 w-16 object-cover rounded-md border border-cream-3 dark:border-ink-3" />
                  <button
                    onClick={() => clearAsset('avatar_url')}
                    aria-label="Remove author photo"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-cream-3 dark:bg-ink-3 rounded-full flex items-center justify-center text-ink-1/60 dark:text-white/60 hover:text-ink-1 dark:hover:text-white"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 border border-dashed border-cream-3 dark:border-ink-3 rounded-md flex items-center justify-center text-ink-1/40 text-[10px] font-inter">
                  No photo
                </div>
              )}
              <button
                onClick={() => authorPhotoRef.current?.click()}
                disabled={authorPhotoLoading}
                className="flex items-center gap-2 px-3 py-2 border border-cream-3 dark:border-ink-3 hover:border-gold/40 text-ink-1/60 dark:text-white/60 hover:text-ink-1 dark:hover:text-white font-inter text-sm rounded-lg transition-colors disabled:opacity-40"
              >
                {authorPhotoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {profile?.avatar_url ? 'Replace' : 'Upload'} Photo
              </button>
              <input
                ref={authorPhotoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAuthorPhotoUpload(f) }}
              />
            </div>
            <p className="text-xs font-inter text-ink-1/55">
              Used on photo-style book covers. Front-facing headshot works best.
            </p>
          </div>

          <div className="border-t border-cream-3 dark:border-ink-3" />

          {/* Mascot ── */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-inter font-medium text-ink-1 dark:text-white">Brand Mascot</p>
              <p className="text-[10px] font-inter text-ink-1/50">PNG / WebP only · max 5 MB</p>
            </div>
            <div className="flex items-center gap-4">
              {profile?.mascot_url ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.mascot_url} alt="Mascot" className="h-16 w-16 object-contain rounded-md border border-cream-3 dark:border-ink-3 bg-cream-2 dark:bg-ink-3" />
                  <button
                    onClick={() => clearAsset('mascot_url')}
                    aria-label="Remove mascot"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-cream-3 dark:bg-ink-3 rounded-full flex items-center justify-center text-ink-1/60 dark:text-white/60 hover:text-ink-1 dark:hover:text-white"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 border border-dashed border-cream-3 dark:border-ink-3 rounded-md flex items-center justify-center text-ink-1/40 text-[10px] font-inter">
                  No mascot
                </div>
              )}
              <button
                onClick={() => mascotRef.current?.click()}
                disabled={mascotLoading}
                className="flex items-center gap-2 px-3 py-2 border border-cream-3 dark:border-ink-3 hover:border-gold/40 text-ink-1/60 dark:text-white/60 hover:text-ink-1 dark:hover:text-white font-inter text-sm rounded-lg transition-colors disabled:opacity-40"
              >
                {mascotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {profile?.mascot_url ? 'Replace' : 'Upload'} Mascot
              </button>
              <input
                ref={mascotRef}
                type="file"
                accept="image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMascotUpload(f) }}
              />
            </div>
            <p className="text-xs font-inter text-ink-1/55">
              Character or mascot used on book covers. Transparent background required.
            </p>
          </div>
        </div>

        {/* Author info */}
        <div className="bg-white dark:bg-ink-2 border border-cream-3 dark:border-ink-3 rounded-xl p-6 mb-5 space-y-4">
          <p className="text-xs font-inter font-medium text-ink-1/60 dark:text-white/60 uppercase tracking-wider">Author</p>
          <div className="space-y-1">
            <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Display name</label>
            <div className={ringClass(highlightKeys.has('fullName'))}>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2.5 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Author bio</label>
            <div className={ringClass(highlightKeys.has('authorBio'))}>
              <textarea
                value={authorBio}
                onChange={(e) => setAuthorBio(e.target.value)}
                rows={3}
                placeholder="A sentence or two about you and your work."
                className="w-full px-3 py-2.5 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Brand name</label>
              <div className={ringClass(highlightKeys.has('brandName'))}>
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="If different from display name"
                  className="w-full px-3 py-2.5 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Brand tagline</label>
              <div className={ringClass(highlightKeys.has('brandTagline'))}>
                <input
                  value={brandTagline}
                  onChange={(e) => setBrandTagline(e.target.value)}
                  placeholder="One line that sums up your work"
                  className="w-full px-3 py-2.5 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Audience</label>
            <div className={ringClass(highlightKeys.has('audienceDescription'))}>
              <input
                value={audienceDescription}
                onChange={(e) => setAudienceDescription(e.target.value)}
                placeholder="Who you serve"
                className="w-full px-3 py-2.5 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>
          </div>
          {(expertise.length > 0 || highlightKeys.has('expertise')) && (
            <div className={`space-y-1 ${ringClass(highlightKeys.has('expertise'))}`}>
              <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Expertise</label>
              <div className="flex flex-wrap gap-1.5">
                {expertise.map((e) => (
                  <span key={e} className="inline-flex items-center px-2.5 py-1 rounded-full bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-xs">
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(offerTypes.length > 0 || highlightKeys.has('offerTypes')) && (
            <div className={`space-y-1 ${ringClass(highlightKeys.has('offerTypes'))}`}>
              <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Offer types</label>
              <div className="flex flex-wrap gap-1.5">
                {offerTypes.map((o) => (
                  <span key={o} className="inline-flex items-center px-2.5 py-1 rounded-full bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-xs">
                    {o}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Call-to-action */}
        {(ctaUrl || ctaText || highlightKeys.has('ctaUrl') || highlightKeys.has('ctaText')) && (
          <div className="bg-white dark:bg-ink-2 border border-cream-3 dark:border-ink-3 rounded-xl p-6 mb-5 space-y-4">
            <p className="text-xs font-inter font-medium text-ink-1/60 dark:text-white/60 uppercase tracking-wider">Call-to-action</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">CTA text</label>
                <div className={ringClass(highlightKeys.has('ctaText'))}>
                  <input
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="e.g. Work with me"
                    className="w-full px-3 py-2.5 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">CTA URL</label>
                <div className={ringClass(highlightKeys.has('ctaUrl'))}>
                  <input
                    type="url"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://yoursite.com/contact"
                    className="w-full px-3 py-2.5 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Brand colors */}
        <div className="bg-white dark:bg-ink-2 border border-cream-3 dark:border-ink-3 rounded-xl p-6 mb-5 space-y-5">
          <p className="text-xs font-inter font-medium text-ink-1/60 dark:text-white/60 uppercase tracking-wider">Brand Colors</p>

          <div className="space-y-2">
            <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Primary</label>
            <div className={`flex items-center gap-3 ${ringClass(highlightKeys.has('brandColor'))}`}>
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
                className="w-32 px-3 py-2 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
              <span className="text-xs font-inter text-ink-1/60 dark:text-white/60">Used for accents, chapter numbers, and drop caps.</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Accent</label>
            <div className={`flex items-center gap-3 ${ringClass(highlightKeys.has('accentColor'))}`}>
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
                className="w-32 px-3 py-2 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
              <span className="text-xs font-inter text-ink-1/60 dark:text-white/60">Pairs with primary when you choose &ldquo;Use my brand colors&rdquo; in a book.</span>
            </div>
          </div>

          {(backgroundColor || highlightKeys.has('backgroundColor')) && (
            <div className="space-y-2">
              <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">Background</label>
              <div className={`flex items-center gap-3 ${ringClass(highlightKeys.has('backgroundColor'))}`}>
                <input
                  type="color"
                  value={backgroundColor || '#FFFFFF'}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent"
                />
                <input
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  placeholder="#FFFFFF"
                  className="w-32 px-3 py-2 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
                <span className="text-xs font-inter text-ink-1/60 dark:text-white/60">Detected on your site. Currently informational only.</span>
              </div>
            </div>
          )}
        </div>

        {/* Brand voice */}
        <div className="bg-white dark:bg-ink-2 border border-cream-3 dark:border-ink-3 rounded-xl p-6 mb-5 space-y-4">
          <div>
            <p className="text-xs font-inter font-medium text-ink-1/60 dark:text-white/60 uppercase tracking-wider">Brand Voice</p>
            <p className="text-xs font-inter text-ink-1/60 dark:text-white/60 mt-1">
              Optional. When filled in, these get injected into the chapter writing prompt so drafts read like you, not generic AI.
            </p>
          </div>

          {[
            { label: 'Tone',    value: voiceTone,    setter: setVoiceTone,    placeholder: 'e.g. Direct and authoritative',          rows: 2, hl: 'voiceTone'  },
            { label: 'Style',   value: voiceStyle,   setter: setVoiceStyle,   placeholder: 'e.g. Short sentences, no jargon',         rows: 2, hl: 'voiceStyle' },
            { label: 'Avoid',   value: voiceAvoid,   setter: setVoiceAvoid,   placeholder: 'e.g. Corporate speak, passive voice',     rows: 2, hl: 'voiceAvoid' },
            { label: 'Example', value: voiceExample, setter: setVoiceExample, placeholder: 'A sample sentence written in your voice', rows: 3, hl: 'voiceExample' },
          ].map((f) => (
            <div key={f.label} className="space-y-1">
              <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">{f.label}</label>
              <div className={ringClass(highlightKeys.has(f.hl))}>
                <textarea
                  value={f.value}
                  onChange={(e) => f.setter(e.target.value)}
                  rows={f.rows}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2.5 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Social links */}
        <div className="bg-white dark:bg-ink-2 border border-cream-3 dark:border-ink-3 rounded-xl p-6 mb-8 space-y-4">
          <p className="text-xs font-inter font-medium text-ink-1/60 dark:text-white/60 uppercase tracking-wider">Social Links</p>
          {[
            { key: 'website',   label: 'Website',     value: website,   setter: setWebsite,   placeholder: 'https://yoursite.com',          hl: 'websiteUrl' },
            { key: 'twitter',   label: 'X / Twitter', value: twitter,   setter: setTwitter,   placeholder: 'https://x.com/you',             hl: '' },
            { key: 'linkedin',  label: 'LinkedIn',    value: linkedin,  setter: setLinkedin,  placeholder: 'https://linkedin.com/in/you',   hl: '' },
            { key: 'instagram', label: 'Instagram',   value: instagram, setter: setInstagram, placeholder: 'https://instagram.com/you',     hl: '' },
            { key: 'tiktok',    label: 'TikTok',      value: tiktok,    setter: setTiktok,    placeholder: 'https://tiktok.com/@you',       hl: '' },
            { key: 'youtube',   label: 'YouTube',     value: youtube,   setter: setYoutube,   placeholder: 'https://youtube.com/@you',      hl: '' },
          ].map((s) => (
            <div key={s.key} className="space-y-1">
              <label className="text-xs font-inter text-ink-1/70 dark:text-white/70">{s.label}</label>
              <div className={ringClass(s.hl ? highlightKeys.has(s.hl) : false)}>
                <input
                  value={s.value}
                  onChange={(e) => s.setter(e.target.value)}
                  placeholder={s.placeholder}
                  className="w-full px-3 py-2 rounded-lg bg-cream-2 dark:bg-ink-3 border border-cream-3 dark:border-ink-3 text-ink-1 dark:text-white font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gold hover:bg-gold/90 text-ink-1 dark:text-white font-inter font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save Brand Settings'}
        </button>
      </div>

      {/* Toast — bottom-right, auto-dismisses after 4s */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 rounded-lg shadow-2xl border font-inter text-sm ${
            toast.kind === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700'
              : 'bg-red-500/15 border-red-500/40 text-red-700'
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
