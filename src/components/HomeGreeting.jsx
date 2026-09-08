import { ArrowRight, CalendarClock, Hourglass } from 'lucide-react'
import { useNextBooking } from '../hooks/useNextBooking'
import { useAuth } from '../hooks/useAuth'
import { firstNameOf } from '../lib/nav'
import {
  formatTime,
  isSameDay,
  minutesFromDate,
  toDateKey,
} from '../lib/time'

/**
 * The top of the rooms screen: who you are, how the day looks, and the one
 * booking you already have.
 *
 * The greeting used to sit in the header and only on desktop, which meant a
 * phone — where almost every student opens this — got no welcome at all and
 * went straight from a logo strip into a grid of rooms.
 */
export default function HomeGreeting({ onViewBookings }) {
  const { profile, user } = useAuth()
  const name = firstNameOf(profile, user)
  const { greeting, line } = dayCopy(new Date().getHours())

  return (
    <section className="mb-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/65">{greeting},</p>
          <h1 className="font-display mt-0.5 truncate text-[1.75rem] leading-tight font-semibold text-white sm:text-[2rem]">
            {name}
            <span aria-hidden className="ml-2">
              🌿
            </span>
          </h1>
          <p className="mt-1.5 text-sm text-white/65">{line}</p>
        </div>

        {/* Decoration, so it is hidden from screen readers and dropped on the
            narrowest phones where the greeting needs the whole row. */}
        <StudyIllustration className="hidden h-20 w-32 shrink-0 min-[380px]:block sm:h-24 sm:w-40" />
      </div>

      <NextBookingCard onViewBookings={onViewBookings} />
    </section>
  )
}

/** Greeting and a line that fits the hour, so it does not read as canned. */
function dayCopy(hour) {
  if (hour < 12) {
    return { greeting: 'Good morning', line: 'Study well. You got this!' }
  }
  if (hour < 18) {
    return { greeting: 'Good afternoon', line: 'Good time to grab a room for later.' }
  }
  return { greeting: 'Good evening', line: 'Winding down? Book ahead for tomorrow.' }
}

/**
 * "Your next booking" — the answer to the question a student opens the app
 * with more often than any other. Renders nothing when there is no booking,
 * rather than an empty state nobody needs.
 */
function NextBookingCard({ onViewBookings }) {
  const { booking, loading } = useNextBooking()

  if (loading || !booking) return null

  const start = new Date(booking.start_time)
  const end = new Date(booking.end_time)
  const pending = booking.status === 'pending'
  const running = start <= new Date() && new Date() < end

  return (
    <div
      className={[
        'mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5',
        pending
          ? 'border-amber-200 bg-amber-50'
          : 'border-brand-200 bg-brand-50',
      ].join(' ')}
    >
      <span
        className={[
          'grid size-10 shrink-0 place-items-center rounded-xl',
          pending ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700',
        ].join(' ')}
      >
        {pending ? (
          <Hourglass className="size-5" strokeWidth={2} />
        ) : (
          <CalendarClock className="size-5" strokeWidth={2} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={[
            'text-[11px] font-bold tracking-[0.12em] uppercase',
            pending ? 'text-amber-700' : 'text-brand-700',
          ].join(' ')}
        >
          {pending
            ? 'Waiting on staff'
            : running
              ? 'Happening now'
              : 'Your next booking'}
        </p>
        <p className="mt-1 truncate text-base font-semibold text-slate-900">
          {booking.rooms?.name ?? 'Discussion room'}
        </p>
        <p className="tnum mt-0.5 text-sm text-slate-600">
          {relativeDay(start)} · {formatTime(minutesFromDate(start))} –{' '}
          {formatTime(minutesFromDate(end))}
        </p>
      </div>

      <button
        type="button"
        onClick={onViewBookings}
        className={[
          'inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white transition-all duration-200 ease-in-out',
          pending
            ? 'bg-amber-600 hover:bg-amber-700'
            : 'bg-brand-700 hover:bg-brand-800',
        ].join(' ')}
      >
        View booking
        <ArrowRight className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  )
}

/** "Today" / "Tomorrow" / "Thu, Sep 11" — enough to place a booking. */
function relativeDay(date) {
  const now = new Date()
  if (isSameDay(date, now)) return 'Today'

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (toDateKey(date) === toDateKey(tomorrow)) return 'Tomorrow'

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Books and a plant, in the brand's greens.
 *
 * Drawn here rather than shipped as an asset so it inherits the palette and
 * costs no request — and so it can never be the one image that fails to load
 * on the first screen a student sees.
 */
function StudyIllustration({ className = '' }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 160 96"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* soft ground */}
      <ellipse cx="80" cy="84" rx="62" ry="9" className="fill-brand-500/10" />

      {/* stacked books */}
      <rect x="24" y="62" width="74" height="14" rx="4" className="fill-brand-700" />
      <rect x="28" y="66" width="66" height="2.5" rx="1.25" className="fill-white/35" />

      <rect x="30" y="48" width="62" height="14" rx="4" className="fill-brand-500" />
      <rect x="34" y="52" width="54" height="2.5" rx="1.25" className="fill-white/35" />

      <rect x="36" y="34" width="50" height="14" rx="4" className="fill-accent-400" />
      <rect x="40" y="38" width="42" height="2.5" rx="1.25" className="fill-white/45" />

      {/* pot */}
      <path
        d="M110 62h26l-3.5 17a4 4 0 0 1-4 3.4h-11a4 4 0 0 1-4-3.4L110 62Z"
        className="fill-accent-300"
      />
      <rect x="107" y="57" width="32" height="7" rx="3.5" className="fill-accent-400" />

      {/* leaves */}
      <path
        d="M123 57c0-11 5-19 13-23-1 12-5 19-13 23Z"
        className="fill-brand-500"
      />
      <path
        d="M123 57c0-9-4.5-16-11.5-19.5C112.5 47 116.5 53.5 123 57Z"
        className="fill-brand-600"
      />
      <path d="M123 57V38" className="stroke-brand-700" strokeWidth="1.5" />

      {/* a couple of drifting leaves, for air */}
      <circle cx="100" cy="24" r="3" className="fill-brand-300" />
      <circle cx="18" cy="40" r="2.5" className="fill-accent-300" />
    </svg>
  )
}
