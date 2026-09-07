import { useEffect, useMemo } from 'react'
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Monitor,
  Plug,
  PenLine,
  Sunrise,
  Sun,
  Users,
} from 'lucide-react'
import {
  SLOT_MINUTES,
  buildSlots,
  formatClock,
  formatLongDate,
  formatTime,
  fromDateKey,
  parseTimeString,
} from '../lib/time'
import { buildLane } from '../lib/availability'

const EQUIPMENT_ICONS = {
  Whiteboard: PenLine,
  Display: Monitor,
  Outlets: Plug,
}

const NOON = 12 * 60

/**
 * A single room's day.
 *
 * Only free start times are shown as tappable pills, grouped into morning and
 * afternoon. What is already taken is summarised as a short list of merged
 * ranges rather than one box per half-hour — a student is deciding when they
 * can come, so that is the only thing worth making loud.
 */
export default function RoomSchedule({
  room,
  reservations,
  blocks,
  schedules,
  dayWindow,
  weekday,
  dateKey,
  nowMinutes = null,
  currentUserId = null,
  onBack,
  onReserve,
}) {
  const slots = useMemo(
    () => buildSlots(dayWindow.startMin, dayWindow.endMin),
    [dayWindow],
  )

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onBack])

  const schedule = schedules.find(
    (row) => row.room_id === room.id && row.weekday === weekday,
  )
  const opens = schedule ? parseTimeString(schedule.opens_at) : null
  const closes = schedule ? parseTimeString(schedule.closes_at) : null

  const lane = useMemo(
    () =>
      buildLane({
        room,
        slots,
        schedules,
        blocks,
        reservations,
        weekday,
        dayWindow,
        nowMinutes,
      }),
    [room, slots, schedules, blocks, reservations, weekday, dayWindow, nowMinutes],
  )

  /** Free starts split by half of the day, plus merged unavailable ranges. */
  const { morning, afternoon, taken, freeCount } = useMemo(() => {
    const free = []
    for (let i = 0; i < lane.length; i += 1) {
      if (lane[i].state === 'free') free.push(slots[i].startMin)
    }

    // Collapse consecutive slots sharing a cell into one range.
    const ranges = []
    let i = 0
    while (i < lane.length) {
      const cell = lane[i]
      if (cell.state === 'booked' || cell.state === 'blocked') {
        let span = 1
        while (i + span < lane.length && lane[i + span] === cell) span += 1
        ranges.push({
          cell,
          startMin: slots[i].startMin,
          endMin: slots[i].startMin + span * SLOT_MINUTES,
        })
        i += span
      } else {
        i += 1
      }
    }

    return {
      morning: free.filter((min) => min < NOON),
      afternoon: free.filter((min) => min >= NOON),
      taken: ranges,
      freeCount: free.length,
    }
  }, [lane, slots])

  return (
    <div className="animate-slide-up">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-all duration-200 ease-in-out hover:-translate-x-0.5 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" strokeWidth={2.5} />
        All rooms
      </button>

      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
        {/* Room identity */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              {room.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" strokeWidth={2} />
                Seats up to {room.capacity}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" strokeWidth={2} />
                {formatLongDate(fromDateKey(dateKey))}
              </span>
              {schedule && (
                <span>
                  Open {formatTime(opens)} – {formatTime(closes)}
                </span>
              )}
            </div>

            {room.equipment?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {room.equipment.map((item) => {
                  const Icon = EQUIPMENT_ICONS[item]
                  return (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600"
                    >
                      {Icon && <Icon className="size-3.5" strokeWidth={2} />}
                      {item}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onReserve(room, null)}
            disabled={freeCount === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md hover:shadow-brand-600/30 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
          >
            <CalendarPlus className="size-4" strokeWidth={2.5} />
            {freeCount === 0 ? 'No time left today' : 'Reserve this room'}
          </button>
        </div>

        <div className="mt-6 border-t border-slate-200/60 pt-6">
          {!schedule ? (
            <Closed name={room.name} />
          ) : freeCount === 0 ? (
            <FullyBooked taken={taken} currentUserId={currentUserId} />
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900">
                {freeCount} free start {freeCount === 1 ? 'time' : 'times'}
                <span className="font-normal text-slate-500">
                  {' '}
                  · tap one, or use Reserve to pick any time
                </span>
              </p>

              <PillGroup
                icon={Sunrise}
                label="Morning"
                times={morning}
                onPick={(startMin) => onReserve(room, startMin)}
              />
              <PillGroup
                icon={Sun}
                label="Afternoon"
                times={afternoon}
                onPick={(startMin) => onReserve(room, startMin)}
              />

              {taken.length > 0 && (
                <TakenList taken={taken} currentUserId={currentUserId} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- pieces ---------------- */

function PillGroup({ icon: Icon, label, times, onPick }) {
  if (times.length === 0) return null

  return (
    <div className="mt-5">
      <p className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
        <Icon className="size-3.5" strokeWidth={2} />
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {times.map((startMin) => (
          <button
            key={startMin}
            type="button"
            onClick={() => onPick(startMin)}
            className="min-w-18 rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-2.5 text-sm font-semibold text-emerald-800 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-600 hover:text-white hover:shadow-md hover:shadow-brand-600/25"
          >
            {formatClock(startMin)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Merged ranges of what is already taken — quiet, informational only. */
function TakenList({ taken, currentUserId }) {
  return (
    <div className="mt-6 border-t border-slate-200/60 pt-5">
      <p className="mb-2.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
        Not available
      </p>
      <ul className="space-y-1.5">
        {taken.map((range) => {
          const isMine =
            range.cell.state === 'booked' &&
            Boolean(currentUserId) &&
            range.cell.row?.user_id === currentUserId

          return (
            <li
              key={`${range.startMin}-${range.cell.state}`}
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"
            >
              <span
                className={[
                  'size-1.5 shrink-0 rounded-full',
                  range.cell.state === 'blocked' ? 'bg-amber-400' : 'bg-slate-300',
                ].join(' ')}
              />
              <span className="font-medium text-slate-600">
                {formatTime(range.startMin)} – {formatTime(range.endMin)}
              </span>
              <span
                className={[
                  'text-xs',
                  isMine ? 'font-semibold text-brand-600' : 'text-slate-400',
                ].join(' ')}
              >
                {range.cell.state === 'blocked'
                  ? (range.cell.row?.reason ?? 'Unavailable')
                  : isMine
                    ? 'Your booking'
                    : 'Booked'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FullyBooked({ taken, currentUserId }) {
  return (
    <div>
      <div className="py-6 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400">
          <CheckCircle2 className="size-5" strokeWidth={2} />
        </span>
        <p className="mt-4 text-sm font-medium text-slate-900">
          No free time left today
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Try another room, or move to the next day.
        </p>
      </div>
      {taken.length > 0 && <TakenList taken={taken} currentUserId={currentUserId} />}
    </div>
  )
}

function Closed({ name }) {
  return (
    <div className="py-10 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400">
        <Ban className="size-5" strokeWidth={2} />
      </span>
      <p className="mt-4 text-sm font-medium text-slate-900">
        {name} is closed on this day
      </p>
      <p className="mt-1 text-sm text-slate-500">Try another date.</p>
    </div>
  )
}
