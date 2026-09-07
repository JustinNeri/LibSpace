import { MAX_BOOKING_SLOTS, parseTimeString, rangeToSpan } from './time'

/**
 * Availability for one room on one day.
 *
 * Every view needs the same answer — which half-hour blocks are free, and
 * why the others are not — so the rule lives here rather than in each
 * component.
 *
 * States, in the order they are applied (later wins):
 *   closed   outside the admin's opening hours for this weekday
 *   past     already elapsed (only when viewing today)
 *   blocked  an admin block
 *   pending  a request awaiting staff approval
 *   booked   an approved reservation
 *   free     bookable
 *
 * @returns {Array<{state: string, row?: object}>} one entry per slot
 */
export function buildLane({
  room,
  slots,
  schedules,
  blocks = [],
  reservations = [],
  weekday,
  dayWindow,
  nowMinutes = null,
}) {
  const schedule = schedules.find(
    (row) => row.room_id === room.id && row.weekday === weekday,
  )
  const opens = schedule ? parseTimeString(schedule.opens_at) : null
  const closes = schedule ? parseTimeString(schedule.closes_at) : null

  const lane = slots.map((slot) => {
    if (!schedule || slot.startMin < opens || slot.endMin > closes) {
      return { state: 'closed' }
    }
    if (nowMinutes !== null && slot.endMin <= nowMinutes) return { state: 'past' }
    return { state: 'free' }
  })

  const occupy = (rows, state) => {
    for (const row of rows) {
      if (row.room_id !== room.id) continue
      const placement = rangeToSpan(
        row.start_time,
        row.end_time,
        dayWindow.startMin,
        dayWindow.endMin,
      )
      if (!placement) continue

      // One shared cell object across the run, so consumers can collapse
      // adjacent slots into a single card by reference equality.
      const cell = { state, row }

      for (let i = placement.startIndex; i < placement.startIndex + placement.span; i += 1) {
        // Closed hours stay closed — a stale block must not make a shut
        // room look merely unavailable.
        if (i >= 0 && i < lane.length && lane[i].state !== 'closed') {
          lane[i] = cell
        }
      }
    }
  }

  occupy(blocks, 'blocked')
  // Pending requests hold the slot, but read differently to the student:
  // the room is spoken for, not yet confirmed.
  occupy(
    reservations.filter((row) => row.status === 'pending'),
    'pending',
  )
  occupy(
    reservations.filter((row) => row.status !== 'pending'),
    'booked',
  )

  return lane
}

/** Free consecutive slots from `index`, capped at the booking limit. */
export function freeSpanAt(lane, index) {
  let span = 0
  while (
    span < MAX_BOOKING_SLOTS &&
    index + span < lane.length &&
    lane[index + span].state === 'free'
  ) {
    span += 1
  }
  return span
}

/**
 * Every time a booking could start, with how long it could run.
 * Drives the start-time and duration pickers.
 *
 * @returns {Array<{index: number, startMin: number, maxSpan: number}>}
 */
export function startOptions(lane, slots) {
  const options = []
  for (let index = 0; index < lane.length; index += 1) {
    if (lane[index].state !== 'free') continue
    options.push({
      index,
      startMin: slots[index].startMin,
      maxSpan: freeSpanAt(lane, index),
    })
  }
  return options
}

/** Day-level counts for a room card. */
export function summarise(lane) {
  const free = lane.filter((cell) => cell.state === 'free').length
  const openTotal = lane.filter((cell) => cell.state !== 'closed').length
  const firstFree = lane.findIndex((cell) => cell.state === 'free')

  return {
    free,
    openTotal,
    closed: openTotal === 0,
    fullyBooked: openTotal > 0 && free === 0,
    firstFreeIndex: firstFree === -1 ? null : firstFree,
  }
}
