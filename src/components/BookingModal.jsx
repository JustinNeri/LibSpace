import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CalendarClock,
  Check,
  Clock,
  Loader2,
  Monitor,
  Users,
  X,
} from 'lucide-react'
import IdPhotoUpload from './IdPhotoUpload'
import { SLOT_MINUTES, formatLongDate, formatTime, fromDateKey } from '../lib/time'
import { MIN_GROUP_SIZE } from '../lib/constants'

function initialForm(defaults) {
  return {
    studentName: defaults?.studentName ?? '',
    studentId: defaults?.studentId ?? '',
    groupSize: MIN_GROUP_SIZE,
    purpose: '',
  }
}

/**
 * Controlled booking form. The student picks the start time and how long
 * they need; both are constrained to what the room actually has free.
 *
 * App remounts this via `key` per opening, so state starts fresh without a
 * reset effect.
 *
 * @param {object|null} booking  { room, dateKey, startMin } — startMin may be
 *                               null when opened from the "Reserve" button
 * @param {Array} startOptions   [{ startMin, maxSpan }] the room's free starts
 */
export default function BookingModal({
  booking,
  startOptions = [],
  asAdmin = false,
  saving,
  progress,
  error,
  defaults,
  onClose,
  onConfirm,
}) {
  const [form, setForm] = useState(() => initialForm(defaults))
  const [photos, setPhotos] = useState([])
  const [startMin, setStartMin] = useState(
    () => booking?.startMin ?? startOptions[0]?.startMin ?? null,
  )
  const [spanSlots, setSpanSlots] = useState(1)
  const [touched, setTouched] = useState(false)
  const firstFieldRef = useRef(null)

  const open = Boolean(booking)

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => firstFieldRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, saving, onClose])

  /** How far the chosen start can run before hitting something. */
  const maxSpan = useMemo(
    () => startOptions.find((option) => option.startMin === startMin)?.maxSpan ?? 0,
    [startOptions, startMin],
  )

  // Shorten the duration if the chosen start cannot support it.
  useEffect(() => {
    if (maxSpan > 0 && spanSlots > maxSpan) setSpanSlots(maxSpan)
  }, [maxSpan, spanSlots])

  const durationOptions = useMemo(
    () =>
      [1, 2, 3, 4]
        .filter((count) => count <= maxSpan)
        .map((count) => ({
          count,
          label:
            count % 2 === 0
              ? `${count / 2} hour${count > 2 ? 's' : ''}`
              : `${count * SLOT_MINUTES} minutes`,
        })),
    [maxSpan],
  )

  if (!open) return null

  const { room, dateKey } = booking
  const endMin = startMin === null ? null : startMin + spanSlots * SLOT_MINUTES

  const groupSize = Number(form.groupSize)
  const validGroup = Number.isFinite(groupSize) && groupSize >= MIN_GROUP_SIZE

  const errors = {
    startMin: startMin === null ? 'Choose a start time.' : null,
    studentName: form.studentName.trim() ? null : 'Your name is required.',
    studentId: form.studentId.trim() ? null : 'Student number is required.',
    groupSize: !validGroup
      ? `At least ${MIN_GROUP_SIZE} people are needed to reserve a room.`
      : groupSize > room.capacity
        ? `${room.name} seats ${room.capacity}.`
        : null,
    // Staff have the IDs in hand at the desk, so photos are optional there.
    photos:
      !asAdmin && photos.length < (validGroup ? groupSize : MIN_GROUP_SIZE)
        ? 'Add one ID photo for every member.'
        : null,
  }
  const isValid = Object.values(errors).every((message) => message === null)

  const setField = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    setTouched(true)
    if (!isValid || saving) return

    onConfirm({
      room,
      dateKey,
      startMin,
      endMin,
      studentName: form.studentName.trim(),
      studentId: form.studentId.trim(),
      groupSize,
      purpose: form.purpose.trim(),
      photos,
    })
  }

  const showError = (key) => (touched ? errors[key] : null)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close booking form"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-900/5 animate-sheet-up sm:max-h-[88vh] sm:rounded-2xl sm:animate-pop-in"
      >
        {/* Grab handle - the sheet reads as draggable even though tapping
            the backdrop is what closes it. */}
        <span
          aria-hidden
          className="mx-auto mt-2.5 block h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden"
        />

        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200/60 px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.14em] text-brand-700 uppercase">
              {asAdmin ? 'Walk-in · confirmed on save' : 'New reservation'}
            </p>
            <h2
              id="booking-modal-title"
              className="font-display mt-1 truncate text-lg font-semibold text-slate-900"
            >
              {room.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" strokeWidth={2} />
                Seats {room.capacity}
              </span>
              {room.equipment?.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Monitor className="size-3.5" strokeWidth={2} />
                  {room.equipment.join(' · ')}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="-mt-1.5 -mr-1.5 rounded-lg p-2 text-slate-400 transition-all duration-200 ease-in-out hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="size-4.5" strokeWidth={2} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 scrollbar-slim sm:px-6">
            {/* When */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="size-4 text-slate-400" strokeWidth={2} />
                <p className="text-sm font-semibold text-slate-900">
                  When do you need it?
                </p>
              </div>

              {startOptions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  This room has no free time left on{' '}
                  {formatLongDate(fromDateKey(dateKey))}.
                </p>
              ) : (
                <>
                  <Field label="Start time" error={showError('startMin')}>
                    <select
                      value={startMin ?? ''}
                      onChange={(event) => setStartMin(Number(event.target.value))}
                      className={inputClass(showError('startMin'))}
                    >
                      <option value="" disabled>
                        Select a start time…
                      </option>
                      {startOptions.map((option) => (
                        <option key={option.startMin} value={option.startMin}>
                          {formatTime(option.startMin)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Duration" className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      {durationOptions.map(({ count, label }) => {
                        const active = count === spanSlots
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setSpanSlots(count)}
                            className={[
                              'flex-1 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors duration-200 sm:flex-none',
                              active
                                ? 'bg-brand-700 text-white'
                                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-900',
                            ].join(' ')}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    {maxSpan > 0 && maxSpan < 4 && (
                      <p className="mt-2 text-xs text-slate-400">
                        Capped at {maxSpan * SLOT_MINUTES} minutes — the room is taken
                        after that.
                      </p>
                    )}
                  </Field>

                  {endMin !== null && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-brand-200 bg-white px-3.5 py-3">
                      <CalendarClock
                        className="size-4 shrink-0 text-brand-600"
                        strokeWidth={2}
                      />
                      <p className="min-w-0 truncate text-sm">
                        <span className="font-semibold text-slate-900">
                          {formatTime(startMin)} – {formatTime(endMin)}
                        </span>
                        <span className="text-slate-500">
                          {' '}
                          · {formatLongDate(fromDateKey(dateKey))}
                        </span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={showError('studentName')}>
                <input
                  ref={firstFieldRef}
                  type="text"
                  value={form.studentName}
                  onChange={setField('studentName')}
                  placeholder="Dela Cruz, Juan M."
                  autoComplete="name"
                  className={inputClass(showError('studentName'))}
                />
              </Field>

              <Field label="Student number" error={showError('studentId')}>
                <input
                  type="text"
                  value={form.studentId}
                  onChange={setField('studentId')}
                  placeholder="2024-00123"
                  className={inputClass(showError('studentId'))}
                />
              </Field>
            </div>

            <Field label="Group size" error={showError('groupSize')}>
              <input
                type="number"
                min={MIN_GROUP_SIZE}
                max={room.capacity}
                value={form.groupSize}
                onChange={setField('groupSize')}
                className={`${inputClass(showError('groupSize'))} max-w-32`}
              />
              <p className="mt-2 text-xs text-slate-400">
                {MIN_GROUP_SIZE} to {room.capacity} people. The library requires at least{' '}
                {MIN_GROUP_SIZE} to reserve a discussion room.
              </p>
            </Field>

            <IdPhotoUpload
              photos={photos}
              required={validGroup ? groupSize : MIN_GROUP_SIZE}
              optional={asAdmin}
              onChange={setPhotos}
              disabled={saving}
            />
            {showError('photos') && (
              <p className="-mt-3 text-xs font-medium text-rose-600">{errors.photos}</p>
            )}

            <Field label="Purpose" hint="Optional">
              <textarea
                rows={2}
                value={form.purpose}
                onChange={setField('purpose')}
                placeholder="Thesis consultation, group report, review session…"
                className={`${inputClass(null)} resize-none`}
              />
            </Field>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200/70 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                <p>{error}</p>
              </div>
            )}
          </div>

          <footer className="pb-safe shrink-0 border-t border-slate-200/60 bg-slate-50/70 px-5 py-4 sm:px-6">
            {saving && progress && (
              <p className="mb-3 text-xs font-medium text-slate-500">{progress}</p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-40 sm:py-2.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || startOptions.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3.5 text-sm font-bold tracking-wide text-white transition-colors duration-200 hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-60 sm:py-2.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
                    Reserving…
                  </>
                ) : (
                  <>
                    <Check className="size-4" strokeWidth={2.5} />
                    {asAdmin ? 'Log walk-in' : 'Confirm booking'}
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  )
}

/* ---------- local presentational helpers ---------- */

function Field({ label, hint, error, className = '', children }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  )
}

function inputClass(hasError) {
  return [
    'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900',
    'placeholder:text-slate-400 transition-colors duration-200',
    'focus:outline-none focus:ring-2',
    hasError
      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/15'
      : 'border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-brand-600/15',
  ].join(' ')
}
