/**
 * Slot maths for the booking day.
 *
 * The visible window is no longer a constant: admins set opening hours per
 * room per weekday, so the grid derives its window from those schedules and
 * falls back to the defaults below when none exist.
 */
export const DEFAULT_START_MIN = 8 * 60 // 8:00 AM
export const DEFAULT_END_MIN = 17 * 60 // 5:00 PM
export const SLOT_MINUTES = 30
export const MAX_BOOKING_SLOTS = 4 // 2 hours

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

/** Minutes-from-midnight -> "8:00 AM" */
export function formatTime(minutes) {
  const h24 = Math.floor(minutes / 60)
  const m = minutes % 60
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** Compact header label — "8 AM" on the hour, "8:30" otherwise. */
export function formatSlotLabel(minutes) {
  const h24 = Math.floor(minutes / 60)
  const m = minutes % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  if (m === 0) return `${h12} ${h24 >= 12 ? 'PM' : 'AM'}`
  return `${h12}:${String(m).padStart(2, '0')}`
}

/** Postgres `time` ("08:00:00") -> minutes from midnight. */
export function parseTimeString(value) {
  if (!value) return null
  const [h, m] = value.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Minutes from midnight -> "08:00" for a Postgres `time` column. */
export function toTimeString(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

/** Round down to the containing slot boundary. */
export function floorToSlot(minutes) {
  return Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES
}

/** Round up to the next slot boundary. */
export function ceilToSlot(minutes) {
  return Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES
}

/**
 * Build the half-hour columns for a window.
 * @returns {Array<{index,startMin,endMin,label,fullLabel,isHour}>}
 */
export function buildSlots(startMin, endMin) {
  const count = Math.max(0, Math.round((endMin - startMin) / SLOT_MINUTES))
  return Array.from({ length: count }, (_, index) => {
    const slotStart = startMin + index * SLOT_MINUTES
    return {
      index,
      startMin: slotStart,
      endMin: slotStart + SLOT_MINUTES,
      label: formatSlotLabel(slotStart),
      fullLabel: formatTime(slotStart),
      isHour: slotStart % 60 === 0,
    }
  })
}

/**
 * Widest window covering every room open on `weekday`, snapped to slot
 * boundaries. Returns the defaults when nothing is scheduled.
 */
export function windowForWeekday(schedules, weekday) {
  const open = schedules.filter((row) => row.weekday === weekday)
  if (open.length === 0) {
    return { startMin: DEFAULT_START_MIN, endMin: DEFAULT_END_MIN, hasSchedule: false }
  }

  const starts = open.map((row) => parseTimeString(row.opens_at))
  const ends = open.map((row) => parseTimeString(row.closes_at))

  return {
    startMin: floorToSlot(Math.min(...starts)),
    endMin: ceilToSlot(Math.max(...ends)),
    hasSchedule: true,
  }
}

/* ---------------------------------------------------------------- dates */

/** Date -> "YYYY-MM-DD" in local time (avoids the toISOString UTC shift). */
export function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "YYYY-MM-DD" -> local Date at midnight. */
export function fromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Combine a date key and minutes-from-midnight into a local Date. */
export function dateAtMinutes(dateKey, minutes) {
  const base = fromDateKey(dateKey)
  base.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return base
}

/** Local Date -> minutes from midnight. */
export function minutesFromDate(date) {
  return date.getHours() * 60 + date.getMinutes()
}

export function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function formatLongDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function isSameDay(a, b) {
  return toDateKey(a) === toDateKey(b)
}

/**
 * Map a time range onto grid columns within `window`.
 * Returns null when it falls entirely outside the visible window.
 */
export function rangeToSpan(startISO, endISO, windowStartMin, windowEndMin) {
  const start = new Date(startISO)
  const end = new Date(endISO)

  const startMin = Math.max(minutesFromDate(start), windowStartMin)
  const endMin = Math.min(minutesFromDate(end), windowEndMin)
  if (endMin <= startMin) return null

  const startIndex = Math.floor((startMin - windowStartMin) / SLOT_MINUTES)
  const span = Math.max(1, Math.round((endMin - startMin) / SLOT_MINUTES))

  return { startIndex, span, startMin, endMin }
}
