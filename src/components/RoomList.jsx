import { useMemo } from 'react'
import { ChevronRight, Monitor, Plug, PenLine, Users } from 'lucide-react'
import { buildSlots, formatTime } from '../lib/time'
import { buildLane, summarise } from '../lib/availability'

const EQUIPMENT_ICONS = {
  Whiteboard: PenLine,
  Display: Monitor,
  Outlets: Plug,
}

/** How many free start times a card shows before it stops listing them. */
const MAX_SLOT_CHIPS = 4

/**
 * A room's day in one word, with the colour that goes with it.
 *
 * Four states rather than a bar of grey segments: a student scanning ten
 * cards is asking "can I get in?", and the answer should be legible before
 * they read a single time.
 */
function statusOf(summary) {
  if (summary.closed) return 'closed'
  if (summary.dayOver) return 'closed'
  if (summary.fullyBooked) return 'full'
  // Half the day still open reads as genuinely available; anything less is
  // worth flagging as tight, so a group knows to book now rather than later.
  return summary.free / Math.max(summary.openTotal, 1) >= 0.4 ? 'open' : 'limited'
}

const STATUS_BADGES = {
  open: { label: 'Available', className: 'bg-brand-600 text-white' },
  limited: { label: 'Limited', className: 'bg-accent-500 text-white' },
  full: { label: 'Fully booked', className: 'bg-rose-500 text-white' },
  closed: { label: 'Closed', className: 'bg-slate-400 text-white' },
}

/** "DR-7" -> "07", so every badge is the same width. */
function roomNumber(name) {
  const digits = name.match(/\d+/)?.[0]
  return digits ? digits.padStart(2, '0') : name.slice(0, 2).toUpperCase()
}

/**
 * Room-first browse view. Each card leads with the room number so the grid is
 * scannable at a glance, and lists the times the room is actually free —
 * which is the thing a student came to find out, and the thing a bar of grey
 * segments could only hint at.
 */
