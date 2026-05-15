import type { BookStatus } from '@/types/database'

/** Library-only view model. Flattens the joins (published_books, leads,
 *  book_pages) into per-book counts so the client components stay simple
 *  and don't need to walk relations again at render time. */
export interface BookWithMeta {
  id: string
  title: string
  subtitle: string | null
  author_name: string | null
  status: BookStatus
  cover_image_url: string | null
  palette: string | null
  visual_style: string | null
  created_at: string
  updated_at: string
  chapterCount: number
  approvedCount: number
  isPublished: boolean
  slug: string | null
  leadCount: number
}

export type ShelfKey = 'published' | 'ready' | 'inProgress'
