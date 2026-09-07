import { useEffect, useMemo, useState } from 'react'
import {
  Ban,
  CalendarClock,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useSettings } from '../hooks/useSettings'
import {
  WEEKDAY_NAMES,
  dateAtMinutes,
  formatTime,
  parseTimeString,
  toTimeString,
} from '../lib/time'

const TABS = [
  { id: 'rooms', label: 'Rooms' },
  { id: 'schedule', label: 'Opening hours' },
  { id: 'blocks', label: 'Blocked time' },
  { id: 'rules', label: 'Booking rules' },
]

/**
 * Staff-only management surface. Everything here is guarded a second time
 * by RLS (`public.is_admin()`), so a forged client cannot write.
 */
export default function AdminPanel({ rooms, schedules, blocks, dateKey, onChanged }) {
  const [tab, setTab] = useState('rooms')

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <div className="flex items-center gap-1 border-b border-slate-200/60 px-3 py-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              'rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-in-out',
              tab === item.id
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === 'rooms' && <RoomsTab rooms={rooms} onChanged={onChanged} />}
        {tab === 'schedule' && (
          <ScheduleTab rooms={rooms} schedules={schedules} onChanged={onChanged} />
        )}
        {tab === 'blocks' && (
          <BlocksTab
            rooms={rooms}
            blocks={blocks}
            dateKey={dateKey}
            onChanged={onChanged}
          />
        )}
        {tab === 'rules' && <RulesTab />}
      </div>
    </section>
  )
}

/* ============================ Rooms ============================ */

const BLANK_ROOM = { name: '', capacity: 6, equipment: '' }

