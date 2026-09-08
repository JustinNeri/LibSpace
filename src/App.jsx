import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import AdminPanel from './components/AdminPanel'
import ApprovalQueue from './components/ApprovalQueue'
import BottomNav from './components/BottomNav'
import DaySummary from './components/DaySummary'
import HomeGreeting from './components/HomeGreeting'
import DayStrip from './components/DayStrip'
import DeskView from './components/DeskView'
import HistoryView from './components/HistoryView'
import ProfileSettings from './components/ProfileSettings'
import RoomFilters from './components/RoomFilters'
import SideNav from './components/SideNav'
import { EMPTY_FILTERS, filterRooms } from './lib/roomFilters'
import AppHeader from './components/AppHeader'
import AuthGate from './components/AuthGate'
import BookingModal from './components/BookingModal'
import MyReservations from './components/MyReservations'
import RoomList from './components/RoomList'
import RoomSchedule from './components/RoomSchedule'
import AccountSetup from './components/AccountSetup'
import TimeslotGrid from './components/TimeslotGrid'
import Toast from './components/Toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useReservations } from './hooks/useReservations'
import { useSettings } from './hooks/useSettings'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { DATED_VIEWS, rememberView, restoreView, viewCopy } from './lib/nav'
import {
  SLOT_MINUTES,
  addDays,
  buildSlots,
  formatTime,
  isSameDay,
  minutesFromDate,
  toDateKey,
} from './lib/time'
import { buildLane, startOptions as freeStarts } from './lib/availability'

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  )
}

/** Auth state decides which of the three screens is mounted. */
function Routes() {
  const { loading, isAuthenticated, needsSetup } = useAuth()

  if (!isSupabaseConfigured) return <ConfigError />
  if (loading) return <FullPageSpinner />
  if (!isAuthenticated) return <AuthGate />
  if (needsSetup) return <AccountSetup />
  return <Workspace />
}

/* ---------------------------------------------------------------- app */

