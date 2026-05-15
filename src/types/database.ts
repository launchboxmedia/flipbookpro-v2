export type BookStatus = 'draft' | 'generating' | 'ready' | 'published'
export type PlanType = 'free' | 'standard' | 'pro'
export type GateType = 'none' | 'email' | 'payment'
/** New, authoritative gating field on published_books. gate_type is kept in
 *  sync for backward compatibility but new code should branch on access_type. */
export type AccessType = 'free' | 'email' | 'paid'

/** A single step in an acronym-driven framework book. */
export interface FrameworkStep {
  letter: string         // single uppercase letter, e.g. 'C'
  label: string          // short label for the step, e.g. 'Control Payment History'
  /** 0-based chapter_index this step maps to, when applicable. */
  chapter_index?: number
}

export interface FrameworkData {
  /** Display string for the acronym (e.g. "CREDIT" or "C.R.E.D.I.T."). */
  acronym: string
  steps: FrameworkStep[]
}

export interface Book {
  id: string
  user_id: string
  title: string
  subtitle: string | null
  author_name: string | null
  cover_image_url: string | null
  /** When true, the uploaded/generated cover image already contains the
   *  title/subtitle/author. Renderers should display the image plain and
   *  skip the overlay text + dark gradients. */
  cover_has_text: boolean
  /** Optional framework definition for acronym-driven books. When set,
   *  chapters whose chapter_index appears in any step get a decorative
   *  framework letter overlay. NULL = no framework. */
  framework_data: FrameworkData | null
  status: BookStatus
  persona: string | null
  visual_style: string | null
  vibe: string | null
  writing_tone: string | null
  reader_level: number | null
  human_score: boolean | null
  cover_direction: string | null
  typography: string | null
  palette: string | null
  slug: string | null
  back_cover_tagline: string | null
  back_cover_description: string | null
  back_cover_cta_text: string | null
  back_cover_cta_url: string | null
  back_cover_image_url: string | null
  // Final-CTA headline for the public /go/[slug] landing page. When unset,
  // the landing page falls back to back_cover_tagline. Optional because not
  // every Book select pulls it (the column was added by a later migration).
  closing_pitch?: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  // Creator Radar — market intelligence inputs + last result snapshot.
  target_audience: string | null
  website_url: string | null
  genre: string | null
  /** Topic string the user typed in Step 1 of the wizard. Used as a
   *  per-book differentiator in the intelligence_cache key so two new
   *  books in the same persona+offer pair don't collide on the cached
   *  radar result before title/audience/etc. are filled in. */
  niche?: string | null
  // Business-persona-only context: what the author sells, what they want
  // readers to do, and social proof to weave into chapters and Radar
  // positioning. All three are NULL for non-business personas.
  offer_type: string | null
  /** One-sentence description of what the business-owner author sells.
   *  Distinct from offer_type (the category) — this is the concrete
   *  pitch, captured in Step 2 of the wizard and used to sharpen the
   *  per-book Creator Radar pass + the chapter-draft prompt. NULL for
   *  non-business personas. Optional on the type so the dashboard's
   *  narrow column select doesn't have to include it; the wizard +
   *  setup flows always read/write the actual column. */
  offer_description?: string | null
  cta_intent: string | null
  testimonials: string | null
  creator_radar_data: RadarResult | null
  creator_radar_ran_at: string | null
  /** The radar's `audienceInsights.biggestPain` string, surfaced for UI
   *  display only. Previously /apply-radar wrote this directly into
   *  `target_audience`, which polluted the user's deliberate audience
   *  field when the radar's inferred reader didn't match the book's
   *  actual reader. Now it lives here so it can be referenced without
   *  corrupting the user-owned `target_audience`. NULL until /apply-radar
   *  runs with `targetAudience` selected. */
  radar_audience_insight?: string | null
  /** Set by /apply-radar when the user accepts radar intelligence. The
   *  distilled context lives in radar_context; this column is the "we've
   *  applied at least once" signal the UI uses to show "Applied X days ago". */
  radar_applied_at?: string | null
  radar_context?: RadarContext | null
  /** Per-chapter downloadable resources (checklists, templates, scripts,
   *  matrices, workflows, swipe files) referenced from chapter drafts via
   *  [[RESOURCE: Name | type]] markers. Populated server-side when a route
   *  needs them — left undefined when not loaded. */
  resources?: BookResource[]
}

export type BookResourceType =
  | 'checklist'
  | 'template'
  | 'script'
  | 'matrix'
  | 'workflow'
  | 'swipe-file'

export interface BookResource {
  id: string
  book_id: string
  chapter_index: number
  resource_name: string
  resource_type: BookResourceType
  content: string
  created_at: string
  updated_at: string
}

