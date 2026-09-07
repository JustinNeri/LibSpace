import { useEffect, useMemo } from 'react'
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CalendarPlus,
  Check,
  Monitor,
  Plug,
  PenLine,
  Users,
} from 'lucide-react'
import {
  buildSlots,
  formatLongDate,
  formatTime,
  fromDateKey,
  parseTimeString,
} from '../lib/time'
import { buildLane, freeSpanAt } from '../lib/availability'

const EQUIPMENT_ICONS = {
  Whiteboard: PenLine,
  Display: Monitor,
  Outlets: Plug,
}

/**
 * A single room's day. The primary path is the "Reserve this room" button,
 * which opens the form where the student sets their own start time and
 * duration. The chips below are a shortcut — tapping one pre-fills that start.
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

  const freeCount = lane.filter((cell) => cell.state === 'free').length

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

          {/* Primary action — the student picks time and duration in the form */}
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
            <div className="py-10 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400">
                <Ban className="size-5" strokeWidth={2} />
              </span>
              <p className="mt-4 text-sm font-medium text-slate-900">
                {room.name} is closed on this day
              </p>
              <p className="mt-1 text-sm text-slate-500">Try another date.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">
                  {freeCount > 0
                    ? `${freeCount} half-hour slot${freeCount === 1 ? '' : 's'} still free — tap one to start there`
                    : 'No free slots left today'}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <Legend className="border-emerald-200 bg-emerald-50">Free</Legend>
                  <Legend className="border-slate-200 bg-slate-100">Booked</Legend>
                  <Legend className="border-amber-200 bg-amber-50">Blocked</Legend>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {slots.map((slot, index) => (
                  <SlotChip
                    key={slot.index}
                    slot={slot}
                    cell={lane[index]}
                    isMine={
                      lane[index].state === 'booked' &&
                      Boolean(currentUserId) &&
                      lane[index].row?.user_id === currentUserId
                    }
                    disabled={freeSpanAt(lane, index) === 0}
                    onClick={() => onReserve(room, slot.startMin)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- pieces ---------- */

function SlotChip({ slot, cell, isMine, disabled, onClick }) {
  const label = `${formatTime(slot.startMin)} – ${formatTime(slot.endMin)}`

  if (cell.state === 'free') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="group flex items-center justify-between gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3.5 py-3 text-left transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 hover:shadow-sm disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="text-sm font-medium text-slate-900">{label}</span>
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-white text-emerald-600 shadow-sm transition-colors duration-200 group-hover:text-brand-600">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      </button>
    )
  }

  const styles = {
    booked: isMine
      ? 'border-brand-200/80 bg-brand-50 text-brand-700'
      : 'border-slate-200/70 bg-slate-100 text-slate-500',
    blocked: 'border-amber-200/80 bg-amber-50 text-amber-700',
    past: 'border-slate-200/50 bg-slate-50 text-slate-400',
    closed: 'border-slate-200/40 bg-slate-50 text-slate-300',
  }

  const note = {
    booked: isMine ? 'Your booking' : 'Booked',
    blocked: cell.row?.reason ?? 'Unavailable',
    past: 'Passed',
    closed: 'Closed',
  }

  return (
    <div
      className={`flex flex-col justify-center rounded-xl border px-3.5 py-3 ${styles[cell.state]}`}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="mt-0.5 truncate text-xs opacity-80">{note[cell.state]}</span>
    </div>
  )
}

function Legend({ className, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-3 rounded border ${className}`} />
      {children}
    </span>
  )
}
