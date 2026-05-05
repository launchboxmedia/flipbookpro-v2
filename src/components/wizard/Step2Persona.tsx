'use client'

import { useState } from 'react'
import { Briefcase, BookMarked, Feather } from 'lucide-react'
import type { WizardData } from './WizardShell'

const PERSONAS = [
  {
    id: 'business',
    label: 'Business Owner',
    description: 'Professional tone. No human figures in illustrations. Focused on authority and expertise.',
    icon: Briefcase,
  },
  {
    id: 'publisher',
    label: 'Publisher',
    description: 'Editorial tone. No human figures. Clean, sophisticated visual language.',
    icon: BookMarked,
  },
  {
    id: 'storyteller',
    label: 'Storyteller',
    description: 'Warm, narrative tone. Rich illustrations. Human connection at the center.',
    icon: Feather,
  },
] as const

const OFFER_TYPES = [
  'Coaching', 'Course', 'Service', 'Product', 'Consulting', 'Other',
] as const

interface Props {
  data: WizardData
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

/** Step 2 — Persona + Offer.
 *
 *  Leaner replacement for the old Step3Persona. The audience textarea,
 *  website URL, CTA fields, and genre have all moved out of this step:
 *    - Target audience → derived from the radar interstitial after the
 *      wizard finishes, then editable from the chapter list.
 *    - Website URL → read silently from profile.website_url; user
 *      maintains it on the brand-profile settings page.
 *    - CTA URL → publish-time setting.
 *    - Genre → not collected here; the radar uses the topic/title.
 *
 *  Only persona, offer_type, and testimonials live here. Wizard's next()
 *  awaits the save and fires the per-book deep radar in the background
 *  on transition to Step 3 (Title). */
export function Step2Persona({ data, onNext, onBack }: Props) {
  const [selected, setSelected]         = useState(data.persona)
  const [offerType, setOfferType]       = useState(data.offerType)
  const [testimonials, setTestimonials] = useState(data.testimonials)
  const [error, setError]               = useState('')

  const isBusiness = selected === 'business'

  function handleNext() {
    if (!selected) {
      setError('Choose a persona.')
      return
    }
    onNext({
      persona:      selected,
      // Only the persona-relevant fields flow through. Switching personas
      // later won't carry stale fields the user thought they'd erased.
      offerType:    isBusiness ? offerType            : '',
      testimonials: isBusiness ? testimonials.trim()  : '',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Your Voice</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          Pick the persona that matches how you write — it shapes the tone of the book and the style of the illustrations.
        </p>
      </div>

      <div className="grid gap-3">
        {PERSONAS.map((p) => {
          const Icon = p.icon
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                selected === p.id
                  ? 'border-gold bg-gold/10'
                  : 'border-cream-3 bg-white hover:border-gold/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-2 rounded-lg ${selected === p.id ? 'bg-gold/20' : 'bg-cream-2'}`}>
                  <Icon className={`w-4 h-4 ${selected === p.id ? 'text-gold-dim' : 'text-ink-1/60'}`} />
                </div>
                <div>
                  <p className="font-inter font-medium text-ink-1 text-sm">{p.label}</p>
                  <p className="text-ink-1/60 text-xs font-source-serif mt-0.5">{p.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Business-only follow-ups — what they sell + social proof. The
          full audience / CTA / website triplet that used to live here
          moved out: audience comes from the radar interstitial, website
          is read silently from the profile, CTA URL is a publish-time
          setting. */}
      {isBusiness && (
        <div className="space-y-4 rounded-xl border border-cream-3 bg-white p-4">
          <div className="space-y-1">
            <label className="text-sm font-inter text-ink-1/80">What do you sell?</label>
            <div className="flex flex-wrap gap-2">
              {OFFER_TYPES.map((opt) => {
                const active = offerType === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setOfferType(active ? '' : opt)}
                    className={`px-3 py-1.5 rounded-full text-xs font-inter transition-colors border ${
                      active
                        ? 'bg-gold/15 border-gold text-ink-1'
                        : 'bg-cream-2 border-cream-3 text-ink-1/70 hover:border-gold/40'
                    }`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            <p className="text-ink-1/60 text-[11px] font-source-serif">
              Optional. Helps the AI position the book around your actual offer.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-inter text-ink-1/80">Testimonials</label>
            <textarea
              value={testimonials}
              onChange={(e) => setTestimonials(e.target.value)}
              rows={3}
              placeholder={'e.g. "This framework helped me close 3 new clients in a week" — Jane D., Marketing Consultant'}
              className="w-full px-3 py-2.5 rounded-md bg-cream-2 border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
            />
            <p className="text-ink-1/60 text-[11px] font-source-serif">
              Optional. The AI may weave one in naturally — never as a quote box, just as natural proof.
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!selected}
          className="px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm rounded-md transition-colors disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
