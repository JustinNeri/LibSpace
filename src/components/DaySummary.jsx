import { useMemo } from 'react'
import { ArrowRight, CalendarCheck, DoorOpen, Hourglass, Moon } from 'lucide-react'
import { addDays, buildSlots, formatTime, parseTimeString } from '../lib/time'
import { buildLane, summarise } from '../lib/availability'

/**
 * A three-number answer to "can I get a room?", above the room grid.
 * Cheap to compute — the same lanes the cards below already need.
 */
export default function DaySummary({
  rooms,
  reservations,
  blocks,
  schedules,
  dayWindow,
  weekday,
  date,
  onChangeDate = null,
  nowMinutes = null,
  graceMinutes = 0,
  dayClosedReason = null,
  currentUserId = null,
  isAdmin = false,
  loading = false,
}) {
  const stats = useMemo(() => {
    const slots = buildSlots(dayWindow.startMin, dayWindow.endMin)
    const currentIndex =
      nowMinutes === null
        ? -1
        : slots.findIndex(
            (slot) => nowMinutes >= slot.startMin && nowMinutes < slot.endMin,
          )

    let freeNow = 0
    let openNow = 0
    let freeSlots = 0

    for (const room of rooms) {
      const lane = buildLane({
        room,
        slots,
        schedules,
        blocks,
        reservations,
        weekday,
        dayWindow,
        nowMinutes,
        graceMinutes,
        dayClosedReason,
      })
      freeSlots += summarise(lane, { slots, nowMinutes, dayClosedReason }).free

      if (currentIndex !== -1 && lane[currentIndex]?.state !== 'closed') {
        openNow += 1
        if (lane[currentIndex].state === 'free') freeNow += 1
      }
    }

    // Staff need the queue, not their own bookings: filtering an admin down
    // to `user_id === currentUserId` left this tile reading 0 however many
    // requests were actually waiting for them.
    const awaiting = reservations.filter(
      (row) =>
        row.status === 'pending' && (isAdmin || (currentUserId && row.user_id === currentUserId)),
    ).length

    // currentIndex is -1 whenever the clock sits outside the day's window —
    // before opening or after closing — and "0 of 10 free right now" is a
    // misleading way to say the library is shut. So is every room being shut
    // at this hour while the window stays open for some other room.
    return {
      freeNow,
      freeSlots,
      awaiting,
      // Rooms actually open at this minute, not every room on the books: on a
      // Saturday with two rooms open, "1 of 10" understates the odds badly.
      openNow,
      offHours: nowMinutes !== null && (currentIndex === -1 || openNow === 0),
    }
  }, [
    rooms,
    reservations,
    blocks,
    schedules,
    dayWindow,
    weekday,
    nowMinutes,
    graceMinutes,
    dayClosedReason,
    currentUserId,
    isAdmin,
  ])

  if (loading || rooms.length === 0) return null

  const shut = dayClosedReason !== null

  // Three tiles reading "—", "0" and "0" is a band of chrome that says
  // nothing. When there is nothing left to book, one sentence says it better
  // and gives the room list back a screen of space.
  const nothingToShow = shut || (stats.offHours && stats.freeSlots === 0)

  if (nothingToShow) {
    return (
      <ClosedNotice
        reason={dayClosedReason}
        date={date}
        schedules={schedules}
        weekday={weekday}
        onChangeDate={onChangeDate}
      />
    )
  }

  return (
    <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
      <Stat
        icon={shut || stats.offHours ? Moon : DoorOpen}
        tone={shut || stats.offHours ? 'slate' : 'brand'}
        value={shut || nowMinutes === null || stats.offHours ? '—' : stats.freeNow}
        suffix={
          shut || nowMinutes === null || stats.offHours ? '' : ` of ${stats.openNow}`
        }
        label={
          dayClosedReason === 'past'
            ? 'Past date'
            : dayClosedReason === 'too-far'
              ? 'Not open yet'
              : nowMinutes === null
                ? 'Not today'
                : stats.offHours
                  ? 'Library closed now'
                  : 'Free right now'
        }
      />
      <Stat
        icon={CalendarCheck}
        tone="slate"
        value={shut ? '—' : stats.freeSlots}
        label={
          shut
            ? 'Booking closed'
            : stats.freeSlots === 0
              ? 'No slots left today'
              : 'Open half-hour slots'
        }
      />
      {/* Day-scoped, like everything else on this screen — `reservations`
          only ever holds the day being viewed, so the label says so rather
          than implying a running total. */}
      <Stat
        icon={Hourglass}
        tone={stats.awaiting === 0 ? 'slate' : 'amber'}
        value={stats.awaiting}
        label={isAdmin ? 'Pending this day' : 'Yours pending this day'}
      />
    </div>
  )
}

