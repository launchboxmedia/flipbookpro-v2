'use client'

import { useState, useCallback, useMemo } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { Book } from '@/types/database'

interface Props {
  book: Book
}

export function BookDetailsStage({ book }: Props) {
  // Track initial values to detect changes
  const initialValues = useMemo(() => ({
    niche: book.niche ?? '',
    target_audience: book.target_audience ?? '',
    offer_description: book.offer_description ?? '',
    offer_type: book.offer_type ?? '',
    cta_intent: book.cta_intent ?? '',
    website_url: book.website_url ?? '',
  }), [book])

  const [niche, setNiche] = useState(initialValues.niche)
  const [targetAudience, setTargetAudience] = useState(initialValues.target_audience)
  const [offerDescription, setOfferDescription] = useState(initialValues.offer_description)
  const [offerType, setOfferType] = useState(initialValues.offer_type)
  const [ctaIntent, setCtaIntent] = useState(initialValues.cta_intent)
  const [websiteUrl, setWebsiteUrl] = useState(initialValues.website_url)

  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // Detect which fields have changed
  const dirtyFields = useMemo(() => ({
    niche: niche !== initialValues.niche,
    target_audience: targetAudience !== initialValues.target_audience,
    offer_description: offerDescription !== initialValues.offer_description,
    offer_type: offerType !== initialValues.offer_type,
    cta_intent: ctaIntent !== initialValues.cta_intent,
    website_url: websiteUrl !== initialValues.website_url,
  }), [niche, targetAudience, offerDescription, offerType, ctaIntent, websiteUrl, initialValues])

  const hasChanges = Object.values(dirtyFields).some(Boolean)

  const saveChanges = useCallback(async () => {
    if (!hasChanges || saving) return

    setSaving(true)
    setJustSaved(false)

    try {
      const updates: Record<string, string> = {}

      if (dirtyFields.niche) updates.niche = niche
      if (dirtyFields.target_audience) updates.target_audience = targetAudience
      if (dirtyFields.offer_description) updates.offer_description = offerDescription
      if (dirtyFields.offer_type) updates.offer_type = offerType
      if (dirtyFields.cta_intent) updates.cta_intent = ctaIntent
      if (dirtyFields.website_url) updates.website_url = websiteUrl

      const res = await fetch(`/api/books/${book.id}/book-details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) throw new Error('Save failed')

      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)

      // Update initial values to reflect saved state
      Object.assign(initialValues, {
        niche,
        target_audience: targetAudience,
        offer_description: offerDescription,
        offer_type: offerType,
        cta_intent: ctaIntent,
        website_url: websiteUrl,
      })
    } catch (e) {
      console.error('Save failed:', e)
    } finally {
      setSaving(false)
    }
  }, [hasChanges, saving, dirtyFields, niche, targetAudience, offerDescription, offerType, ctaIntent, websiteUrl, book.id, initialValues])

  const isBusiness = book.persona === 'business'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-playfair text-3xl text-ink-1 dark:text-cream">Book Details</h2>
            <p className="text-muted-foreground text-sm font-source-serif mt-1">
              Foundational information about your book.
            </p>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-1/50 dark:text-white/50 font-inter">
                Unsaved changes
              </span>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-soft disabled:bg-gold/50 text-ink-1 font-inter text-sm font-medium rounded-md transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : justSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    Saved
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section: What your book is about */}
      <div className="mb-10">
        <h3 className="font-playfair text-xl text-ink-1 dark:text-cream mb-4">
          What your book is about
        </h3>

        <div className="space-y-6">
          <div className="relative">
            <label htmlFor="niche" className="block text-sm font-inter font-medium text-ink-1 dark:text-cream mb-2 flex items-center gap-2">
              What is your book about?
              {dirtyFields.niche && (
                <span className="text-xs text-gold">• Modified</span>
              )}
            </label>
            <textarea
              id="niche"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="e.g. business funding at 0% interest before earning revenue"
              className={`w-full px-3 py-2 rounded-md border ${dirtyFields.niche ? 'border-gold' : 'border-cream-3 dark:border-ink-3'} bg-white dark:bg-ink-2 text-ink-1 dark:text-cream font-source-serif text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold transition-colors`}
            />
            <p className="text-xs text-ink-1/40 dark:text-white/30 mt-1.5">
              These fields improve Creator Radar results and chapter generation quality.
            </p>
          </div>

          <div className="relative">
            <label htmlFor="target_audience" className="block text-sm font-inter font-medium text-ink-1 dark:text-cream mb-2 flex items-center gap-2">
              Who is this book for?
              {dirtyFields.target_audience && (
                <span className="text-xs text-gold">• Modified</span>
              )}
            </label>
            <textarea
              id="target_audience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="e.g. new business owners with no revenue or credit history"
              className={`w-full px-3 py-2 rounded-md border ${dirtyFields.target_audience ? 'border-gold' : 'border-cream-3 dark:border-ink-3'} bg-white dark:bg-ink-2 text-ink-1 dark:text-cream font-source-serif text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold transition-colors`}
            />
          </div>
        </div>
      </div>

      {/* Section: Your offer (business persona only) */}
      {isBusiness && (
        <div className="mb-10">
          <h3 className="font-playfair text-xl text-ink-1 dark:text-cream mb-4">
            Your offer
          </h3>

          <div className="space-y-6">
            <div className="relative">
              <label htmlFor="offer_description" className="block text-sm font-inter font-medium text-ink-1 dark:text-cream mb-2 flex items-center gap-2">
                Describe your offer
                {dirtyFields.offer_description && (
                  <span className="text-xs text-gold">• Modified</span>
                )}
              </label>
              <textarea
                id="offer_description"
                value={offerDescription}
                onChange={(e) => setOfferDescription(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder="e.g. 6-week funding accelerator program for new business owners"
                className={`w-full px-3 py-2 rounded-md border ${dirtyFields.offer_description ? 'border-gold' : 'border-cream-3 dark:border-ink-3'} bg-white dark:bg-ink-2 text-ink-1 dark:text-cream font-source-serif text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold transition-colors`}
              />
              <p className="text-xs text-ink-1/40 dark:text-white/30 mt-1.5">
                These fields improve Creator Radar results and chapter generation quality.
              </p>
            </div>

            <div className="relative">
              <label htmlFor="offer_type" className="block text-sm font-inter font-medium text-ink-1 dark:text-cream mb-2 flex items-center gap-2">
                Offer type
                {dirtyFields.offer_type && (
                  <span className="text-xs text-gold">• Modified</span>
                )}
              </label>
              <select
                id="offer_type"
                value={offerType}
                onChange={(e) => setOfferType(e.target.value)}
                className={`w-full px-3 py-2 rounded-md border ${dirtyFields.offer_type ? 'border-gold' : 'border-cream-3 dark:border-ink-3'} bg-white dark:bg-ink-2 text-ink-1 dark:text-cream font-source-serif text-sm focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold transition-colors`}
              >
                <option value="">Select offer type</option>
                <option value="Course">Course</option>
                <option value="Coaching">Coaching</option>
                <option value="Service">Service</option>
                <option value="Product">Product</option>
                <option value="Membership">Membership</option>
                <option value="Agency">Agency</option>
              </select>
            </div>

            <div className="relative">
              <label htmlFor="cta_intent" className="block text-sm font-inter font-medium text-ink-1 dark:text-cream mb-2 flex items-center gap-2">
                What should readers do after finishing the book?
                {dirtyFields.cta_intent && (
                  <span className="text-xs text-gold">• Modified</span>
                )}
              </label>
              <textarea
                id="cta_intent"
                value={ctaIntent}
                onChange={(e) => setCtaIntent(e.target.value)}
                maxLength={100}
                rows={2}
                placeholder="e.g. Book a free strategy call"
                className={`w-full px-3 py-2 rounded-md border ${dirtyFields.cta_intent ? 'border-gold' : 'border-cream-3 dark:border-ink-3'} bg-white dark:bg-ink-2 text-ink-1 dark:text-cream font-source-serif text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold transition-colors`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Section: Author details */}
      <div className="mb-10">
        <h3 className="font-playfair text-xl text-ink-1 dark:text-cream mb-4">
          Author details
        </h3>

        <div className="space-y-6">
          <div className="relative">
            <label htmlFor="website_url" className="block text-sm font-inter font-medium text-ink-1 dark:text-cream mb-2 flex items-center gap-2">
              Your website
              {dirtyFields.website_url && (
                <span className="text-xs text-gold">• Modified</span>
              )}
            </label>
            <input
              type="url"
              id="website_url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              maxLength={500}
              placeholder="https://yoursite.com"
              className={`w-full px-3 py-2 rounded-md border ${dirtyFields.website_url ? 'border-gold' : 'border-cream-3 dark:border-ink-3'} bg-white dark:bg-ink-2 text-ink-1 dark:text-cream font-source-serif text-sm focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold transition-colors`}
            />
            <p className="text-xs text-ink-1/40 dark:text-white/30 mt-1.5">
              These fields improve Creator Radar results and chapter generation quality.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom save button */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-2 pt-6 border-t border-cream-3 dark:border-ink-3">
          <span className="text-xs text-ink-1/50 dark:text-white/50 font-inter">
            Unsaved changes
          </span>
          <button
            onClick={saveChanges}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold hover:bg-gold-soft disabled:bg-gold/50 text-ink-1 font-inter text-sm font-medium rounded-md transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : justSaved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