function Workspace() {
  const { user, profile, isAdmin } = useAuth()
  const { rules } = useSettings()

  // How long after a start time a booking can still be claimed before the
  // no-show sweep takes it back. Staff set this in Manage rooms.
  const graceMinutes = rules?.no_show_grace_minutes ?? 0

  const [date, setDate] = useState(() => new Date())
  const [view, setView] = useState(() => restoreView(isAdmin))
  const [openRoom, setOpenRoom] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [booking, setBooking] = useState(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [now, setNow] = useState(() => new Date())

  const dateKey = toDateKey(date)
  const {
    rooms,
    schedules,
    blocks,
    reservations,
    dayWindow,
    weekday,
    loading,
    loadError,
    refresh,
    createReservation,
  } = useReservations(dateKey)

  // Move the "now" indicator on the minute, not every second.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const nowMinutes = isSameDay(date, now) ? minutesFromDate(now) : null

  /**
   * Why this date cannot be booked at all, or null when it can.
   *
   * Both ends are the same bug in opposite directions: `nowMinutes` is null
   * for every day that is not today, so a date in the past looked completely
   * free, and a date past the library's booking horizon offered slots that
   * enforce_booking_limits() then refused. Staff are exempt from the horizon,
   * exactly as the database trigger is.
   */
  const dayClosedReason = useMemo(() => {
    const todayKey = toDateKey(now)
    if (dateKey < todayKey) return 'past'

    const advanceDays = rules?.advance_days
    if (!isAdmin && advanceDays) {
      if (dateKey > toDateKey(addDays(now, advanceDays))) return 'too-far'
    }
    return null
  }, [dateKey, now, rules, isAdmin])

  // Re-resolve the open room against fresh data so an admin edit shows up.
  const activeRoom = openRoom ? (rooms.find((r) => r.id === openRoom.id) ?? null) : null

  const visibleRooms = useMemo(() => filterRooms(rooms, filters), [rooms, filters])

  /**
   * Every start time the booking form may offer, recomputed from live data
   * so a slot taken while the form is open disappears from the list.
   */
  const bookingStarts = useMemo(() => {
    if (!booking?.room) return []
    const slots = buildSlots(dayWindow.startMin, dayWindow.endMin)
    const lane = buildLane({
      room: booking.room,
      slots,
      schedules,
      blocks,
      reservations,
      weekday,
      dayWindow,
      nowMinutes,
      graceMinutes,
      dayClosedReason,
    })
    return freeStarts(lane, slots)
  }, [
    booking,
    schedules,
    blocks,
    reservations,
    weekday,
    dayWindow,
    nowMinutes,
    graceMinutes,
    dayClosedReason,
  ])

  const openBooking = useCallback(
    (room, startMin = null) => setBooking({ room, dateKey, startMin }),
    [dateKey],
  )

  const changeView = useCallback((next) => {
    setView(next)
    rememberView(next)
    // Leaving the rooms list should not strand you inside a room's day when
    // you come back to it.
    setOpenRoom(null)
    window.scrollTo({ top: 0 })
  }, [])

  const handleConfirm = useCallback(
    async (details) => {
      setSaving(true)
      setError(null)
      setProgress(null)

      const { error: insertError } = await createReservation({
        ...details,
        userId: user.id,
        asAdmin: isAdmin,
        onProgress: setProgress,
      })

      setSaving(false)
      setProgress(null)

      if (insertError) {
        setError(friendlyError(insertError))
        return
      }

      setBooking(null)
      setToast(
        isAdmin
          ? `${details.room.name} logged · ${formatTime(details.startMin)} – ${formatTime(details.endMin)}`
          : `Request sent for ${details.room.name} · ${formatTime(details.startMin)} – ${formatTime(details.endMin)}. You'll be notified once staff review it.`,
      )
    },
    [createReservation, user, isAdmin],
  )

  const closeModal = useCallback(() => {
    setBooking(null)
    setError(null)
  }, [])

  // The browse screen — rooms, no single room opened — is the one that gets
  // the greeting and the next-booking card.
  const isRoomsList = view === 'rooms' && !activeRoom

  const { title, blurb } = viewCopy(view, {
    isAdmin,
    roomName: activeRoom?.name ?? null,
    slotMinutes: SLOT_MINUTES,
  })

  return (
    <div className="min-h-screen">
      <SideNav view={view} onChangeView={changeView} />

      {/* Everything sits clear of the fixed rail on desktop, and clear of the
          fixed tab bar on phones. */}
      <div className="lg:pl-60">
        <AppHeader />

        <main className="mx-auto max-w-[1280px] px-4 pt-4 pb-28 sm:px-6 lg:pt-2 lg:pb-14">
          {/* The rooms list opens with a greeting and whatever you have
              booked next, so the title below it steps down to a section
              heading rather than competing for the top of the page. */}
          {isRoomsList && (
            <HomeGreeting onViewBookings={() => changeView('mine')} />
          )}

          <div className="mb-5">
            {view === 'rooms' && activeRoom && (
              <button
                type="button"
                onClick={() => setOpenRoom(null)}
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 transition-all duration-200 ease-in-out hover:-translate-x-0.5 hover:text-white"
              >
                <ArrowLeft className="size-4" strokeWidth={2.5} />
                All rooms
              </button>
            )}
            {isRoomsList ? (
              <h2 className="font-display text-xl leading-tight font-semibold text-white sm:text-2xl">
                {title}
              </h2>
            ) : (
              <h1 className="text-[1.75rem] leading-tight font-semibold text-white sm:text-4xl">
                {title}
              </h1>
            )}
            <p className="mt-1.5 max-w-2xl text-sm text-white/65">{blurb}</p>
          </div>

          {DATED_VIEWS.includes(view) && (
            <DayStrip date={date} onChangeDate={setDate} />
          )}

          {loadError && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-200/70 bg-rose-50 px-4 py-3">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0 text-rose-600"
                strokeWidth={2}
              />
              <p className="text-sm text-rose-800">
                {loadError} — have you run{' '}
                <code className="rounded bg-rose-100 px-1.5 py-0.5 text-xs">
                  supabase/schema.sql
                </code>
                ?
              </p>
            </div>
          )}

          {isRoomsList && (
            <DaySummary
              rooms={rooms}
              reservations={reservations}
              blocks={blocks}
              schedules={schedules}
              dayWindow={dayWindow}
              weekday={weekday}
              date={date}
              onChangeDate={setDate}
              nowMinutes={nowMinutes}
              graceMinutes={graceMinutes}
              dayClosedReason={dayClosedReason}
              currentUserId={user.id}
              isAdmin={isAdmin}
              loading={loading}
            />
          )}

          {isRoomsList && !loading && rooms.length > 0 && (
            <RoomFilters
              filters={filters}
              onChange={setFilters}
              matchCount={visibleRooms.length}
              totalCount={rooms.length}
            />
          )}

          {view === 'rooms' &&
            (activeRoom ? (
              <RoomSchedule
                room={activeRoom}
                reservations={reservations}
                blocks={blocks}
                schedules={schedules}
                dayWindow={dayWindow}
                weekday={weekday}
                dateKey={dateKey}
                nowMinutes={nowMinutes}
                graceMinutes={graceMinutes}
                dayClosedReason={dayClosedReason}
                currentUserId={user.id}
                onBack={() => setOpenRoom(null)}
                onReserve={openBooking}
              />
            ) : (
              <RoomList
                rooms={visibleRooms}
                reservations={reservations}
                blocks={blocks}
                schedules={schedules}
                dayWindow={dayWindow}
                weekday={weekday}
                nowMinutes={nowMinutes}
                graceMinutes={graceMinutes}
                dayClosedReason={dayClosedReason}
                loading={loading}
                onSelectRoom={setOpenRoom}
                onPickSlot={openBooking}
              />
            ))}

          {view === 'grid' && (
            <>
              <TimeslotGrid
                rooms={rooms}
                reservations={reservations}
                blocks={blocks}
                schedules={schedules}
                dayWindow={dayWindow}
                weekday={weekday}
                dateKey={dateKey}
                nowMinutes={nowMinutes}
                graceMinutes={graceMinutes}
                dayClosedReason={dayClosedReason}
                selectedSlot={booking}
                currentUserId={user.id}
                loading={loading}
                onSelectSlot={(slot) => openBooking(slot.room, slot.startMin)}
              />
              <p className="mt-4 text-xs text-white/55">
                Times shown in your local timezone · Bookings run up to 2 hours
              </p>
            </>
          )}

          {view === 'mine' && <MyReservations onCancelled={refresh} />}

          {view === 'requests' && isAdmin && <ApprovalQueue onDecided={refresh} />}

          {view === 'desk' && isAdmin && <DeskView dateKey={dateKey} onChanged={refresh} />}

          {view === 'history' && isAdmin && <HistoryView />}

          {view === 'settings' && <ProfileSettings />}

          {view === 'admin' && isAdmin && (
            <AdminPanel
              rooms={rooms}
              schedules={schedules}
              blocks={blocks}
              dateKey={dateKey}
              onChanged={refresh}
            />
          )}
        </main>
      </div>

      <BottomNav view={view} onChangeView={changeView} />

      {/* Keyed per slot so the form resets on every open. */}
      <BookingModal
        key={booking ? `${booking.room.id}-${booking.startMin ?? 'any'}` : 'closed'}
        booking={booking}
        startOptions={bookingStarts}
        asAdmin={isAdmin}
        saving={saving}
        progress={progress}
        error={error}
        defaults={{
          studentName: profile?.full_name ?? '',
          studentId: profile?.student_id ?? '',
        }}
        onClose={closeModal}
        onConfirm={handleConfirm}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

/* -------------------------------------------------------------- states */

/** Turn Postgres constraint violations into something a student can act on. */
function friendlyError(error) {
  const message = error.message ?? ''
  if (message.includes('reservations_no_overlap')) {
    return 'Someone just booked that slot. Pick another time.'
  }
  if (message.includes('blocked off')) {
    return 'The library has blocked off that time.'
  }
  return message || 'Could not save the reservation. Please try again.'
}

function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="size-6 animate-spin text-brand-600" strokeWidth={2.5} />
    </div>
  )
}

function ConfigError() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <AlertCircle className="size-5" strokeWidth={2} />
        </span>
        <p className="mt-4 text-sm font-semibold text-white">
          Supabase is not configured
        </p>
        <p className="mt-1 text-sm text-white/65">
          Set{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            VITE_SUPABASE_URL
          </code>{' '}
          and{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            VITE_SUPABASE_ANON_KEY
          </code>
          , then rebuild.
        </p>
      </div>
    </div>
  )
}
