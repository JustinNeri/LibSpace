import { LIBRARY_NAME, UNIVERSITY_LOGO, UNIVERSITY_NAME } from '../lib/constants'
import { useState } from 'react'

/**
 * The LibSpace mark.
 *
 * A book spine beside two slot bars — the same two shapes the product is
 * built from. The spine is the library; the bars are a room's day, one of
 * them shorter and warm because part of it is taken. It is the availability
 * bar from the room cards and the pattern behind the sign-in screen, reduced
 * until it still holds at 16px.
 *
 * Self-contained (tile included) so the favicon and the in-app mark cannot
 * drift apart.
 */
export function LibSpaceMark({ className = 'size-10', title = 'LibSpace' }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={className}
      fill="none"
    >
      <rect width="32" height="32" rx="9" className="fill-brand-700" />
      {/* spine */}
      <rect x="8" y="9" width="3.5" height="14" rx="1.75" fill="white" />
      {/* the day: a free run, then a shorter one already taken */}
      <rect x="14" y="9" width="10" height="5" rx="2.5" fill="white" />
      <rect x="14" y="18" width="7" height="5" rx="2.5" className="fill-accent-400" />
    </svg>
  )
}

/**
 * Mark plus wordmark. `tone` switches the type for a dark background.
 */
export function LibSpaceLockup({
  tone = 'dark',
  subtitle = UNIVERSITY_NAME,
  markClass = 'size-11',
  className = '',
}) {
  const onDark = tone === 'light'
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LibSpaceMark className={`${markClass} shrink-0`} />
      <div className="min-w-0">
        <p
          className={[
            'font-display text-lg leading-none font-semibold',
            onDark ? 'text-white' : 'text-slate-900',
          ].join(' ')}
        >
          LibSpace
        </p>
        {subtitle && (
          <p
            className={[
              'mt-1 truncate text-[11px] tracking-wide',
              onDark ? 'text-white/60' : 'text-slate-500',
            ].join(' ')}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * The university's own crest.
 *
 * Not drawn here: it is Holy Angel University's trademark, so the real file
 * has to come from them. Drop it at the path named by `UNIVERSITY_LOGO` and
 * it appears wherever this component is used; until then the component
 * renders nothing at all rather than a stand-in, so nothing on screen ever
 * misrepresents the university's mark.
 */
export function UniversityCrest({ className = 'size-9', showName = false }) {
  const [missing, setMissing] = useState(false)

  if (missing || !UNIVERSITY_LOGO) return null

  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src={UNIVERSITY_LOGO}
        alt={`${UNIVERSITY_NAME} logo`}
        onError={() => setMissing(true)}
        className={`${className} shrink-0 object-contain`}
      />
      {showName && (
        <span className="text-left">
          <span className="block text-xs font-semibold text-slate-900">
            {UNIVERSITY_NAME}
          </span>
          <span className="block text-[11px] text-slate-500">{LIBRARY_NAME}</span>
        </span>
      )}
    </span>
  )
}
