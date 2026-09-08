import { useMemo } from 'react'
import { ArrowUpRight, Monitor, Plug, PenLine, Users } from 'lucide-react'
import { buildSlots, formatTime } from '../lib/time'
import { buildLane, summarise } from '../lib/availability'

const EQUIPMENT_ICONS = {
  Whiteboard: PenLine,
  Display: Monitor,
  Outlets: Plug,
}

const SEGMENT_STYLES = {
  free: 'bg-brand-500',
  pending: 'bg-slate-300',
  booked: 'bg-slate-300',
  blocked: 'bg-amber-300',
  past: 'bg-slate-200',
  closed: 'bg-slate-100',
}

/** "DR-7" -> "07", so every badge is the same width. */
function roomNumber(name) {
  const digits = name.match(/\d+/)?.[0]
  return digits ? digits.padStart(2, '0') : name.slice(0, 2).toUpperCase()
}

/**
 * Room-first browse view. Each card leads with the room number so the grid
 * is scannable at a glance, and carries a bar showing how the day fills up.
 */
export default function RoomList({
  rooms,
  reservations,
  blocks,
  schedules,
  dayWindow,
  weekday,
  nowMinutes = null,
  loading = false,
  onSelectRoom,
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
      })
      const summary = summarise(lane, { slots, nowMinutes })

      // "Free now" needs the block containing the current minute, not just
      // any free block later in the day.
      const currentIndex =
        nowMinutes === null
          ? -1
          : slots.findIndex(
              (slot) => nowMinutes >= slot.startMin && nowMinutes < slot.endMin,
            )

      map.set(room.id, {
        lane,
        ...summary,
        freeNow: currentIndex !== -1 && lane[currentIndex]?.state === 'free',
        nextFree:
          summary.firstFreeIndex === null
            ? null
            : slots[summary.firstFreeIndex].startMin,
      })
    }

    return map
  }, [rooms, schedules, blocks, reservations, slots, weekday, dayWindow, nowMinutes])

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

        const unavailable = summary.closed || summary.dayOver || summary.fullyBooked

        return (
          <button
            key={room.id}
            type="button"
            onClick={() => onSelectRoom(room)}
            disabled={summary.closed}
            aria-label={`${room.name}, ${summary.free} slots free`}
            className="surface surface-hover group relative overflow-hidden p-4 text-left disabled:pointer-events-none disabled:opacity-55 sm:p-5"
          >
            {/* Brand wash that warms on hover */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-brand-500/6 blur-2xl transition-colors duration-300 group-hover:bg-brand-500/14"
            />

            <div className="relative flex items-start gap-3.5">
              {/* Room number as the visual anchor */}
              <span
                className={[
                  'tnum grid size-12 shrink-0 place-items-center rounded-xl text-base font-bold transition-colors duration-200',
                  unavailable
                    ? 'bg-slate-100 text-slate-400'
                    : 'bg-brand-700 text-white',
                ].join(' ')}
              >
                {roomNumber(room.name)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-semibold tracking-tight text-slate-900">
                    {room.name}
                  </p>
                  {summary.freeNow && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-700 uppercase">
                      <span className="size-1.5 animate-pulse rounded-full bg-brand-500" />
                      Now
                    </span>
                  )}
                </div>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-slate-500">
                  <Users className="size-3.5" strokeWidth={2} />
                  Up to {room.capacity} people
                </p>
              </div>

              <ArrowUpRight
                className="size-4 shrink-0 text-slate-300 transition-all duration-200 ease-in-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-500"
                strokeWidth={2.5}
              />
            </div>

            {/* Day at a glance */}
            <div className="relative mt-5">
              <div className="flex gap-[3px]" aria-hidden>
                {summary.lane.map((cell, index) => (
                  <span
                    key={index}
                    title={`${formatTime(slots[index].startMin)} · ${cell.state}`}
                    className={`h-2.5 flex-1 rounded-full ${SEGMENT_STYLES[cell.state]}`}
                  />
                ))}
              </div>

              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                {summary.closed ? (
                  <span className="text-sm font-medium text-slate-400">Closed today</span>
                ) : summary.dayOver ? (
                  <span className="text-sm font-medium text-slate-500">
                    Closed · reopens tomorrow
                  </span>
                ) : summary.fullyBooked ? (
                  <span className="text-sm font-medium text-slate-500">Fully booked</span>
                ) : (
                  <span className="text-sm text-slate-500">
                    <span className="tnum text-base font-bold text-slate-900">
                      {summary.free}
                    </span>{' '}
                    of {summary.openTotal} slots free
                  </span>
                )}

                {!summary.closed && !summary.dayOver && summary.nextFree !== null && !summary.freeNow && (
                  <span className="tnum shrink-0 text-xs font-medium text-slate-400">
                    from {formatTime(summary.nextFree)}
                  </span>
                )}
              </div>
            </div>

            {room.equipment?.length > 0 && (
              <div className="relative mt-4 flex flex-wrap gap-1.5 border-t border-slate-200/70 pt-4">
                {room.equipment.map((item) => {
                  const Icon = EQUIPMENT_ICONS[item]
                  return (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/80 px-2 py-1 text-[11px] font-medium text-slate-600"
                    >
                      {Icon && <Icon className="size-3" strokeWidth={2} />}
                      {item}
                    </span>
                  )
                })}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
