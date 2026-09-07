import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import AdminPanel from './components/AdminPanel'
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
import { isSupabaseConfigured } from './lib/supabaseClient'
import { SLOT_MINUTES, formatTime, isSameDay, minutesFromDate, toDateKey } from './lib/time'

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

  const [date, setDate] = useState(() => new Date())
  const [view, setView] = useState('rooms')
  const [openRoom, setOpenRoom] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
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

  // Re-resolve the open room against fresh data so an admin edit shows up.
  const activeRoom = openRoom ? (rooms.find((r) => r.id === openRoom.id) ?? null) : null

  const handleConfirm = useCallback(
    async (booking) => {
      setSaving(true)
      setError(null)
      setProgress(null)

      const { error: insertError } = await createReservation({
        ...booking,
        userId: user.id,
        onProgress: setProgress,
      })

      setSaving(false)
      setProgress(null)

      if (insertError) {
        setError(friendlyError(insertError))
        return
      }

      setSelectedSlot(null)
      setToast(
        `${booking.room.name} reserved · ${formatTime(booking.startMin)} – ${formatTime(booking.endMin)}`,
      )
    },
    [createReservation, user],
  )

  const closeModal = useCallback(() => {
    setSelectedSlot(null)
    setError(null)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader date={date} onChangeDate={setDate} view={view} onChangeView={setView} />

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {view === 'rooms' && (activeRoom ? activeRoom.name : 'Discussion rooms')}
            {view === 'grid' && 'Room availability'}
            {view === 'mine' && (isAdmin ? 'All upcoming bookings' : 'My bookings')}
            {view === 'admin' && 'Manage rooms'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {view === 'rooms' &&
              (activeRoom
                ? 'Pick a free time to reserve this room.'
                : 'Tap a room to see when it is free today.')}
            {view === 'grid' &&
              `Pick any open ${SLOT_MINUTES}-minute block to reserve a discussion room.`}
            {view === 'mine' &&
              (isAdmin
                ? 'Every active reservation across the library.'
                : 'Your active reservations. Cancel any you no longer need.')}
            {view === 'admin' &&
              'Add rooms, set weekly opening hours, and block time for maintenance.'}
          </p>
        </div>

        {loadError && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200/70 bg-rose-50 px-4 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" strokeWidth={2} />
            <p className="text-sm text-rose-800">
              {loadError} — have you run{' '}
              <code className="rounded bg-rose-100 px-1.5 py-0.5 text-xs">
                supabase/schema.sql
              </code>
              ?
            </p>
          </div>
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
              currentUserId={user.id}
              onBack={() => setOpenRoom(null)}
              onSelectSlot={setSelectedSlot}
            />
          ) : (
            <RoomList
              rooms={rooms}
              reservations={reservations}
              blocks={blocks}
              schedules={schedules}
              dayWindow={dayWindow}
              weekday={weekday}
              nowMinutes={nowMinutes}
              loading={loading}
              onSelectRoom={setOpenRoom}
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
              selectedSlot={selectedSlot}
              currentUserId={user.id}
              loading={loading}
              onSelectSlot={setSelectedSlot}
            />
            <p className="mt-4 text-xs text-slate-400">
              Times shown in your local timezone · Bookings run up to 2 hours
            </p>
          </>
        )}

        {view === 'mine' && <MyReservations onCancelled={refresh} />}

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

      {/* Keyed per slot so the form resets on every open. */}
      <BookingModal
        key={selectedSlot ? `${selectedSlot.room.id}-${selectedSlot.startMin}` : 'closed'}
        slot={selectedSlot}
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
    <div className="grid min-h-screen place-items-center bg-slate-50">
      <Loader2 className="size-6 animate-spin text-brand-600" strokeWidth={2.5} />
    </div>
  )
}

function ConfigError() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-amber-100 text-amber-600">
          <AlertCircle className="size-5" strokeWidth={2} />
        </span>
        <p className="mt-4 text-sm font-semibold text-slate-900">Supabase is not configured</p>
        <p className="mt-1 text-sm text-slate-500">
          Set <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">VITE_SUPABASE_URL</code>{' '}
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
