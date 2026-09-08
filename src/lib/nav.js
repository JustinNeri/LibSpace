import {
  CalendarRange,
  ClipboardList,
  DoorOpen,
  History,
  Inbox,
  Settings2,
  SlidersHorizontal,
  Ticket,
} from 'lucide-react'

/**
 * The one place a view is named. The desktop rail and the phone tab bar both
 * render from this, so a view can never appear in one and go missing in the
 * other.
 *
 * `label` is what the rail shows, `short` is what fits under a 64px-wide tab
 * on a phone. Order matters: the first four are the phone's fixed tabs and
 * everything after them lands in the "More" sheet.
 */
export function navItems(isAdmin) {
  if (isAdmin) {
    return [
      { key: 'rooms', label: 'Rooms', short: 'Rooms', Icon: DoorOpen },
      { key: 'grid', label: 'Timetable', short: 'Times', Icon: CalendarRange },
      { key: 'desk', label: 'Front desk', short: 'Desk', Icon: Ticket },
      { key: 'requests', label: 'Requests', short: 'Requests', Icon: Inbox },
      { key: 'mine', label: 'All bookings', short: 'Bookings', Icon: ClipboardList },
      { key: 'history', label: 'History', short: 'History', Icon: History },
      { key: 'admin', label: 'Manage rooms', short: 'Manage', Icon: SlidersHorizontal },
      { key: 'settings', label: 'Account', short: 'Account', Icon: Settings2 },
    ]
  }

  return [
    { key: 'rooms', label: 'Rooms', short: 'Rooms', Icon: DoorOpen },
    { key: 'grid', label: 'Timetable', short: 'Times', Icon: CalendarRange },
    { key: 'mine', label: 'My bookings', short: 'Bookings', Icon: ClipboardList },
    { key: 'settings', label: 'Account', short: 'Account', Icon: Settings2 },
  ]
}

/* ------------------------------------------------------- view memory */

/**
 * Which view a browser tab was last on.
 *
 * `sessionStorage`, not `localStorage`: it survives a reload and a restored
 * tab, but a new tab starts on the rooms list instead of inheriting wherever
 * another tab happened to be. Every access is guarded — Safari's private mode
 * throws on the first read rather than returning null.
 */
const VIEW_KEY = 'libspace:view'

export function restoreView(isAdmin) {
  try {
    const saved = sessionStorage.getItem(VIEW_KEY)
    // The stored view has to be one this user can actually open: staff views
    // linger in a tab that later signs in as a student, and landing on an
    // admin screen you cannot use is worse than landing on the rooms.
    if (saved && navItems(isAdmin).some((item) => item.key === saved)) return saved
  } catch {
    // Storage disabled — fall through to the default.
  }
  return 'rooms'
}

export function rememberView(view) {
  try {
    sessionStorage.setItem(VIEW_KEY, view)
  } catch {
    // Not being able to remember the view is not worth breaking navigation.
  }
}

/**
 * Forget it, so the next person to use this tab starts at the rooms list.
 *
 * Signing out has to do this. Without it the view outlives the session: sign
 * out from Account, register a new account in the same tab, and the workspace
 * opens on Account — someone else's last position, restored for you.
 */
export function forgetView() {
  try {
    sessionStorage.removeItem(VIEW_KEY)
  } catch {
    // Nothing stored, nothing to clear.
  }
}

/** Views that are about a particular day, and so want the date strip. */
export const DATED_VIEWS = ['rooms', 'grid', 'desk']

/** Page title and one-line explanation, per view. */
export function viewCopy(view, { isAdmin, roomName = null, slotMinutes = 30 }) {
  switch (view) {
    case 'rooms':
      return roomName
        ? { title: roomName, blurb: 'Pick a free time to reserve this room.' }
        : {
            title: 'Discussion rooms',
            blurb: 'Find a room for your next study session — tap a free time to book it.',
          }
    case 'grid':
      return {
        title: 'Room availability',
        blurb: `Pick any open ${slotMinutes}-minute block to reserve a discussion room.`,
      }
    case 'mine':
      return isAdmin
        ? {
            title: 'All upcoming bookings',
            blurb: 'Every active reservation across the library.',
          }
        : {
            title: 'My bookings',
            blurb: 'Track approval and cancel anything you no longer need.',
          }
    case 'requests':
      return {
        title: 'Reservation requests',
        blurb:
          'Check the student IDs, then approve or decline. The student is notified either way.',
      }
    case 'desk':
      return {
        title: 'Front desk',
        blurb:
          'Check groups in when they arrive and out when they leave. Rooms nobody claims are released automatically.',
      }
    case 'history':
      return {
        title: 'Usage history',
        blurb: 'Every reservation and what became of it. Filter, search and export.',
      }
    case 'settings':
      return {
        title: 'Account settings',
        blurb: 'Update your details or change your password.',
      }
    case 'admin':
      return {
        title: 'Manage rooms',
        blurb: 'Add rooms, set weekly opening hours, and block time for maintenance.',
      }
    default:
      return { title: 'LibSpace', blurb: '' }
  }
}

/**
 * The name to greet someone by.
 *
 * Profiles store "Dela Cruz, Juan M." plus separate parts, and neither is
 * guaranteed to be filled in yet, so this walks from the most personal thing
 * available down to the email local part.
 */
export function firstNameOf(profile, user) {
  return (
    profile?.first_name?.trim() ||
    profile?.full_name?.split(',')[1]?.trim().split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there'
  )
}

/** "Dela Cruz, Juan M." -> "DJ". Falls back to the email local part. */
export function initialsFor(profile, user) {
  return (profile?.full_name || user?.email || '?')
    .split(/[\s@.,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}
