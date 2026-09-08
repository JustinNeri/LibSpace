import { supabase } from './supabaseClient'
import { AVATAR_BUCKET } from './constants'

/**
 * Signed URLs for profile photos, shared across components.
 *
 * The bucket is private, so a photo needs a short-lived signed URL — and the
 * same photo is on screen two or three times at once (the rail, the account
 * card, the phone sheet). Without a cache each copy would sign its own.
 * Entries are dropped well before the signature expires, so nothing ever
 * renders a dead link.
 */
const SIGNED_SECONDS = 60 * 60
const CACHE_MS = 50 * 60 * 1000
const cache = new Map() // path -> { url, at }

/** Drop a cached URL — call after replacing or removing a photo. */
export function forgetAvatar(path) {
  if (path) cache.delete(path)
}

export async function signedAvatarUrl(path) {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.url

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, SIGNED_SECONDS)

  if (error || !data?.signedUrl) {
    console.error('[LibSpace] Could not sign avatar.', error)
    return null
  }

  cache.set(path, { url: data.signedUrl, at: Date.now() })
  return data.signedUrl
}

/** Whatever is already cached, for a first paint without a flash. */
export function cachedAvatarUrl(path) {
  return path ? (cache.get(path)?.url ?? null) : null
}
