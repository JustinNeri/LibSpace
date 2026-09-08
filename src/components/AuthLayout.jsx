import { LibSpaceLockup, UniversityCrest } from './Logo'
import { LIBRARY_NAME, UNIVERSITY_NAME } from '../lib/constants'

/**
 * The shell every signed-out screen sits in.
 *
 * A deep pine field with the product's own motif — the availability bars from
 * the room cards, tiled — and a white card floating on it. The earlier
 * treatment (white card on faint ruled paper) was quiet enough to read as
 * unfinished, and gave a desktop nothing to look at but empty cream.
 *
 * Sign-in and the account form share it so the two screens in the same flow
 * stop looking like two different products.
 */
export default function AuthLayout({ children, footer = null, wide = false }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-brand-900 px-5 py-8 sm:px-6 sm:py-12">
      <Motif />

      <main className="relative flex flex-1 flex-col items-center justify-center py-4">
        <div className={wide ? 'w-full max-w-xl' : 'w-full max-w-[25.5rem]'}>
          <div className="rounded-3xl bg-white p-6 shadow-[0_30px_60px_-24px_oklch(0.15_0.02_165/0.6)] sm:p-8">
            <Lockup />
            {children}
          </div>

          {footer && (
            <div className="mt-5 text-center text-sm text-white/60">{footer}</div>
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
 * Brand mark inside the card, so the card carries the identity on its own.
 * The university's crest sits opposite it when the file is present — this is
 * their library's system, and the front door should say so.
 */
function Lockup() {
  return (
    <div className="mb-7 flex items-center justify-between gap-3">
      <LibSpaceLockup markClass="size-11" />
      <UniversityCrest className="size-10" />
    </div>
  )
}

/**
 * Rows of rounded pills at low opacity — the same shape as the day bar on a
 * room card. Decoration drawn from the product rather than bolted on.
 */
function Motif() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full opacity-[0.05]"
      style={{
        // Fade the pattern out behind the card so it frames rather than
        // competes — a flat tile at full strength read as a barcode wall.
        maskImage:
          'radial-gradient(115% 85% at 50% 45%, transparent 30%, black 78%)',
        WebkitMaskImage:
          'radial-gradient(115% 85% at 50% 45%, transparent 30%, black 78%)',
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

export function AuthHeading({ title, children }) {
  return (
    <>
      <h1 className="font-display text-[1.75rem] leading-tight font-semibold text-slate-900">
        {title}
      </h1>
      {children && (
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{children}</p>
      )}
    </>
  )
}

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

export function AuthButton({ busy, busyLabel = 'Working…', children }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3.5 text-sm font-bold tracking-wide text-white transition-colors duration-200 hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-60"
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
                active ? 'h-1.5 bg-brand-600' : done ? 'h-1.5 bg-brand-300' : 'h-1.5 bg-slate-200',
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
