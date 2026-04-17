export type BookStatus = 'draft' | 'generating' | 'ready' | 'published'

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
  cover_direction: string | null
  typography: string | null
  slug: string | null
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
  email: string
  full_name: string | null
  avatar_url: string | null
  plan: 'free' | 'standard' | 'pro'
  logo_url: string | null
  brand_color: string | null
  author_bio: string | null
  social_links: Record<string, string> | null
  created_at: string
}
