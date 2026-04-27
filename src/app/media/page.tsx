import { createClient } from '@/lib/supabase/server'
import { ImageIcon } from 'lucide-react'

export const metadata = { title: 'Media — FlipBookPro' }

export default async function MediaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Pull all chapter and cover images across user's books
  const { data: books } = await supabase
    .from('books')
    .select('id, title, cover_image_url')
    .eq('user_id', user!.id)
    .not('cover_image_url', 'is', null)
    .order('updated_at', { ascending: false })

  const { data: pages } = await supabase
    .from('book_pages')
    .select('id, chapter_title, image_url, book_id')
    .in('book_id', (books ?? []).map((b) => b.id).concat(['_']))
    .not('image_url', 'is', null)

  const covers = (books ?? []).map((b) => ({
    type: 'cover' as const,
    url: b.cover_image_url!,
    label: b.title,
    bookId: b.id,
  }))

  const chapters = (pages ?? []).map((p) => ({
    type: 'chapter' as const,
    url: p.image_url!,
    label: p.chapter_title ?? 'Chapter',
    bookId: p.book_id,
  }))

  const all = [...covers, ...chapters]

  return (
    <div className="px-8 py-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="font-playfair text-3xl text-cream">Media</h2>
        <p className="text-muted-foreground text-sm font-source-serif mt-1">
          All generated and uploaded images across your books.
        </p>
      </div>

      {all.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 text-center">
          <ImageIcon className="w-12 h-12 text-[#333] mb-4" />
          <h3 className="font-playfair text-xl text-cream/60 mb-2">No media yet</h3>
          <p className="text-muted-foreground text-sm font-source-serif max-w-sm">
            Images generated for your chapters and covers will appear here.
          </p>
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3 space-y-3">
          {all.map((item, i) => (
            <div key={i} className="break-inside-avoid group relative rounded-xl overflow-hidden bg-[#222] border border-[#333]">
              <img src={item.url} alt={item.label} className="w-full object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-cream text-xs font-inter truncate">{item.label}</p>
                <span className="text-[10px] font-inter text-muted-foreground capitalize">{item.type}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