// ── Creator Radar ───────────────────────────────────────────────────────────
// Free-tier responses ship with most fields stripped; everything past the
// summary + a bare-signal list is gated. Hence everything below `summary`
// is optional on the result type — UI must be defensive.

export interface RadarMarketSignal {
  signal: string
  why_it_matters?: string
  urgency?: 'high' | 'medium' | 'low'
}

export interface RadarContentAngle {
  angle: string
  differentiator: string
  audience_fit: string
}

export interface RadarAudienceInsights {
  biggestPain: string
  alreadyTried: string[]
  willingToPay: string
  where_they_gather: string[]
}

export interface RadarCompetitorLandscape {
  crowded_areas: string[]
  gaps: string[]
  price_range: string
}

export interface RadarBookRecommendations {
  positioning: string
  suggested_hook: string
  ideal_length: string
  monetization: 'free' | 'paid' | 'lead_magnet'
  monetization_reason: string
}

/** Per-competitor analysis pulled from publisher-persona enrichment.
 *  Each entry comes from a Firecrawl scrape of a competitor URL extracted
 *  from the Perplexity research, then a Sonnet pass to extract the four
 *  fields below. Pro tier only on the panel. */
export interface RadarCompetitorEntry {
  title: string
  promise: string
  price: string
  weaknesses: string[]
  strengths: string[]
}

/** Structured website extraction for the business persona. Populated by
 *  the enrichment pass that runs after the Firecrawl scrape — single
 *  Sonnet call extracts all of these in one shot, plus the conversion
 *  recommendation pair. Pro tier only on the panel. */
export interface RadarWebsiteExtraction {
  companyName: string
  tagline: string
  offer: string
  targetAudience: string
  keyDifferentiators: string[]
  ctaText: string
  testimonials: string[]
  brandVoice: string
}

/** Granular per-aspect selections recorded by /apply-radar (new flow) so
 *  downstream consumers (OutlineStage, generate-draft) can honour what
 *  the user opted into. Defaults to all-true when missing — the legacy
 *  "Apply to Book" modal didn't ship with selections. */
export interface RadarAppliedSelections {
  targetAudience:   boolean
  chapterStructure: boolean
  backCover:        boolean
  openingHook:      boolean
  monetization:     boolean
}

/** Distilled radar intelligence stored on books.radar_context. Derived from
 *  the full RadarResult by /api/books/[id]/apply-radar so the chapter
 *  generation prompt has a focused, schema-stable surface to inject.
 *  Distinct from books.creator_radar_data which holds the full result. */
export interface RadarContext {
  audience_pain: string
  already_tried: string[]
  willing_to_pay: string
  where_they_gather: string[]
  positioning: string
  suggested_hook: string
  content_gaps: string[]
  monetization: string
  monetization_reason: string
  /** Storyteller-only — empty array when not present in the source result. */
  reader_language: string[]
  /** New flow only. The interstitial's checked-box state, persisted so
   *  later steps can gate on what was opted in to (e.g. don't prepend
   *  the suggested hook to Chapter 1 if openingHook was unchecked). */
  applied_selections?: RadarAppliedSelections
}

export interface RadarResult {
  summary: string
  marketSignals: RadarMarketSignal[]
  contentAngles?: RadarContentAngle[]
  audienceInsights?: RadarAudienceInsights
  competitorLandscape?: RadarCompetitorLandscape
  bookRecommendations?: RadarBookRecommendations
  sources: string[]
  // ── Persona-specific enrichment ────────────────────────────────────────
  /** Publisher only — per-competitor analysis from Firecrawl + Sonnet. */
  competitorData?: RadarCompetitorEntry[]
  /** Storyteller only — phrases pulled from Goodreads / reviews that the
   *  target reader actually uses to describe what they want. */
  readerLanguage?: string[]
  /** Business only — derived from the website's CTA verbs (buy/enroll/
   *  subscribe/etc) by Sonnet during structured extraction. */
  conversionRecommendation?: 'free' | 'paid' | 'lead_magnet'
  conversionReason?: string
  /** Business only — structured website analysis surfaced to Pro users. */
  websiteExtraction?: RadarWebsiteExtraction
  /** Business only — set by the relevance check that runs after the
   *  website is scraped. `true` = author's business serves the same
   *  audience as the book; `false` = the website was deemed irrelevant
   *  and stripped from synthesis (websiteExtraction is null in that
   *  case). Undefined when no relevance check ran (no website, scrape
   *  failed, or legacy result from before this field existed). */
  websiteRelevant?: boolean
}

/** A single citation pulled from Perplexity research. Stored as jsonb on
 *  book_pages.research_citations and serialised into the draft prompt. */
export interface ResearchCitation {
  title: string
  url: string
}

