export type BookStatus = 'draft' | 'generating' | 'ready' | 'published'
export type PlanType = 'free' | 'standard' | 'pro'
export type GateType = 'none' | 'email' | 'payment'

export interface Book {
  id: string
  user_id: string
  title: string
  subtitle: string | null
  author_name: string | null
  cover_image_url: string | null
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
  published_at: string | null
  created_at: string
  updated_at: string
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
  brand_color: string | null
  accent_color: string | null
  author_bio: string | null
  social_links: Record<string, string> | null
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
  price_cents: number | null
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
