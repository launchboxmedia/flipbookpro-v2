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

/** Creates a draft book and redirects into the wizard.
 *
 *  Appends ?mode=<mode> so the wizard's Step 1 can branch correctly.
 *  Both 'scratch' (problem statement + Creator Radar) and 'upload' (paste
 *  an outline) are first-class — earlier the suffix only fired for
 *  'upload', which silently degraded scratch to outline because the
 *  wizard page defaults to 'upload' when ?mode= is absent. Edit-existing-
 *  book callers pass nothing, so the legacy no-suffix URL still works for
 *  that path. */
export async function createBook(mode?: 'scratch' | 'upload') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line no-console
  console.log('[createBook] navigating with mode:', mode)

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

  const suffix = mode ? `?mode=${mode}` : ''
  const target = `/book/${data.id}/wizard${suffix}`
  // eslint-disable-next-line no-console
  console.log('[createBook] redirect →', target)
  redirect(target)
}
