import { useMemo } from 'react'
import { CalendarCheck, DoorOpen, Hourglass } from 'lucide-react'
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
  currentUserId = null,
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
      })
      freeSlots += summarise(lane).free
      if (currentIndex !== -1 && lane[currentIndex]?.state === 'free') freeNow += 1
    }

    const awaiting = currentUserId
      ? reservations.filter(
          (row) => row.user_id === currentUserId && row.status === 'pending',
        ).length
      : 0

    return { freeNow, freeSlots, awaiting, roomCount: rooms.length }
  }, [
    rooms,
    reservations,
    blocks,
    schedules,
    dayWindow,
    weekday,
    nowMinutes,
    currentUserId,
  ])

  if (loading || rooms.length === 0) return null

  return (
    <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
      <Stat
        icon={DoorOpen}
        tone="emerald"
        value={nowMinutes === null ? '—' : stats.freeNow}
        suffix={nowMinutes === null ? '' : ` of ${stats.roomCount}`}
        label={nowMinutes === null ? 'Not today' : 'Free right now'}
      />
      <Stat
        icon={CalendarCheck}
        tone="brand"
        value={stats.freeSlots}
        label="Open half-hour slots"
      />
      <Stat
        icon={Hourglass}
        tone="amber"
        value={stats.awaiting}
        label={stats.awaiting === 1 ? 'Request awaiting staff' : 'Requests awaiting staff'}
      />
    </div>
  )
}

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-600',
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
