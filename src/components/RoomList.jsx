import { useMemo } from 'react'
import { Ban, ChevronRight, Monitor, Plug, PenLine, Users } from 'lucide-react'
import { buildSlots, formatTime, parseTimeString, rangeToSpan } from '../lib/time'

const EQUIPMENT_ICONS = {
  Whiteboard: PenLine,
  Display: Monitor,
  Outlets: Plug,
}

const SEGMENT_STYLES = {
  free: 'bg-emerald-400',
  booked: 'bg-slate-300',
  blocked: 'bg-amber-300',
  past: 'bg-slate-200',
  closed: 'bg-slate-100',
}

/**
 * Room-first browse view: every discussion room as a card with a bar showing
 * how the day is filling up. Selecting one opens its schedule.
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

  /** room id -> { lane, free, openTotal, nextFree, ... } for the chosen day. */
  const summaries = useMemo(() => {
    const map = new Map()

    for (const room of rooms) {
      const schedule = schedules.find(
        (row) => row.room_id === room.id && row.weekday === weekday,
      )
      const opens = schedule ? parseTimeString(schedule.opens_at) : null
      const closes = schedule ? parseTimeString(schedule.closes_at) : null

      const lane = slots.map((slot) => {
        if (!schedule || slot.startMin < opens || slot.endMin > closes) return 'closed'
        if (nowMinutes !== null && slot.endMin <= nowMinutes) return 'past'
        return 'free'
      })

      const occupy = (rows, label) => {
        for (const row of rows) {
          if (row.room_id !== room.id) continue
          const placement = rangeToSpan(
            row.start_time,
            row.end_time,
            dayWindow.startMin,
            dayWindow.endMin,
          )
          if (!placement) continue
          for (
            let i = placement.startIndex;
            i < placement.startIndex + placement.span;
            i += 1
          ) {
            if (i >= 0 && i < lane.length && lane[i] !== 'closed') lane[i] = label
          }
        }
      }

      occupy(blocks, 'blocked')
      occupy(reservations, 'booked')

      const free = lane.filter((state) => state === 'free').length
      const openTotal = lane.filter((state) => state !== 'closed').length
      const firstFree = lane.findIndex((state) => state === 'free')

      map.set(room.id, {
        lane,
        free,
        openTotal,
        closed: openTotal === 0,
        fullyBooked: openTotal > 0 && free === 0,
        nextFree: firstFree === -1 ? null : slots[firstFree].startMin,
      })
    }

    return map
  }, [rooms, schedules, blocks, reservations, slots, weekday, dayWindow, nowMinutes])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-48 animate-pulse rounded-2xl border border-slate-200/60 bg-white"
          />
        ))}
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white p-16 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-900">No discussion rooms yet</p>
        <p className="mt-1 text-sm text-slate-500">
          An administrator needs to add rooms before anything can be booked.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => {
        const summary = summaries.get(room.id)
        if (!summary) return null

        const status = summary.closed
          ? { label: 'Closed today', tone: 'closed' }
          : summary.fullyBooked
            ? { label: 'Fully booked', tone: 'full' }
            : { label: `${summary.free} of ${summary.openTotal} slots free`, tone: 'open' }

        return (
          <button
            key={room.id}
            type="button"
            onClick={() => onSelectRoom(room)}
            disabled={summary.closed}
            aria-label={`${room.name} — ${status.label}`}
            className="group flex flex-col rounded-2xl border border-slate-200/60 bg-white p-5 text-left shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-brand-300/70 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight text-slate-900">
                  {room.name}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
                  <Users className="size-3.5" strokeWidth={2} />
                  Seats up to {room.capacity}
                </p>
              </div>
              <ChevronRight
                className="mt-1 size-4 shrink-0 text-slate-300 transition-all duration-200 ease-in-out group-hover:translate-x-0.5 group-hover:text-brand-500"
                strokeWidth={2.5}
              />
            </div>

            {/* One segment per half-hour block, so the day reads at a glance */}
            <div className="mt-4 flex gap-0.5" aria-hidden>
              {summary.lane.map((state, index) => (
                <span
                  key={index}
                  title={`${formatTime(slots[index].startMin)} · ${state}`}
                  className={`h-1.5 flex-1 rounded-full ${SEGMENT_STYLES[state]}`}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill tone={status.tone}>{status.label}</StatusPill>
              {status.tone === 'open' && summary.nextFree !== null && (
                <span className="text-xs text-slate-500">
                  next free {formatTime(summary.nextFree)}
                </span>
              )}
            </div>

            {room.equipment?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-200/60 pt-4">
                {room.equipment.map((item) => {
                  const Icon = EQUIPMENT_ICONS[item]
                  return (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
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

function StatusPill({ tone, children }) {
  const styles = {
    open: 'bg-emerald-50 text-emerald-700',
    full: 'bg-slate-100 text-slate-600',
    closed: 'bg-slate-100 text-slate-500',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}
    >
      {tone === 'closed' && <Ban className="size-3" strokeWidth={2.5} />}
      {children}
    </span>
  )
}
