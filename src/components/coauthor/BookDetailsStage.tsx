'use client'

import { useState, useCallback } from 'react'
import { Check } from 'lucide-react'
import type { Book } from '@/types/database'

interface Props {
  book: Book
}

export function BookDetailsStage({ book }: Props) {
  const [niche, setNiche] = useState(book.niche ?? '')
  const [targetAudience, setTargetAudience] = useState(book.target_audience ?? '')
  const [offerDescription, setOfferDescription] = useState(book.offer_description ?? '')
  const [offerType, setOfferType] = useState(book.offer_type ?? '')
  const [ctaIntent, setCtaIntent] = useState(book.cta_intent ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(book.website_url ?? '')

  const [saved, setSaved] = useState<Record<string, boolean>>({})

  const saveField = useCallback(async (field: string, value: string) => {
    setSaved((prev) => ({ ...prev, [field]: false }))

    try {
      const res = await fetch(`/api/books/${book.id}/book-details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })

      if (!res.ok) throw new Error('Save failed')

      setSaved((prev) => ({ ...prev, [field]: true }))
      setTimeout(() => {
        setSaved((prev) => ({ ...prev, [field]: false }))
      }, 2000)
    } catch (e) {
      console.error('Save failed:', e)
    }
  }, [book.id])

  const isBusiness = book.persona === 'business'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <h2 className="font-playfair text-3xl text-ink-1 dark:text-cream">Book Details</h2>
        <p className="text-muted-foreground text-sm font-source-serif mt-1">
          Foundational information about your book.
        </p>
      </div>

      {/* Section: What your book is about */}
      <div className="mb-10">
        <h3 className="font-playfair text-xl text-ink-1 dark:text-cream mb-4">
          What your book is about
        </h3>

        <div className="space-y-6">
          <div className="relative">
            <label htmlFor="niche" className="block text-sm font-inter font-medium text-ink-1 dark:text-cream mb-2">
              What is your book about?
            </label>
            <textarea
              id="niche"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              onBlur={() => saveField('niche', niche)}
              maxLength={200}
              rows={3}
              placeholder="e.g. business funding at 0% interest before earning revenue"
              className="w-full px-3 py-2 rounded-md border border-cream-3 dark:border-ink-3 bg-white dark:bg-ink-2 text-ink-1 dark:text-cream font-source-serif text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold transition-colors"
            />
            {saved.niche && (
              <div className="absolute right-2 top-9 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check className="w-3 h-3" />
                <span>Saved</span>
              </div>
            )}
            <p className="text-xs text-ink-1/40 dark:text-white/30 mt-1.5">
              These fields improve Creator Radar results and chapter generation quality.
            </p>
          </div>

          <div className="relative">
            <label htmlFor="target_audience" className="block text-sm font-inter font-medium text-ink-1 dark:text-cream mb-2">
              Who is this book for?
            </label>
            <textarea
              id="target_audience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              onBlur={() => saveField('target_audience', targetAudience)}
              maxLength={200}
              rows={3}
              placeholder="e.g. new business owners with no revenue or credit history"
              className="w-full px-3 py-2 rounded-md border border-cream-3 dark:border-ink-3 bg-white dark:bg-ink-2 text-ink-1 dark:text-cream font-source-serif text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold transition-colors"
            />
            {saved.target_audience && (
              <div className="absolute right-2 top-9 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check className="w-3 h-3" />
                <span>Saved</span>
              </div>
            )}
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
              <label htmlFor="offer_description" className="block text-sm font-inter font-medium text-ink-1 dark:text-cream mb-2">
                Describe your offer
              </label>
              <textarea
                id="offer_description"
                value={offerDescription}
                onChange={(e) => setOfferDescription(e.target.value)}
                onBlur={() => saveField('offer_description', offerDescription)}
                maxLength={200}
                rows={3}
                placeholder="e.g. 6-week funding accelerator program for new business owners"
                className="w-full px-3 py-2 rounded-md border border-cream-3 dark:border-ink-3 bg-white dark:bg-ink-2 text-ink-1 dark:text-cream font-source-serif text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold transition-colors"
              />
              {saved.offer_description && (
                <div className="absolute right-2 top-9 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="w-3 h-3" />
                  <span>Saved</span>
                </div>
              )}
              <p className="text-xs text-ink-1/40 dark:text-white/30 mt-1.5">
                These fields improve Creator Radar results and chapter generation quality.
              </p>
            </div>

            <div className="relative">
              <label htmlFor="offer_type" className="block text-sm font-inter font-medium text-ink-1 dark:text-cream mb-2">
                Offer type
              </label>
              <select
                id="offer_type"
                value={offerType}
                onChange={(e) => {
                  setOfferType(e.target.value)
                  saveField('offer_type', e.target.value)
                }}
                className="w-full px-3 py-2 rounded-md border border-cream-3 dark:border-ink-3 bg-white dark:bg-ink-2 text-ink-1 dark:text-cream font-source-serif text-sm focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold transition-colors"
              >
                <option value="">Select offer type</option>
                <option value="Course">Course</option>
                <option value="Coaching">Coaching</option>
                <option value="Service">Service</option>
                <option value="Product">Product</option>
                <option value="Membership">Membership</option>
                <option value="Agency">Agency</option>
              </select>
              {saved.offer_type && (
                <div className="absolute right-2 top-9 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="w-3 h-3" />
                  <span>Saved</span>
                </div>
              )}
            </div>

            <div className="relative">
              <label htmlFor="cta_intent" className="block text-sm font-inter font-medium text-ink-1 dark:text-cream mb-2">
                What should readers do after finishing the book?
              </label>
              <textarea
                id="cta_intent"
                value={ctaIntent}
                onChange={(e) => setCtaIntent(e.target.value)}
                onBlur={() => saveField('cta_intent', ctaIntent)}
                maxLength={100}
                rows={2}
                placeholder="e.g. Book a free strategy call"
                className="w-full px-3 py-2 rounded-md border border-cream-3 dark:border-ink-3 bg-white dark:bg-ink-2 text-ink-1 dark:text-cream font-source-serif text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold transition-colors"
              />
              {saved.cta_intent && (
                <div className="absolute right-2 top-9 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="w-3 h-3" />
                  <span>Saved</span>
                </div>
              )}
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
            <label htmlFor="website_url" className="block text-sm font-inter font-medium text-ink-1 dark:text-cream mb-2">
              Your website
            </label>
            <input
              type="url"
              id="website_url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              onBlur={() => saveField('website_url', websiteUrl)}
              maxLength={500}
              placeholder="https://yoursite.com"
              className="w-full px-3 py-2 rounded-md border border-cream-3 dark:border-ink-3 bg-white dark:bg-ink-2 text-ink-1 dark:text-cream font-source-serif text-sm focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold transition-colors"
            />
            {saved.website_url && (
              <div className="absolute right-2 top-9 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check className="w-3 h-3" />
                <span>Saved</span>
              </div>
            )}
            <p className="text-xs text-ink-1/40 dark:text-white/30 mt-1.5">
              These fields improve Creator Radar results and chapter generation quality.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
