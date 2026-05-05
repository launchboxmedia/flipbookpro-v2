'use client'

import { useState } from 'react'
import type { WizardData } from './WizardShell'
import { Briefcase, BookMarked, Feather } from 'lucide-react'

// Business-persona offer types. Stored as the displayed string (the prompts
// just inject it verbatim — no need for a stable ID enum).
const OFFER_TYPES = ['Coaching', 'Course', 'Service', 'Product', 'Consulting', 'Other'] as const

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
]

interface Props {
  data: WizardData
  /** Retained for parity with other steps that need to address the API
   *  with the current book; this step itself no longer makes any
   *  network calls (the compact Creator Radar preview moved to the
   *  dedicated Step 3.5 Radar step). */
  bookId?: string
  onNext: (patch: Partial<WizardData>) => void
  onBack: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Step3Persona({ data, bookId: _bookId, onNext, onBack }: Props) {
  // Pre-fill priority for the audience textarea, in order:
  //   1. The user already typed something — preserve it.
  //   2. Rich radar data with audienceInsights.biggestPain — that field
  //      doesn't exist on the current shared-discovery CreatorRadarResult,
  //      so this branch is dormant today; it fires only if a future radar
  //      shape includes the per-book audience pain string. Future-proof.
  //   3. Picked radar topic — represents a deliberate user choice.
  //   4. Niche the user typed in Step 1 — last resort.
  const audienceInsightsPain: string | undefined = (() => {
    // Cast through unknown so the dormant branch type-checks while
    // CreatorRadarResult lacks audienceInsights. If a richer radar shape
    // becomes available the branch fires; today it's a no-op.
    const r = data.radarResults as unknown as
      | { audienceInsights?: { biggestPain?: string } } | null | undefined
    const pain = r?.audienceInsights?.biggestPain
    return typeof pain === 'string' && pain.trim().length > 0 ? pain.trim() : undefined
  })()
  const radarSeed = (
    data.radarTopic?.trim() ||
    data.niche?.trim() ||
    ''
  )
  const initialAudience =
    data.targetAudience ||
    audienceInsightsPain ||
    (radarSeed ? `Readers interested in ${radarSeed}` : '')

  const [selected, setSelected] = useState(data.persona)
  const [targetAudience, setTargetAudience] = useState(initialAudience)
  const [websiteUrl, setWebsiteUrl] = useState(data.websiteUrl)
  const [genre, setGenre] = useState(data.genre)
  // Business-persona-only state. We always keep these in state regardless
  // of selection so a user toggling Business → Storyteller → Business
  // doesn't lose what they typed.
  const [offerType, setOfferType] = useState(data.offerType)
  const [ctaIntent, setCtaIntent] = useState(data.ctaIntent)
  const [testimonials, setTestimonials] = useState(data.testimonials)
  const [error, setError] = useState('')

  // Whether the audience textarea was pre-filled from radar. Note shows
  // only when the seed actually fired (data.targetAudience was empty AND
  // we had something to fill from). Dismissing hides the note; the
  // textarea content stays put.
  const wasPrefilled = !data.targetAudience && (!!audienceInsightsPain || !!radarSeed)
  const [showPrefillNote, setShowPrefillNote] = useState(wasPrefilled)

  const showWebsite = selected === 'business'
  const showGenre   = selected === 'storyteller'

  function handleNext() {
    if (!selected) { setError('Choose a persona.'); return }
    onNext({
      persona:        selected,
      targetAudience: targetAudience.trim(),
      // Only the persona-relevant field flows through. Switching personas
      // later won't carry stale fields the user thought they'd erased.
      websiteUrl:     showWebsite ? websiteUrl.trim()   : '',
      genre:          showGenre   ? genre.trim()        : '',
      offerType:      showWebsite ? offerType           : '',
      ctaIntent:      showWebsite ? ctaIntent.trim()    : '',
      testimonials:   showWebsite ? testimonials.trim() : '',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl text-ink-1 mb-1">Your Audience</h2>
        <p className="text-ink-1/60 text-sm font-source-serif">
          Tell us who you&rsquo;re writing for. We&rsquo;ll use this — and your website if you add it — to build your chapter structure around real market intelligence.
        </p>
      </div>

      {/* Target audience — always visible. Free-form so users can be as
          specific (or vague) as they want; the radar prompt handles either. */}
      <div className="space-y-1">
        <label className="text-sm font-inter text-ink-1/80">Target audience</label>
        {showPrefillNote && (
          <div className="flex items-start gap-2 rounded-md bg-gold/10 border border-gold/30 px-3 py-2">
            <span className="text-gold-dim text-[11px] font-inter font-medium">
              Pre-filled from your market scan. Edit to match your specific reader.
            </span>
            <button
              type="button"
              onClick={() => setShowPrefillNote(false)}
              className="ml-auto text-ink-1/40 hover:text-ink-1/80 text-xs font-inter shrink-0"
              aria-label="Dismiss note"
            >
              ×
            </button>
          </div>
        )}
        <textarea
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          rows={2}
          placeholder="e.g. First-time homebuyers aged 28–45 who are overwhelmed by the mortgage process"
          className="w-full px-3 py-2.5 rounded-md bg-white border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-inter text-ink-1/80">Persona</p>
        <p className="text-ink-1/60 text-xs font-source-serif -mt-1">
          Shapes the tone of the writing and the style of the illustrations.
        </p>
      </div>

      <div className="grid gap-3">
        {PERSONAS.map((p) => {
          const Icon = p.icon
          return (
            <button
              key={p.id}
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

      {/* Persona-conditional follow-up. Business sees a website prompt
          (Firecrawl source); Storyteller sees a genre prompt (drives
          comp-title research on BookTok/Goodreads). Publisher gets neither —
          the persona has no follow-up because the radar prompt for that
          persona keys off competitor analysis already implicit in the title. */}
      {showWebsite && (
        <div className="space-y-1">
          <label className="text-sm font-inter text-ink-1/80">Website URL</label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
            className="w-full px-3 py-2 rounded-md bg-white border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
          <p className="text-ink-1/60 text-[11px] font-source-serif">
            Optional. We&apos;ll scan your homepage for context when running Creator Radar.
          </p>
        </div>
      )}

      {/* Business-only: what they sell, what they want readers to do, and
          social proof. All three flow into Creator Radar (positioning +
          monetization advice) and the chapter draft prompt (lets the model
          land business chapters with a persona-appropriate close instead
          of generic "consider booking a call" filler). */}
      {showWebsite && (
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
                      : 'bg-white border-cream-3 text-ink-1/70 hover:border-gold/40'
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
      )}

      {showWebsite && (
        <div className="space-y-1">
          <label className="text-sm font-inter text-ink-1/80">What do you want readers to do?</label>
          <input
            type="text"
            value={ctaIntent}
            onChange={(e) => setCtaIntent(e.target.value)}
            placeholder="e.g. Book a discovery call, join the program, subscribe to my newsletter"
            className="w-full px-3 py-2 rounded-md bg-white border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
          <p className="text-ink-1/60 text-[11px] font-source-serif">
            Optional. Used to land each chapter with a clear next step instead of generic filler.
          </p>
        </div>
      )}

      {showWebsite && (
        <div className="space-y-1">
          <label className="text-sm font-inter text-ink-1/80">Testimonials</label>
          <textarea
            value={testimonials}
            onChange={(e) => setTestimonials(e.target.value)}
            rows={3}
            placeholder={'Paste 1–3 short testimonials. e.g.\n"This program changed how I run my agency." — Jamie L., founder, Lumen Studio'}
            className="w-full px-3 py-2.5 rounded-md bg-white border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-source-serif text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
          />
          <p className="text-ink-1/60 text-[11px] font-source-serif">
            Optional. The AI may weave one in where it fits — never as a quote box, just as natural proof.
          </p>
        </div>
      )}

      {showGenre && (
        <div className="space-y-1">
          <label className="text-sm font-inter text-ink-1/80">Genre</label>
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="e.g. Romance, Thriller, Fantasy"
            className="w-full px-3 py-2 rounded-md bg-white border border-cream-3 text-ink-1 placeholder:text-ink-1/30 font-inter text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
          <p className="text-ink-1/60 text-[11px] font-source-serif">
            Optional. Helps Creator Radar pull comp titles and reader expectations from BookTok and Goodreads.
          </p>
        </div>
      )}

      {error && <p className="text-red-400 text-sm font-inter">{error}</p>}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-ink-1/60 hover:text-ink-1 font-inter text-sm transition-colors">Back</button>
        <button
          onClick={handleNext}
          disabled={!selected}
          className="px-6 py-2.5 bg-gold hover:bg-gold-soft text-ink-1 font-semibold font-inter text-sm font-medium rounded-md transition-colors disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
