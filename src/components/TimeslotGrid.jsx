import { useMemo } from 'react'
import { Ban, Lock, Plus, Users } from 'lucide-react'
import { SLOT_MINUTES, buildSlots, formatTime } from '../lib/time'
import { buildLane, freeSpanAt } from '../lib/availability'

const ROOM_COL_WIDTH = 260 // px — sticky room rail
const SLOT_MIN_WIDTH = 88 // px — keeps half-hours readable before it scrolls

/**
 * Daily room-by-room availability grid.
 *
 * Rows are rooms, columns are half-hour blocks. Reservations and admin
 * blocks are laid out as spanning cards in the same CSS grid as the empty
 * cells, so a 90-minute booking reads as one card rather than three boxes.
 *
 * Cell states: available · booked · mine · blocked · closed · past
 */
export default function TimeslotGrid({
  rooms,
  reservations,
  blocks,
  schedules,
  dayWindow,
  weekday,
  dateKey,
  nowMinutes = null,
  selectedSlot = null,
  currentUserId = null,
  loading = false,
  onSelectSlot,
}) {
  const slots = useMemo(
    () => buildSlots(dayWindow.startMin, dayWindow.endMin),
    [dayWindow],
  )

  const gridTemplate = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${slots.length}, minmax(${SLOT_MIN_WIDTH}px, 1fr))`,
    }),
    [slots.length],
  )

  /** room id -> per-slot occupancy, so each cell lookup is O(1). */
  const lanes = useMemo(() => {
    const map = new Map()
    for (const room of rooms) {
      map.set(
        room.id,
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
      )
    }
    return map
  }, [rooms, schedules, blocks, reservations, slots, weekday, dayWindow, nowMinutes])

  const availableSpan = (roomId, index) => freeSpanAt(lanes.get(roomId) ?? [], index)

  const nowOffset =
    nowMinutes !== null &&
    nowMinutes >= dayWindow.startMin &&
    nowMinutes <= dayWindow.endMin
      ? ((nowMinutes - dayWindow.startMin) / (dayWindow.endMin - dayWindow.startMin)) * 100
      : null

  if (loading) return <GridSkeleton />

  if (rooms.length === 0) {
    return (
      <EmptyState
        title="No discussion rooms yet"
        body="An administrator needs to add rooms before anything can be booked."
      />
    )
  }

  if (slots.length === 0) {
    return (
      <EmptyState
        title="The library is closed on this day"
        body="Pick another date, or ask an administrator to set opening hours."
      />
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
              {slots.map((slot) => (
                <div
                  key={slot.index}
                  className={[
                    'py-3 pl-3 text-left',
                    slot.isHour
                      ? 'border-l border-slate-200/60'
                      : 'border-l border-slate-100',
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
              lane={lanes.get(room.id)}
              slots={slots}
              gridTemplate={gridTemplate}
              dayWindow={dayWindow}
              dateKey={dateKey}
              nowMinutes={nowMinutes}
              nowOffset={nowOffset}
              selectedSlot={selectedSlot}
              currentUserId={currentUserId}
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
  slots,
  gridTemplate,
  dayWindow,
  dateKey,
  nowMinutes,
  nowOffset,
  selectedSlot,
  currentUserId,
  availableSpan,
  onSelectSlot,
}) {
  // Collapse each run of identical entries into one spanning card.
  const cards = []
  let cursor = 0
  while (cursor < slots.length) {
    const entry = lane?.[cursor]
    if (entry && (entry.state === 'booked' || entry.state === 'blocked')) {
      let span = 1
      while (cursor + span < slots.length && lane[cursor + span] === entry) span += 1
      cards.push({ entry, startIndex: cursor, span })
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
        {slots.map((slot) => {
          const entry = lane?.[slot.index]
          const edge = slot.isHour
            ? 'border-l border-slate-200/60'
            : 'border-l border-slate-100'
          const position = { gridColumn: `${slot.index + 1} / span 1`, gridRow: 1 }

          if (entry?.state === 'closed') {
            return (
              <div
                key={slot.index}
                style={position}
                aria-hidden
                className={`${edge} bg-[repeating-linear-gradient(45deg,var(--color-slate-100)_0px,var(--color-slate-100)_6px,transparent_6px,transparent_12px)]`}
              />
            )
          }

          if (entry && entry.state !== 'free' && entry.state !== 'past') {
            return <div key={slot.index} style={position} className={edge} />
          }

          const isPast = nowMinutes !== null && slot.endMin <= nowMinutes
          const isSelected =
            selectedSlot?.room.id === room.id && selectedSlot?.startMin === slot.startMin

          return (
            <SlotCell
              key={slot.index}
              slot={slot}
              room={room}
              edge={edge}
              position={position}
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

        {/* Spanning cards */}
        {cards.map(({ entry, startIndex, span }) =>
          entry.state === 'blocked' ? (
            <BlockCard
              key={`block-${entry.row.id}`}
              block={entry.row}
              startIndex={startIndex}
              span={span}
              dayWindow={dayWindow}
            />
          ) : (
            <ReservationCard
              key={`res-${entry.row.id}`}
              reservation={entry.row}
              startIndex={startIndex}
              span={span}
              dayWindow={dayWindow}
              isMine={Boolean(currentUserId) && entry.row.user_id === currentUserId}
            />
          ),
        )}

        {/* Current-time indicator */}
        {nowOffset !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-20 w-px bg-rose-400/70"
            style={{ left: `${nowOffset}%` }}
          >
            <span className="absolute -top-1 -left-[3px] size-[7px] rounded-full bg-rose-500 ring-2 ring-white" />
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Cells ---------------- */

function SlotCell({ slot, room, edge, position, isPast, isSelected, onClick }) {
  if (isPast) {
    return <div style={position} className={`${edge} bg-slate-50/70`} aria-hidden />
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Book ${room.name} at ${slot.fullLabel}`}
      style={position}
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

