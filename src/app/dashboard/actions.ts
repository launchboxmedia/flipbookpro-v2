'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function deleteBook(bookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('books')
    .delete()
    .eq('id', bookId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard')
}

export async function createBook() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('books')
    .insert({
      user_id: user.id,
      title: 'Untitled Book',
      status: 'draft',
    })
    .select()
    .single()

  if (error || !data) redirect('/dashboard')

  redirect(`/book/${data.id}/wizard`)
}
