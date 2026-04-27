import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidVisualStyle } from '@/lib/imageGeneration'
import { isValidPaletteId } from '@/lib/palettes'

export async function POST(req: NextRequest, { params }: { params: { bookId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { visualStyle, palette } = body as { visualStyle?: unknown; palette?: unknown }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (visualStyle !== undefined) {
    if (typeof visualStyle !== 'string' || !isValidVisualStyle(visualStyle)) {
      return NextResponse.json({ error: 'Invalid visual style' }, { status: 400 })
    }
    update.visual_style = visualStyle
  }

  if (palette !== undefined) {
    if (typeof palette !== 'string' || !isValidPaletteId(palette)) {
      return NextResponse.json({ error: 'Invalid palette' }, { status: 400 })
    }
    update.palette = palette
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('id', params.bookId)
    .eq('user_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('books')
    .update(update)
    .eq('id', params.bookId)
    .eq('user_id', user.id)

  if (error) {
    console.error('[update-style]', error.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...update })
}
