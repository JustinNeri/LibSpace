import { useMemo } from 'react'
import { Plus, Users } from 'lucide-react'
import {
  DAY_END_MIN,
  DAY_START_MIN,
  SLOT_COUNT,
  SLOT_MINUTES,
  SLOTS,
  formatTime,
  reservationToSpan,
} from '../lib/time'

const ROOM_COL_WIDTH = 260 // px — sticky room rail
const SLOT_MIN_WIDTH = 88 // px — keeps half-hours readable before it scrolls
const MAX_BOOKING_SLOTS = 4 // 2 hours

const gridTemplate = {
  gridTemplateColumns: `repeat(${SLOT_COUNT}, minmax(${SLOT_MIN_WIDTH}px, 1fr))`,
}

/**
 * Daily room-by-room availability grid.
 *
 * Rows are rooms, columns are half-hour blocks. Reservations are laid out
 * as spanning blocks in the same CSS grid as the empty cells, so a 90-minute
 * booking reads as one card rather than three adjacent boxes.
 *
 * @param {Array}  rooms
 * @param {Array}  reservations  active reservations for `dateKey`
 * @param {string} dateKey       "YYYY-MM-DD"
 * @param {number|null} nowMinutes  minutes-from-midnight, only when viewing today
 */
export default function TimeslotGrid({
  rooms,
  reservations,
  dateKey,
  nowMinutes = null,
  selectedSlot = null,
  loading = false,
  onSelectSlot,
}) {
  /**
   * room id -> array of SLOT_COUNT entries, each the occupying reservation
   * or null. Built once per data change so each cell lookup is O(1).
   */
  const occupancy = useMemo(() => {
    const map = new Map(rooms.map((room) => [room.id, Array(SLOT_COUNT).fill(null)]))

    for (const reservation of reservations) {
      const lane = map.get(reservation.room_id)
      if (!lane) continue

      const placement = reservationToSpan(reservation)
      if (!placement) continue

      for (let i = placement.startIndex; i < placement.startIndex + placement.span; i += 1) {
        if (i >= 0 && i < SLOT_COUNT) lane[i] = reservation
      }
    }

    return map
  }, [rooms, reservations])

  /** Free consecutive slots starting at `index`, capped at MAX_BOOKING_SLOTS. */
  const availableSpan = (roomId, index) => {
    const lane = occupancy.get(roomId)
    let span = 0
    while (
      span < MAX_BOOKING_SLOTS &&
      index + span < SLOT_COUNT &&
      lane?.[index + span] === null
    ) {
      span += 1
    }
    return span
  }

  const nowOffset =
    nowMinutes !== null && nowMinutes >= DAY_START_MIN && nowMinutes <= DAY_END_MIN
      ? ((nowMinutes - DAY_START_MIN) / (DAY_END_MIN - DAY_START_MIN)) * 100
      : null

  if (loading) return <GridSkeleton />

  if (rooms.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white p-16 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-900">No discussion rooms yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Add rooms in Supabase and they will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <div className="overflow-x-auto scrollbar-slim">
        <div className="min-w-max">
          {/* ---------- Time axis ---------- */}
          <div className="sticky top-0 z-30 flex border-b border-slate-200/60 bg-white/85 backdrop-blur-md">
            <div
              className="sticky left-0 z-10 flex shrink-0 items-center border-r border-slate-200/60 bg-white/95 px-5 py-3 backdrop-blur-md"
              style={{ width: ROOM_COL_WIDTH }}
            >
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Room
              </span>
            </div>

            <div className="grid" style={gridTemplate}>
              {SLOTS.map((slot) => (
                <div
                  key={slot.index}
                  className={[
                    'py-3 pl-3 text-left',
                    slot.isHour ? 'border-l border-slate-200/60' : 'border-l border-slate-100',
                  ].join(' ')}
                >
                  <span
                    className={
                      slot.isHour
                        ? 'text-xs font-semibold text-slate-700'
                        : 'text-xs font-medium text-slate-400'
                    }
                  >
                    {slot.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ---------- Room rows ---------- */}
          {rooms.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              lane={occupancy.get(room.id)}
              dateKey={dateKey}
              nowMinutes={nowMinutes}
              nowOffset={nowOffset}
              selectedSlot={selectedSlot}
              availableSpan={availableSpan}
              onSelectSlot={onSelectSlot}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Room row ---------------- */

function RoomRow({
  room,
  lane,
  dateKey,
  nowMinutes,
  nowOffset,
  selectedSlot,
  availableSpan,
  onSelectSlot,
}) {
  // Render each reservation once, at the column where it starts.
  const blocks = []
  let cursor = 0
  while (cursor < SLOT_COUNT) {
    const reservation = lane?.[cursor]
    if (reservation) {
      let span = 1
      while (cursor + span < SLOT_COUNT && lane[cursor + span] === reservation) span += 1
      blocks.push({ reservation, startIndex: cursor, span })
      cursor += span
    } else {
      cursor += 1
    }
  }

  return (
    <div className="group/row flex border-b border-slate-200/60 last:border-b-0">
      {/* Sticky room rail */}
      <div
        className="sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r border-slate-200/60 bg-white px-5 py-4 transition-colors duration-200 group-hover/row:bg-slate-50/60"
        style={{ width: ROOM_COL_WIDTH }}
      >
        <p className="truncate text-sm font-semibold text-slate-900">{room.name}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Users className="size-3.5" strokeWidth={2} />
            {room.capacity}
          </span>
          {room.equipment?.slice(0, 2).map((item) => (
            <span
              key={item}
              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500"
            >
              {item}
            </span>
          ))}
          {room.equipment?.length > 2 && (
            <span className="text-[11px] font-medium text-slate-400">
              +{room.equipment.length - 2}
            </span>
          )}
        </div>
      </div>

      {/* Slot lane */}
      <div className="relative grid h-20" style={gridTemplate}>
        {/* Empty / past cells */}
        {SLOTS.map((slot) => {
          if (lane?.[slot.index]) {
            return (
              <div
                key={slot.index}
                style={{ gridColumn: `${slot.index + 1} / span 1`, gridRow: 1 }}
                className={
                  slot.isHour ? 'border-l border-slate-200/60' : 'border-l border-slate-100'
                }
              />
            )
          }

          const isPast = nowMinutes !== null && slot.endMin <= nowMinutes
          const isSelected =
            selectedSlot?.room.id === room.id && selectedSlot?.startMin === slot.startMin

          return (
            <SlotCell
              key={slot.index}
              slot={slot}
              room={room}
              isPast={isPast}
              isSelected={isSelected}
              onClick={() =>
                onSelectSlot({
                  room,
                  dateKey,
                  startMin: slot.startMin,
                  maxSpan: availableSpan(room.id, slot.index),
                })
              }
            />
          )
        })}

        {/* Booked blocks */}
        {blocks.map(({ reservation, startIndex, span }) => (
          <ReservationBlock
            key={reservation.id}
            reservation={reservation}
            startIndex={startIndex}
            span={span}
          />
        ))}

        {/* Current-time indicator */}
        {nowOffset !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-20 w-px bg-rose-400/70"
            style={{ left: `${nowOffset}%`, gridRow: 1 }}
          >
            <span className="absolute -top-1 -left-[3px] size-[7px] rounded-full bg-rose-500 ring-2 ring-white" />
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Cells ---------------- */

function SlotCell({ slot, room, isPast, isSelected, onClick }) {
  const edge = slot.isHour ? 'border-l border-slate-200/60' : 'border-l border-slate-100'

  if (isPast) {
    return (
      <div
        style={{ gridColumn: `${slot.index + 1} / span 1`, gridRow: 1 }}
        className={`${edge} bg-slate-50/70`}
        aria-hidden
      />
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Book ${room.name} at ${slot.fullLabel}`}
      style={{ gridColumn: `${slot.index + 1} / span 1`, gridRow: 1 }}
      className={[
        edge,
        'group/slot relative flex items-center justify-center transition-all duration-200 ease-in-out',
        isSelected
          ? 'bg-brand-50 ring-2 ring-brand-500 ring-inset'
          : 'hover:bg-brand-50/70 hover:ring-2 hover:ring-brand-400/40 hover:ring-inset',
      ].join(' ')}
    >
      <span
        className={[
          'grid size-7 place-items-center rounded-lg text-brand-600 transition-all duration-200 ease-in-out',
          isSelected
            ? 'bg-white opacity-100 shadow-sm'
            : 'opacity-0 group-hover/slot:-translate-y-0.5 group-hover/slot:bg-white group-hover/slot:opacity-100 group-hover/slot:shadow-sm',
        ].join(' ')}
      >
        <Plus className="size-4" strokeWidth={2.5} />
      </span>
    </button>
  )
}

function ReservationBlock({ reservation, startIndex, span }) {
  const start = formatTime(DAY_START_MIN + startIndex * SLOT_MINUTES)
  const end = formatTime(DAY_START_MIN + (startIndex + span) * SLOT_MINUTES)

  return (
    <div
      style={{ gridColumn: `${startIndex + 1} / span ${span}`, gridRow: 1 }}
      className="z-10 m-1 flex min-w-0 flex-col justify-center overflow-hidden rounded-xl border border-slate-200/70 bg-slate-100/80 px-3 py-2 transition-all duration-200 ease-in-out hover:border-slate-300/70 hover:bg-slate-100"
      title={`${reservation.student_name} · ${start} – ${end}`}
    >
      <p className="truncate text-xs font-semibold text-slate-700">
        {reservation.student_name}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-slate-500">
        {start} – {end}
        {reservation.group_size ? ` · ${reservation.group_size} pax` : ''}
      </p>
    </div>
  )
}

/* ---------------- Loading state ---------------- */

function GridSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <div className="border-b border-slate-200/60 px-5 py-3.5">
        <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
      </div>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-slate-200/60 px-5 py-6 last:border-b-0"
        >
          <div className="h-4 w-40 shrink-0 animate-pulse rounded-full bg-slate-200" />
          <div className="h-9 flex-1 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-9 w-1/4 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ))}
    </div>
  )
}
