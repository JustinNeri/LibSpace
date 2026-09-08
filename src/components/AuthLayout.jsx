import { useState } from 'react'
import { LibSpaceLockup, UniversityCrest } from './Logo'
import { CAMPUS_PHOTO, LIBRARY_NAME, UNIVERSITY_NAME } from '../lib/constants'

/**
 * The shell every signed-out screen sits in.
 *
 * A deep pine field with the campus at dusk washed into it, and a white card
 * floating on top. The identity and the greeting sit on the field itself, so
 * the card can be nothing but the form — a login screen reads faster when the
 * thing you came to do is the only thing inside the box.
 *
 * Sign-in and the account form share it so the two screens in the same flow
 * stop looking like two different products.
 */
export default function AuthLayout({
  children,
  hero = null,
  footer = null,
  wide = false,
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-brand-900 px-5 py-8 sm:px-6 sm:py-12">
      <CampusField />

      <main className="relative flex flex-1 flex-col items-center justify-center py-4">
        <div className={wide ? 'w-full max-w-xl' : 'w-full max-w-[25.5rem]'}>
          <Lockup />

          {hero && (
            <div className="mb-6 animate-slide-up">
              <h1 className="font-display text-[2.25rem] leading-[1.1] font-semibold text-white sm:text-[2.5rem]">
                {hero.title}
                {hero.emoji && (
                  <span aria-hidden className="ml-2.5 inline-block">
                    {hero.emoji}
                  </span>
                )}
              </h1>
              {hero.subtitle && (
                <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-white/70">
                  {hero.subtitle}
                </p>
              )}
            </div>
          )}

          {/* Softer corners, more air, and a shadow that reads as lift rather
              than as a dark band under the card. */}
          <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_2px_4px_oklch(0.15_0.02_165/0.12),0_36px_70px_-28px_oklch(0.12_0.02_165/0.65)] sm:p-8">
            {children}
          </div>

          {footer && (
            <div className="mt-6 text-center text-sm text-white/70">{footer}</div>
          )}
        </div>
      </main>

      <p className="relative text-center text-[11px] tracking-wide text-white/40">
        {UNIVERSITY_NAME} · {LIBRARY_NAME}
      </p>
    </div>
  )
}

/**
 * Brand mark above the card, on the field, with the university's crest
 * opposite it — this is their library's system, and the front door should say
 * so before you reach the form.
 */
function Lockup() {
  return (
    <div className="mb-8 flex items-center justify-between gap-3">
      <LibSpaceLockup tone="light" markClass="size-11" />
      <UniversityCrest className="size-10" />
    </div>
  )
}

/**
 * The background: campus at dusk, sunk into the pine field.
 *
 * The photo is the university's and is not committed to the repo, so this
 * degrades on purpose — if the file is missing `onError` drops it and what
 * remains is the pine field and the motif, which is what the screen looked
 * like before. Nothing ever renders broken.
 */
function CampusField() {
  const [photoMissing, setPhotoMissing] = useState(false)
  const showPhoto = CAMPUS_PHOTO && !photoMissing

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {showPhoto && (
        <img
          src={CAMPUS_PHOTO}
          alt=""
          onError={() => setPhotoMissing(true)}
          className="absolute inset-0 size-full object-cover object-center opacity-45"
          style={{
            // Hold the photo back from the top of the screen, where the
            // lockup and heading need clean contrast, and let it come up
            // behind and below the card.
            maskImage:
              'linear-gradient(to bottom, transparent 8%, black 60%, black 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 8%, black 60%, black 100%)',
          }}
        />
      )}

      {/* Pine tint over the photo: keeps it in the brand's colour, and keeps
          white type readable on it at every screen height. */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-900 via-brand-900/72 to-brand-900/88" />

      {/* A little lift directly behind the card. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(60% 45% at 50% 42%, oklch(0.602 0.116 162 / 0.20), transparent 70%)',
        }}
      />

      <Motif />
    </div>
  )
}

/**
 * Rows of rounded pills at low opacity — the same shape as the day bar on a
 * room card. Decoration drawn from the product rather than bolted on, and
 * quiet enough now that the photograph carries the atmosphere instead.
 */
function Motif() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 size-full opacity-[0.028]"
      style={{
        maskImage: 'radial-gradient(115% 85% at 50% 45%, transparent 34%, black 82%)',
        WebkitMaskImage:
          'radial-gradient(115% 85% at 50% 45%, transparent 34%, black 82%)',
      }}
    >
      <defs>
        <pattern
          id="libspace-slots"
          width="184"
          height="76"
          patternUnits="userSpaceOnUse"
        >
          {/* Two staggered rows, so it reads as booked and free time rather
              than as a regular grid. */}
          <rect x="0" y="14" width="70" height="14" rx="7" fill="white" />
          <rect x="80" y="14" width="34" height="14" rx="7" fill="white" />
          <rect x="124" y="14" width="52" height="14" rx="7" fill="white" />

          <rect x="-34" y="52" width="52" height="14" rx="7" fill="white" />
          <rect x="28" y="52" width="76" height="14" rx="7" fill="white" />
          <rect x="114" y="52" width="30" height="14" rx="7" fill="white" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#libspace-slots)" />
    </svg>
  )
}

/* ---------------- shared form furniture ---------------- */

export function Label({ htmlFor, children, className = '' }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-[11px] font-bold tracking-[0.12em] text-slate-500 uppercase ${className}`}
    >
      {children}
    </label>
  )
}

/** Small caps heading with a hairline, replacing the notched fieldset. */
export function SectionHeading({ children }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase">
        {children}
      </span>
      <span aria-hidden className="h-px flex-1 bg-slate-200" />
    </div>
  )
}

/** Defined as `.field` in index.css so app screens share it. */
export const authField = 'field'

/**
 * A `.field` with an icon sitting inside its left edge. Pair it with
 * `pl-11` on the input.
 *
 * Only the auth screens use it: on a form of two inputs an icon is a useful
 * landmark, whereas on the account form's twelve it would be noise.
 */
export function IconField({ icon: Icon, children }) {
  return (
    <div className="relative">
      <Icon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400"
        strokeWidth={2}
      />
      {children}
    </div>
  )
}

export function AuthButton({ busy, busyLabel = 'Working…', children }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-5 py-4 text-[0.9375rem] font-bold tracking-wide text-white shadow-[0_10px_24px_-12px_oklch(0.362_0.072_164/0.9)] transition-colors duration-200 hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-60"
    >
      {busy ? busyLabel : children}
    </button>
  )
}

/** Where you are in email -> code -> details. */
export function Steps({ current }) {
  const steps = ['Email', 'Code', 'Details']
  return (
    <ol className="mb-6 flex items-center gap-2">
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <span
              className={[
                'flex-1 rounded-full transition-colors duration-200',
                active
                  ? 'h-1.5 bg-brand-600'
                  : done
                    ? 'h-1.5 bg-brand-300'
                    : 'h-1.5 bg-slate-200',
              ].join(' ')}
            />
          </li>
        )
      })}
      <li className="shrink-0 text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase">
        {steps[current]}
      </li>
    </ol>
  )
}
