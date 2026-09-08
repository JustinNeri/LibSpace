import { useEffect, useState } from 'react'
import { cachedAvatarUrl, signedAvatarUrl } from '../lib/avatarUrl'
import { initialsFor } from '../lib/nav'

/**
 * A user's photo, falling back to their initials.
 *
 * `profile` and `user` are the same shapes `useAuth` hands out, so callers can
 * pass them straight through.
 */
export default function Avatar({
  profile,
  user,
  className = 'size-10',
  rounded = 'rounded-full',
  textClass = 'text-xs',
}) {
  const path = profile?.avatar_path ?? null
  const [url, setUrl] = useState(() => cachedAvatarUrl(path))

  useEffect(() => {
    let cancelled = false
    if (!path) {
      setUrl(null)
      return
    }
    signedAvatarUrl(path).then((next) => {
      if (!cancelled) setUrl(next)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  const shared = `${className} ${rounded} shrink-0 overflow-hidden`

  if (path && url) {
    return (
      <img
        src={url}
        alt=""
        // A broken signature should show initials, not a torn-image icon.
        onError={() => setUrl(null)}
        className={`${shared} bg-slate-100 object-cover`}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={`${shared} grid place-items-center bg-brand-700 font-bold text-white ${textClass}`}
    >
      {initialsFor(profile, user)}
    </span>
  )
}