export default function RoomList({
  rooms,
  reservations,
  blocks,
  schedules,
  dayWindow,
  weekday,
  nowMinutes = null,
  graceMinutes = 0,
  dayClosedReason = null,
  loading = false,
  onSelectRoom,
  onPickSlot = null,
}) {
  const slots = useMemo(
    () => buildSlots(dayWindow.startMin, dayWindow.endMin),
    [dayWindow],
  )

  const summaries = useMemo(() => {
    const map = new Map()

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
      const summary = summarise(lane, { slots, nowMinutes, dayClosedReason })

      // "Free now" needs the block containing the current minute, not just
      // any free block later in the day.
      const currentIndex =
        nowMinutes === null
          ? -1
          : slots.findIndex(
              (slot) => nowMinutes >= slot.startMin && nowMinutes < slot.endMin,
            )

      // The free start times themselves, in order, capped so a wide-open
      // room does not turn its card into a timetable.
      const freeStarts = []
      for (let index = 0; index < lane.length; index += 1) {
        if (lane[index].state !== 'free') continue
        freeStarts.push(slots[index].startMin)
        if (freeStarts.length === MAX_SLOT_CHIPS) break
      }

      map.set(room.id, {
        ...summary,
        freeStarts,
        freeNow: currentIndex !== -1 && lane[currentIndex]?.state === 'free',
      })
    }

    return map
  }, [
    rooms,
    schedules,
    blocks,
    reservations,
    slots,
    weekday,
    dayWindow,
    nowMinutes,
    graceMinutes,
    dayClosedReason,
  ])

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="surface h-44 animate-pulse" />
        ))}
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="surface p-10 text-center sm:p-16">
        <p className="text-sm font-semibold text-slate-900">No discussion rooms yet</p>
        <p className="mt-1 text-sm text-slate-500">
          An administrator needs to add rooms before anything can be booked.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      {rooms.map((room) => {
        const summary = summaries.get(room.id)
        if (!summary) return null

        const status = statusOf(summary)
        const badge = STATUS_BADGES[status]
        const unavailable = status === 'closed' || status === 'full'

        return (
          /**
           * The whole card opens the room, but the time chips book directly —
           * so the card cannot be one big <button> with buttons inside it.
           * A stretched overlay button carries the card-level tap instead,
           * and the chips sit above it in the stacking order.
           */
          <div
            key={room.id}
            className={[
              'surface group relative overflow-hidden p-4 sm:p-5',
              summary.closed ? 'opacity-60' : 'surface-hover',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={() => onSelectRoom(room)}
              disabled={summary.closed}
              aria-label={`${room.name}, ${badge.label.toLowerCase()}, ${summary.free} slots free`}
              className="absolute inset-0 z-0 rounded-2xl disabled:pointer-events-none"
            />

            {/* Brand wash that warms on hover */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-brand-500/6 blur-2xl transition-colors duration-300 group-hover:bg-brand-500/14"
            />

            <div className="pointer-events-none relative z-10 flex items-start gap-3.5">
              {/* Room number as the visual anchor */}
              <span
                className={[
                  'tnum grid size-12 shrink-0 place-items-center rounded-xl text-base font-bold transition-colors duration-200',
                  unavailable ? 'bg-slate-100 text-slate-400' : 'bg-brand-700 text-white',
                ].join(' ')}
              >
                {roomNumber(room.name)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${badge.className}`}
                  >
                    {summary.freeNow && (
                      <span className="size-1.5 animate-pulse rounded-full bg-white/90" />
                    )}
                    {badge.label}
                  </span>
                  <p className="truncate text-base font-semibold tracking-tight text-slate-900">
                    {room.name}
                  </p>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3.5" strokeWidth={2} />
                    {room.capacity} seats
                  </span>
                  {room.equipment?.map((item) => {
                    const Icon = EQUIPMENT_ICONS[item]
                    return (
                      <span
                        key={item}
                        title={item}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600"
                      >
                        {Icon && <Icon className="size-3" strokeWidth={2} />}
                        {/* Icon only on a phone: three labelled chips wrapped
                            to a second line and put the height straight back
                            into the card. */}
                        <span className="hidden sm:inline">{item}</span>
                        <span className="sr-only sm:hidden">{item}</span>
                      </span>
                    )
                  })}
                </div>
              </div>

              <ChevronRight
                className="size-4 shrink-0 text-slate-300 transition-all duration-200 ease-in-out group-hover:translate-x-0.5 group-hover:text-brand-500"
                strokeWidth={2.5}
              />
            </div>

            {/* When you can get in. The wrapper stays transparent to taps so
                the card-level overlay button still catches everything that is
                not a chip. */}
            <div className="pointer-events-none relative z-10 mt-4">
              {summary.freeStarts.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.freeStarts.map((startMin) => (
                      <SlotChip
                        key={startMin}
                        startMin={startMin}
                        roomName={room.name}
                        onPick={
                          onPickSlot ? () => onPickSlot(room, startMin) : null
                        }
                      />
                    ))}
                  </div>
                  <p className="pointer-events-none mt-2.5 text-xs text-slate-500">
                    <span className="tnum font-semibold text-slate-900">
                      {summary.free}
                    </span>{' '}
                    of {summary.openTotal} slots free today
                  </p>
                </>
              ) : (
                <p className="pointer-events-none rounded-xl bg-slate-100 px-3 py-2.5 text-center text-xs font-medium text-slate-500">
                  {summary.closed
                    ? 'Closed today'
                    : summary.closedReason === 'past'
                      ? 'This date has passed'
                      : summary.closedReason === 'too-far'
                        ? 'Not open for booking yet'
                        : summary.dayOver
                          ? 'Closed · reopens tomorrow'
                          : 'No available slots today'}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * One free half-hour, as a tappable start time.
 *
 * Tapping it opens the booking form already set to that time — the shortest
 * path there is from "I have a gap at two" to a reservation.
 */
function SlotChip({ startMin, roomName, onPick }) {
  const label = formatTime(startMin)

  if (!onPick) {
    return (
      <span className="tnum pointer-events-none rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-800">
        {label}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Book ${roomName} at ${label}`}
      className="tnum pointer-events-auto rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-800 transition-colors duration-200 hover:border-brand-600 hover:bg-brand-600 hover:text-white"
    >
      {label}
    </button>
  )
}