function RoomsTab({ rooms, onChanged }) {
  const [draft, setDraft] = useState(BLANK_ROOM)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const reset = () => {
    setDraft(BLANK_ROOM)
    setEditingId(null)
    setError(null)
  }

  const save = async (event) => {
    event.preventDefault()
    setError(null)

    if (!draft.name.trim()) {
      setError('Room name is required.')
      return
    }

    const payload = {
      name: draft.name.trim(),
      capacity: Number(draft.capacity) || 1,
      equipment: draft.equipment
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    }

    setBusy(true)
    const { error: saveError } = editingId
      ? await supabase.from('rooms').update(payload).eq('id', editingId)
      : await supabase.from('rooms').insert(payload)
    setBusy(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    reset()
    onChanged()
  }

  const remove = async (room) => {
    setBusy(true)
    // Soft delete — hard deletion would cascade away historical bookings.
    const { error: removeError } = await supabase
      .from('rooms')
      .update({ is_active: false })
      .eq('id', room.id)
    setBusy(false)

    if (removeError) setError(removeError.message)
    else onChanged()
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-2">
        {rooms.length === 0 && (
          <p className="text-sm text-slate-500">No rooms yet. Add the first one.</p>
        )}

        {rooms.map((room) => (
          <div
            key={room.id}
            className="flex items-center gap-4 rounded-xl border border-slate-200/60 bg-white px-4 py-3 transition-all duration-200 ease-in-out hover:border-slate-300/70 hover:shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{room.name}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                Seats {room.capacity}
                {room.equipment?.length > 0 && ` · ${room.equipment.join(', ')}`}
              </p>
            </div>

            <button
              type="button"
              aria-label={`Edit ${room.name}`}
              onClick={() => {
                setEditingId(room.id)
                setDraft({
                  name: room.name,
                  capacity: room.capacity,
                  equipment: (room.equipment ?? []).join(', '),
                })
              }}
              className="rounded-lg p-2 text-slate-400 transition-all duration-200 ease-in-out hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="size-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              aria-label={`Retire ${room.name}`}
              onClick={() => remove(room)}
              className="rounded-lg p-2 text-slate-400 transition-all duration-200 ease-in-out hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="size-4" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={save}
        className="h-fit rounded-xl border border-slate-200/60 bg-slate-50/60 p-5"
      >
        <p className="text-sm font-semibold text-slate-900">
          {editingId ? 'Edit room' : 'Add a room'}
        </p>

        <label className="mt-4 block text-xs font-medium text-slate-600">Name</label>
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder="DR-204 · Group Study"
          className={fieldClass}
        />

        <label className="mt-3 block text-xs font-medium text-slate-600">Capacity</label>
        <input
          type="number"
          min={1}
          value={draft.capacity}
          onChange={(event) => setDraft({ ...draft, capacity: event.target.value })}
          className={fieldClass}
        />

        <label className="mt-3 block text-xs font-medium text-slate-600">
          Equipment <span className="text-slate-400">(comma separated)</span>
        </label>
        <input
          value={draft.equipment}
          onChange={(event) => setDraft({ ...draft, equipment: event.target.value })}
          placeholder="Whiteboard, Display, Outlets"
          className={fieldClass}
        />

        {error && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <PrimaryButton busy={busy}>
            {editingId ? <Check className="size-4" strokeWidth={2.5} /> : <Plus className="size-4" strokeWidth={2.5} />}
            {editingId ? 'Save changes' : 'Add room'}
          </PrimaryButton>
          {editingId && (
            <button
              type="button"
              onClick={reset}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-all duration-200 ease-in-out hover:bg-slate-200/70 hover:text-slate-900"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

/* ========================== Opening hours ========================== */

function ScheduleTab({ rooms, schedules, onChanged }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? null)
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!roomId && rooms[0]) setRoomId(rooms[0].id)
  }, [rooms, roomId])

  // Rebuild the 7-day editor whenever the room or stored schedule changes.
  useEffect(() => {
    setRows(
      WEEKDAY_NAMES.map((_, weekday) => {
        const existing = schedules.find(
          (row) => row.room_id === roomId && row.weekday === weekday,
        )
        return {
          weekday,
          isOpen: Boolean(existing),
          opensAt: existing ? toTimeString(parseTimeString(existing.opens_at)) : '08:00',
          closesAt: existing ? toTimeString(parseTimeString(existing.closes_at)) : '17:00',
        }
      }),
    )
    setSaved(false)
  }, [roomId, schedules])

  const update = (weekday, patch) =>
    setRows((current) =>
      current.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)),
    )

  const save = async () => {
    setError(null)
    setBusy(true)

    const invalid = rows.find((row) => row.isOpen && row.closesAt <= row.opensAt)
    if (invalid) {
      setBusy(false)
      setError(`${WEEKDAY_NAMES[invalid.weekday]} closes before it opens.`)
      return
    }

    // Replace the room's week wholesale — simpler than diffing, and the
    // table is tiny.
    const { error: deleteError } = await supabase
      .from('room_schedules')
      .delete()
      .eq('room_id', roomId)

    if (deleteError) {
      setBusy(false)
      setError(deleteError.message)
      return
    }

    const open = rows.filter((row) => row.isOpen)
    if (open.length > 0) {
      const { error: insertError } = await supabase.from('room_schedules').insert(
        open.map((row) => ({
          room_id: roomId,
          weekday: row.weekday,
          opens_at: row.opensAt,
          closes_at: row.closesAt,
        })),
      )

      if (insertError) {
        setBusy(false)
        setError(insertError.message)
        return
      }
    }

    setBusy(false)
    setSaved(true)
    onChanged()
  }

  if (rooms.length === 0) {
    return <p className="text-sm text-slate-500">Add a room first.</p>
  }

  return (
    <div className="max-w-2xl">
      <label className="block text-xs font-medium text-slate-600">Room</label>
      <select
        value={roomId ?? ''}
        onChange={(event) => setRoomId(event.target.value)}
        className={`${fieldClass} max-w-sm`}
      >
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name}
          </option>
        ))}
      </select>

      <div className="mt-6 space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.weekday}
            className={[
              'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-200 ease-in-out',
              row.isOpen
                ? 'border-slate-200/60 bg-white'
                : 'border-slate-200/40 bg-slate-50/60',
            ].join(' ')}
          >
            <label className="flex w-40 shrink-0 items-center gap-2.5">
              <input
                type="checkbox"
                checked={row.isOpen}
                onChange={(event) => update(row.weekday, { isOpen: event.target.checked })}
                className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
              />
              <span
                className={[
                  'text-sm font-medium',
                  row.isOpen ? 'text-slate-900' : 'text-slate-400',
                ].join(' ')}
              >
                {WEEKDAY_NAMES[row.weekday]}
              </span>
            </label>

            {row.isOpen ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  step={1800}
                  value={row.opensAt}
                  onChange={(event) => update(row.weekday, { opensAt: event.target.value })}
                  className={timeFieldClass}
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="time"
                  step={1800}
                  value={row.closesAt}
                  onChange={(event) => update(row.weekday, { closesAt: event.target.value })}
                  className={timeFieldClass}
                />
              </div>
            ) : (
              <span className="text-sm text-slate-400">Closed</span>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-xs font-medium text-rose-600">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <PrimaryButton busy={busy} onClick={save} type="button">
          <Check className="size-4" strokeWidth={2.5} />
          Save opening hours
        </PrimaryButton>
        {saved && !busy && (
          <span className="text-xs font-medium text-emerald-600">Saved</span>
        )}
      </div>
    </div>
  )
}

