import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function WizardPage({ params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-playfair text-3xl text-cream mb-2">Upload Wizard</h1>
        <p className="text-muted-foreground font-source-serif">Feature 3 — coming next</p>
      </div>
    </div>
  )
}