// ── Pre-book Creator Radar (topic discovery) ─────────────────────────────
// Distinct from per-book RadarResult: this powers the wizard Step 1 scratch
// mode where the user has no book yet. Perplexity returns three buckets of
// idea candidates. Used only as a discovery aid; not persisted to a row.

export interface CreatorRadarHotSignal {
  topic: string
  engagement: number
  /** Free-form, e.g. "rising", "stable", "spiking 2026" */
  trend_direction?: string
}

export interface CreatorRadarEvergreen {
  topic: string
  longevity_score: number
}

export interface CreatorRadarHiddenGold {
  niche: string
  opportunity_score: number
  competition_level: 'low' | 'medium' | 'high'
}

export interface CreatorRadarResult {
  hot_signals: CreatorRadarHotSignal[]
  evergreen_winners: CreatorRadarEvergreen[]
  hidden_gold: CreatorRadarHiddenGold[]
  /** Set when scoring across all buckets averages below the
   *  low-opportunity threshold (or every score is below the per-item
   *  floor). The wizard reframes the result as "adjacent opportunities"
   *  and offers a pivot prompt rather than presenting the topic as a
   *  viable standalone book idea. */
  low_opportunity?: boolean
  pivot_available?: boolean
  pivot_note?:      string
  /** Echo of the original topic the user typed, so the wizard can show
   *  the pivot prompt without re-deriving it from input state. */
  pivot_topic?:     string
}

export interface BookPage {
  id: string
  book_id: string
  chapter_index: number
  chapter_title: string
  chapter_brief: string | null
  content: string | null
  image_url: string | null
  approved: boolean
  /** Editorial single-sentence pull quote, extracted by Sonnet on chapter
   *  approval. NULL when extraction hasn't run yet or returned a result that
   *  failed validation. Viewer and PDF exporter both fall back gracefully. */
  pull_quote?: string | null
  /** Newline-delimited list of verified facts pulled by Perplexity Sonar
   *  for this chapter. NULL when research hasn't been run. Injected into
   *  the generate-draft prompt as background grounding. */
  research_facts?: string | null
  /** Source citations that back research_facts. Populated together with it. */
  research_citations?: ResearchCitation[] | null
  /** Haiku-generated visual scene description that drove the most recent
   *  chapter-image generation. Persisted so the author can see WHAT the
   *  model decided to draw (and override it with a custom prompt when
   *  the auto-extracted scene misses the mark). NULL on legacy rows
   *  generated before this column existed. */
  image_scene?: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  plan: PlanType
  logo_url: string | null
  /** Brand mascot / character image. Used by the "Mascot Cover" mode in
   *  Book Design — the mascot is layered as the central hero element by
   *  openai.images.edit() on top of a typography-first cover layout.
   *  PNG/WebP only on upload so transparency is preserved. */
  mascot_url?: string | null
  brand_color: string | null
  accent_color: string | null
  author_bio: string | null
  social_links: Record<string, string> | null
  brand_voice_tone: string | null
  brand_voice_style: string | null
  brand_voice_avoid: string | null
  brand_voice_example: string | null
  // ── Enrichment fields ──────────────────────────────────────────────────
  // Populated by /api/profile/enrich. All optional — a profile that's
  // never been enriched leaves these NULL and the UI degrades gracefully.
  /** Brand-facing name. Often a pen name or company; full_name is the auth-
   *  side identity. Used by the FlipbookViewer interior title page when set. */
  display_name?: string | null
  brand_name?: string | null
  brand_tagline?: string | null
  /** Primary call-to-action URL surfaced on the back cover and email gates. */
  cta_url?: string | null
  cta_text?: string | null
  /** Sits alongside brand_color/accent_color so the enrichment can write
   *  brand identity colors without overwriting manual customisations the
   *  user already set on the brand panel. */
  primary_color?: string | null
  background_color?: string | null
  expertise?: string[] | null
  audience_description?: string | null
  offer_types?: string[] | null
  website_url?: string | null
  /** Last successful enrichment run. Used by the brand panel to show a
   *  "last enriched X days ago" hint. */
  enrich_ran_at?: string | null
  // ── ─────────────────────────────────────────────────────────────────────
  stripe_customer_id: string | null
  stripe_connect_id: string | null
  stripe_connect_status: string | null
  books_created_this_month: number
  books_reset_at: string
  created_at: string
  updated_at: string
}

export interface PublishedBook {
  id: string
  book_id: string
  user_id: string
  slug: string
  title: string
  author: string | null
  subtitle: string | null
  description: string | null
  cover_image_url: string | null
  gate_type: GateType
  access_type: AccessType
  price_cents: number
  is_active: boolean
  published_at: string
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  published_book_id: string
  book_id: string | null
  user_id: string | null
  email: string
  name: string | null
  source: string
  created_at: string
}
