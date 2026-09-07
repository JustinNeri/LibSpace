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
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
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

function Stat({ icon: Icon, tone, value, suffix = '', label }) {
  return (
    <div className="surface flex items-center gap-3.5 px-4 py-3.5">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}>
        <Icon className="size-4.5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="tnum text-xl font-bold tracking-tight text-slate-900">
          {value}
          <span className="text-sm font-medium text-slate-400">{suffix}</span>
        </p>
        <p className="truncate text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}
