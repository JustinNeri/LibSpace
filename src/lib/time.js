/**
 * Single source of truth for the booking day.
 * The grid, the modal and the Supabase queries all derive from these.
 */
export const START_HOUR = 8 // 8:00 AM
export const END_HOUR = 17 // 5:00 PM
export const SLOT_MINUTES = 30

export const DAY_START_MIN = START_HOUR * 60
export const DAY_END_MIN = END_HOUR * 60
export const SLOT_COUNT = (DAY_END_MIN - DAY_START_MIN) / SLOT_MINUTES

/** Minutes-from-midnight -> "8:00 AM" */
export function formatTime(minutes) {
  const h24 = Math.floor(minutes / 60)
  const m = minutes % 60
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** Compact header label — "8" / "8:30" with the meridiem only on the hour. */
export function formatSlotLabel(minutes) {
  const h24 = Math.floor(minutes / 60)
  const m = minutes % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  if (m === 0) return `${h12} ${h24 >= 12 ? 'PM' : 'AM'}`
  return `${h12}:${String(m).padStart(2, '0')}`
}

/** The 18 half-hour columns that make up one bookable day. */
export const SLOTS = Array.from({ length: SLOT_COUNT }, (_, index) => {
  const startMin = DAY_START_MIN + index * SLOT_MINUTES
  return {
    index,
    startMin,
    endMin: startMin + SLOT_MINUTES,
    label: formatSlotLabel(startMin),
    fullLabel: formatTime(startMin),
    isHour: startMin % 60 === 0,
  }
})

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
 * Map a reservation onto grid columns.
 * Returns null when it falls entirely outside the bookable window.
 */
export function reservationToSpan(reservation) {
  const start = new Date(reservation.start_time)
  const end = new Date(reservation.end_time)

  const startMin = Math.max(minutesFromDate(start), DAY_START_MIN)
  const endMin = Math.min(minutesFromDate(end), DAY_END_MIN)
  if (endMin <= startMin) return null

  const startIndex = Math.floor((startMin - DAY_START_MIN) / SLOT_MINUTES)
  const span = Math.max(1, Math.round((endMin - startMin) / SLOT_MINUTES))

  return { startIndex, span, startMin, endMin }
}
