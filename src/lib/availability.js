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
 *   past     elapsed, or too far into the grace period to still claim
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
  graceMinutes = 0,
  dayClosedReason = null,
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
    // A day nobody can book into has no free slots, whatever the clock says:
    // `nowMinutes` is null for any day that is not today, so without this a
    // date in the past reads as wide open.
    if (dayClosedReason !== null) return { state: 'past' }

    // A slot stops being bookable once the grace period into it has gone.
    // release_no_shows() sweeps any approved booking whose start is more than
    // `no_show_grace_minutes` old with nobody checked in, so offering a start
    // past that point hands the student a booking the next sweep deletes.
    if (
      nowMinutes !== null &&
      (slot.endMin <= nowMinutes || slot.startMin + graceMinutes < nowMinutes)
    ) {
      return { state: 'past' }
    }
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

/**
 * Day-level counts for a room card.
 *
 * Pass `slots` and `nowMinutes` to get the room's own opening hours back as
 * well. Without them the time-of-day flags stay false, which keeps older
 * callers working but means a shut room reads as merely full.
 *
 * "No free slots" has three quite different causes and the caller has to be
 * able to tell them apart:
 *   closed       the room has no hours on this weekday at all
 *   dayOver      booking is shut: the evening came, the date has passed, or
 *                it is further ahead than the library opens booking for
 *                (`closedReason` says which)
 *   fullyBooked  it is open, and every remaining slot is taken
 */
export function summarise(
  lane,
  { slots = null, nowMinutes = null, dayClosedReason = null } = {},
) {
  const free = lane.filter((cell) => cell.state === 'free').length
  const openTotal = lane.filter((cell) => cell.state !== 'closed').length
  const firstFree = lane.findIndex((cell) => cell.state === 'free')
  const closed = openTotal === 0

  // Read the room's hours back off the lane — everything the schedule did
  // not cover is already marked closed, so the first and last open slots are
  // the opening and closing times.
  let opensMin = null
  let closesMin = null
  if (slots && !closed) {
    const firstOpen = lane.findIndex((cell) => cell.state !== 'closed')
    let lastOpen = firstOpen
    for (let i = lane.length - 1; i > firstOpen; i -= 1) {
      if (lane[i].state !== 'closed') {
        lastOpen = i
        break
      }
    }
    opensMin = slots[firstOpen].startMin
    closesMin = slots[lastOpen].endMin
  }

  const dayOver =
    dayClosedReason !== null ||
    (closesMin !== null && nowMinutes !== null && nowMinutes >= closesMin)
  const notYetOpen = opensMin !== null && nowMinutes !== null && nowMinutes < opensMin

  return {
    free,
    openTotal,
    opensMin,
    closesMin,
    closed,
    dayOver,
    // Why booking is shut: 'past', 'too-far', or null for "the evening came".
    closedReason: dayClosedReason,
    notYetOpen,
    fullyBooked: !closed && !dayOver && free === 0,
    firstFreeIndex: firstFree === -1 ? null : firstFree,
  }
}
