import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function PublishPage({ params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-playfair text-3xl text-cream mb-2">Publish</h1>
        <p className="text-muted-foreground font-source-serif mb-6">Feature 10 — coming soon</p>
        <Link href={`/book/${params.bookId}/coauthor`} className="text-accent hover:text-accent/80 font-inter text-sm">
          ← Back to Co-Author
        </Link>
      </div>
    </div>
  )
}
