import { useMemo } from 'react'
import { CalendarCheck, DoorOpen, Hourglass, Moon } from 'lucide-react'
import { buildSlots } from '../lib/time'
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

  return (
    <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
      <Stat
        icon={shut || stats.offHours ? Moon : DoorOpen}
        tone={shut || stats.offHours ? 'slate' : 'emerald'}
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
        tone={shut ? 'slate' : 'brand'}
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

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-600',
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
