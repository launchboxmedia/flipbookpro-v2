import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

export function generateRawKey(): string {
  return 'fbp_' + randomBytes(24).toString('hex')
}

export async function validateApiKey(
  req: Request,
): Promise<{ userId: string; keyId: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer fbp_')) return null

  const rawKey = authHeader.slice(7)
  const keyHash = hashApiKey(rawKey)

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) return null

  // Non-blocking last_used_at update
  supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { userId: data.user_id, keyId: data.id }
}