function ReservationCard({ reservation, startIndex, span, dayWindow, isMine }) {
  const start = formatTime(dayWindow.startMin + startIndex * SLOT_MINUTES)
  const end = formatTime(dayWindow.startMin + (startIndex + span) * SLOT_MINUTES)

  return (
    <div
      style={{ gridColumn: `${startIndex + 1} / span ${span}`, gridRow: 1 }}
      title={`${reservation.student_name} · ${start} – ${end}`}
      className={[
        'z-10 m-1 flex min-w-0 flex-col justify-center overflow-hidden rounded-xl border px-3 py-2 transition-all duration-200 ease-in-out',
        isMine
          ? 'border-brand-300/70 bg-brand-100/70 hover:border-brand-400/70 hover:bg-brand-100'
          : 'border-slate-200/70 bg-slate-100/80 hover:border-slate-300/70 hover:bg-slate-100',
      ].join(' ')}
    >
      <p
        className={[
          'truncate text-xs font-semibold',
          isMine ? 'text-brand-800' : 'text-slate-700',
        ].join(' ')}
      >
        {isMine ? 'You' : reservation.student_name}
      </p>
      <p
        className={[
          'mt-0.5 truncate text-[11px]',
          isMine ? 'text-brand-600' : 'text-slate-500',
        ].join(' ')}
      >
        {start} – {end}
        {reservation.group_size ? ` · ${reservation.group_size} pax` : ''}
      </p>
    </div>
  )
}

function BlockCard({ block, startIndex, span, dayWindow }) {
  const start = formatTime(dayWindow.startMin + startIndex * SLOT_MINUTES)
  const end = formatTime(dayWindow.startMin + (startIndex + span) * SLOT_MINUTES)

  return (
    <div
      style={{ gridColumn: `${startIndex + 1} / span ${span}`, gridRow: 1 }}
      title={`${block.reason} · ${start} – ${end}`}
      className="z-10 m-1 flex min-w-0 items-center gap-2 overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2"
    >
      <Ban className="size-3.5 shrink-0 text-amber-600" strokeWidth={2} />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-amber-800">{block.reason}</p>
        <p className="mt-0.5 truncate text-[11px] text-amber-600">
          {start} – {end}
        </p>
      </div>
    </div>
  )
}

/* ---------------- States ---------------- */

function EmptyState({ title, body }) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-16 text-center shadow-sm">
      <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400">
        <Lock className="size-5" strokeWidth={2} />
      </span>
      <p className="mt-4 text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  )
}

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
