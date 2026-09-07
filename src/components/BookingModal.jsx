import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CalendarClock,
  Check,
  Loader2,
  Monitor,
  Users,
  X,
} from 'lucide-react'
import IdPhotoUpload from './IdPhotoUpload'
import { SLOT_MINUTES, formatLongDate, formatTime, fromDateKey } from '../lib/time'
import { MIN_GROUP_SIZE } from '../lib/constants'

/** Name and student number come from the signed-in profile. */
function initialForm(defaults) {
  return {
    studentName: defaults?.studentName ?? '',
    studentId: defaults?.studentId ?? '',
    groupSize: MIN_GROUP_SIZE,
    purpose: '',
  }
}

/**
 * Controlled booking form.
 *
 * App remounts this via `key` per slot, so form state starts fresh on
 * every opening without a reset effect.
 *
 * @param {object|null} slot   { room, dateKey, startMin, maxSpan }
 * @param {boolean}     saving
 * @param {string|null} error  server-side failure, surfaced inline
 */
export default function BookingModal({
  slot,
  saving,
  progress,
  error,
  defaults,
  onClose,
  onConfirm,
}) {
  const [form, setForm] = useState(() => initialForm(defaults))
  const [photos, setPhotos] = useState([])
  const [spanSlots, setSpanSlots] = useState(1)
  const [touched, setTouched] = useState(false)
  const firstFieldRef = useRef(null)

  const open = Boolean(slot)

  // Pull focus to the first field once the panel has mounted.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => firstFieldRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  // Escape to dismiss, and lock background scroll while open.
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

  const durationOptions = useMemo(() => {
    if (!slot) return []
    return [1, 2, 3, 4]
      .filter((count) => count <= slot.maxSpan)
      .map((count) => ({
        count,
        label:
          count % 2 === 0
            ? `${count / 2} hr${count > 2 ? 's' : ''}`
            : `${count * SLOT_MINUTES} min`,
      }))
  }, [slot])

  if (!open) return null

  const { room, dateKey, startMin } = slot
  const endMin = startMin + spanSlots * SLOT_MINUTES

  const groupSize = Number(form.groupSize)
  const validGroup = Number.isFinite(groupSize) && groupSize >= MIN_GROUP_SIZE

  const errors = {
    studentName: form.studentName.trim() ? null : 'Your name is required.',
    studentId: form.studentId.trim() ? null : 'Student number is required.',
    groupSize: !validGroup
      ? `At least ${MIN_GROUP_SIZE} people are needed to reserve a room.`
      : groupSize > room.capacity
        ? `${room.name} seats ${room.capacity}.`
        : null,
    photos:
      photos.length < (validGroup ? groupSize : MIN_GROUP_SIZE)
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
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close booking form"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 animate-pop-in sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200/60 px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-brand-600 uppercase">
              New reservation
            </p>
            <h2
              id="booking-modal-title"
              className="mt-1 truncate text-lg font-semibold text-slate-900"
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

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-5">
            {/* Time summary */}
            <div className="flex items-center gap-3 rounded-xl border border-brand-200/70 bg-brand-50/60 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-brand-600 shadow-sm ring-1 ring-brand-200/60">
                <CalendarClock className="size-4.5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {formatTime(startMin)} – {formatTime(endMin)}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {formatLongDate(fromDateKey(dateKey))}
                </p>
              </div>
            </div>

            {/* Duration */}
            <Field label="Duration">
              <div className="flex flex-wrap gap-2">
                {durationOptions.map(({ count, label }) => {
                  const active = count === spanSlots
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setSpanSlots(count)}
                      className={[
                        'rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-in-out',
                        active
                          ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                          : 'bg-slate-100 text-slate-600 hover:-translate-y-0.5 hover:bg-slate-200 hover:text-slate-900',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {slot.maxSpan < 4 && (
                <p className="mt-2 text-xs text-slate-400">
                  Limited by the next booking on this room.
                </p>
              )}
            </Field>

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
              onChange={setPhotos}
              disabled={saving}
            />
            {showError('photos') && (
              <p className="-mt-3 text-xs font-medium text-rose-600">
                {errors.photos}
              </p>
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

          <footer className="flex items-center justify-end gap-3 border-t border-slate-200/60 bg-slate-50/70 px-6 py-4">
            {saving && progress && (
              <span className="mr-auto text-xs font-medium text-slate-500">
                {progress}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 ease-in-out hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md hover:shadow-brand-600/30 active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
                  Reserving…
                </>
              ) : (
                <>
                  <Check className="size-4" strokeWidth={2.5} />
                  Confirm booking
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

/* ---------- local presentational helpers ---------- */

function Field({ label, hint, error, children }) {
  return (
    <div>
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
    'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm',
    'placeholder:text-slate-400 transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-4',
    hasError
      ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-500/10'
      : 'border-slate-200/80 hover:border-slate-300 focus:border-brand-400 focus:ring-brand-500/10',
  ].join(' ')
}
