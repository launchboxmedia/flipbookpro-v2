import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WizardShell } from '@/components/wizard/WizardShell'

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

  return <WizardShell bookId={params.bookId} initialTitle={book.title} />
}