/* ========================== Blocked time ========================== */

function BlocksTab({ rooms, blocks, dateKey, onChanged }) {
  const [draft, setDraft] = useState({
    roomId: rooms[0]?.id ?? '',
    startsAt: '12:00',
    endsAt: '13:00',
    reason: 'Maintenance',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const roomName = useMemo(
    () => Object.fromEntries(rooms.map((room) => [room.id, room.name])),
    [rooms],
  )

  const add = async (event) => {
    event.preventDefault()
    setError(null)

    if (!draft.roomId) {
      setError('Pick a room.')
      return
    }
    if (draft.endsAt <= draft.startsAt) {
      setError('The end time must be after the start time.')
      return
    }

    setBusy(true)
    const { error: insertError } = await supabase.from('room_blocks').insert({
      room_id: draft.roomId,
      start_time: dateAtMinutes(dateKey, parseTimeString(draft.startsAt)).toISOString(),
      end_time: dateAtMinutes(dateKey, parseTimeString(draft.endsAt)).toISOString(),
      reason: draft.reason.trim() || 'Unavailable',
    })
    setBusy(false)

    if (insertError) setError(insertError.message)
    else onChanged()
  }

  const remove = async (id) => {
    const { error: removeError } = await supabase.from('room_blocks').delete().eq('id', id)
    if (removeError) setError(removeError.message)
    else onChanged()
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
          Blocked on {dateKey}
        </p>

        {blocks.length === 0 && (
          <p className="pt-2 text-sm text-slate-500">Nothing blocked on this date.</p>
        )}

        {blocks.map((block) => (
          <div
            key={block.id}
            className="flex items-center gap-3 rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-3"
          >
            <Ban className="size-4 shrink-0 text-amber-600" strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-amber-900">
                {block.reason}
              </p>
              <p className="mt-0.5 truncate text-xs text-amber-700">
                {roomName[block.room_id] ?? 'Unknown room'} ·{' '}
                {formatTime(
                  new Date(block.start_time).getHours() * 60 +
                    new Date(block.start_time).getMinutes(),
                )}{' '}
                –{' '}
                {formatTime(
                  new Date(block.end_time).getHours() * 60 +
                    new Date(block.end_time).getMinutes(),
                )}
              </p>
            </div>
            <button
              type="button"
              aria-label="Remove block"
              onClick={() => remove(block.id)}
              className="rounded-lg p-2 text-amber-600 transition-all duration-200 ease-in-out hover:bg-amber-100 hover:text-amber-800"
            >
              <X className="size-4" strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={add}
        className="h-fit rounded-xl border border-slate-200/60 bg-slate-50/60 p-5"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarClock className="size-4 text-slate-400" strokeWidth={2} />
          Block time on {dateKey}
        </p>

        <label className="mt-4 block text-xs font-medium text-slate-600">Room</label>
        <select
          value={draft.roomId}
          onChange={(event) => setDraft({ ...draft, roomId: event.target.value })}
          className={fieldClass}
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">From</label>
            <input
              type="time"
              step={1800}
              value={draft.startsAt}
              onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">To</label>
            <input
              type="time"
              step={1800}
              value={draft.endsAt}
              onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
              className={fieldClass}
            />
          </div>
        </div>

        <label className="mt-3 block text-xs font-medium text-slate-600">Reason</label>
        <input
          value={draft.reason}
          onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
          placeholder="Maintenance"
          className={fieldClass}
        />

        {error && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}

        <div className="mt-4">
          <PrimaryButton busy={busy}>
            <Plus className="size-4" strokeWidth={2.5} />
            Add block
          </PrimaryButton>
        </div>
      </form>
    </div>
  )
}

/* ========================== Booking rules ========================== */

const RULE_FIELDS = [
  {
    key: 'max_active_bookings',
    label: 'Active bookings per student',
    hint: 'How many upcoming reservations one student may hold at once.',
    min: 1,
    max: 20,
    step: 1,
  },
  {
    key: 'max_hours_per_day',
    label: 'Hours per student per day',
    hint: 'Total room time one student may book across a single day.',
    min: 0.5,
    max: 24,
    step: 0.5,
  },
  {
    key: 'advance_days',
    label: 'Booking opens (days ahead)',
    hint: 'How far into the future students may reserve.',
    min: 1,
    max: 180,
    step: 1,
  },
  {
    key: 'no_show_grace_minutes',
    label: 'No-show grace (minutes)',
    hint: 'After this long without a check-in, the room is released automatically.',
    min: 0,
    max: 120,
    step: 5,
  },
]

function RulesTab() {
  const { rules, loading, save } = useSettings()
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  // Fill the form once the stored rules arrive.
  useEffect(() => {
    if (!loading) setDraft((current) => current ?? { ...rules })
  }, [loading, rules])

  if (loading || !draft) {
    return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)

    const { error: saveError } = await save({
      max_active_bookings: Number(draft.max_active_bookings),
      max_hours_per_day: Number(draft.max_hours_per_day),
      advance_days: Number(draft.advance_days),
      no_show_grace_minutes: Number(draft.no_show_grace_minutes),
    })

    setBusy(false)
    if (saveError) setError(saveError.message)
    else setSaved(true)
  }

  return (
    <form onSubmit={submit} className="max-w-xl">
      <p className="text-sm text-slate-500">
        These limits are enforced by the database, so they hold no matter what a
        browser sends.
      </p>

      <div className="mt-5 space-y-4">
        {RULE_FIELDS.map((field) => (
          <div key={field.key} className="rounded-xl border border-slate-200/60 p-4">
            <label className="text-sm font-medium text-slate-900">{field.label}</label>
            <p className="mt-0.5 text-xs text-slate-500">{field.hint}</p>
            <input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={draft[field.key]}
              onChange={(event) =>
                setDraft({ ...draft, [field.key]: event.target.value })
              }
              className={`${fieldClass} max-w-32`}
            />
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-xs font-medium text-rose-600">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <PrimaryButton busy={busy}>
          <Check className="size-4" strokeWidth={2.5} />
          Save rules
        </PrimaryButton>
        {saved && !busy && (
          <span className="text-xs font-medium text-emerald-600">Saved</span>
        )}
      </div>
    </form>
  )
}

/* ============================ shared ============================ */

const fieldClass =
  'mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 ease-in-out placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 focus:outline-none'

const timeFieldClass =
  'rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm transition-all duration-200 ease-in-out hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 focus:outline-none'

function PrimaryButton({ busy, children, type = 'submit', onClick }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md hover:shadow-brand-600/30 active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-4 animate-spin" strokeWidth={2.5} /> : children}
    </button>
  )
}