/**
 * Why nothing can be booked, and the quickest way out of it.
 *
 * "The library is closed" on its own leaves a student guessing when to come
 * back, so this says when the next day opens and offers one tap to go and
 * look at it. The reopening time is read from the rooms' own schedules for
 * that weekday, not assumed.
 */
function ClosedNotice({ reason, date, schedules, weekday, onChangeDate }) {
  const tomorrow = date ? addDays(date, 1) : null

  // Earliest opening across every room scheduled for tomorrow's weekday.
  const reopensAt = useMemo(() => {
    const tomorrowWeekday = (weekday + 1) % 7
    const opens = schedules
      .filter((row) => row.weekday === tomorrowWeekday)
      .map((row) => parseTimeString(row.opens_at))
      .filter((value) => value !== null)

    return opens.length > 0 ? Math.min(...opens) : null
  }, [schedules, weekday])

  const past = reason === 'past'
  const tooFar = reason === 'too-far'

  const title = past
    ? 'This date has passed'
    : tooFar
      ? 'Booking is not open this far ahead'
      : 'The library is closed today'

  const detail = past
    ? 'Pick today or a later date to reserve a room.'
    : tooFar
      ? 'Pick an earlier date — the library only takes bookings a couple of weeks out.'
      : reopensAt !== null
        ? `Room reservations reopen tomorrow at ${formatTime(reopensAt)}.`
        : 'Pick another day to reserve a room.'

  return (
    <div className="surface mb-5 flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
        <Moon className="size-4.5" strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm text-slate-500">{detail}</p>

        {onChangeDate && (past || tooFar || tomorrow) && (
          <button
            type="button"
            onClick={() =>
              onChangeDate(past || tooFar ? new Date() : tomorrow)
            }
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 transition-all duration-200 ease-in-out hover:translate-x-0.5 hover:text-brand-800"
          >
            {past || tooFar ? 'Go to today' : "View tomorrow's availability"}
            <ArrowRight className="size-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  )
}

const TONES = {
  slate: 'bg-slate-100 text-slate-500',
  brand: 'bg-brand-50 text-brand-600',
  amber: 'bg-amber-50 text-amber-600',
}

/**
 * Stacked on a phone so three of them still fit across a 360px screen —
 * they used to drop to one per row, pushing the room list a full screen
 * down. From `sm` up they lie back down beside their icon.
 */
function Stat({ icon: Icon, tone, value, suffix = '', label }) {
  return (
    <div className="surface flex flex-col gap-1.5 px-3 py-3 sm:flex-row sm:items-center sm:gap-3.5 sm:px-4 sm:py-3.5">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-lg sm:size-10 sm:rounded-xl ${TONES[tone]}`}
      >
        <Icon className="size-4 sm:size-4.5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="tnum text-lg leading-none font-bold tracking-tight text-slate-900 sm:text-xl">
          {value}
          <span className="text-xs font-medium text-slate-400 sm:text-sm">{suffix}</span>
        </p>
        <p className="mt-1 text-[11px] leading-tight text-slate-500 sm:text-xs">{label}</p>
      </div>
    </div>
  )
}
