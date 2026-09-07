import { useCallback, useEffect, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import AppHeader from './components/AppHeader'
import BookingModal from './components/BookingModal'
import TimeslotGrid from './components/TimeslotGrid'
import Toast from './components/Toast'
import { useReservations } from './hooks/useReservations'
import {
  SLOT_COUNT,
  SLOT_MINUTES,
  formatTime,
  isSameDay,
  minutesFromDate,
  reservationToSpan,
  toDateKey,
} from './lib/time'

export default function App() {
  const [date, setDate] = useState(() => new Date())
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [now, setNow] = useState(() => new Date())

  const dateKey = toDateKey(date)
  const { rooms, reservations, loading, usingDemoData, createReservation } =
    useReservations(dateKey)

  // Move the "now" indicator on the slot boundary rather than every second.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const viewingToday = isSameDay(date, now)
  const nowMinutes = viewingToday ? minutesFromDate(now) : null

  const totalSlots = rooms.length * SLOT_COUNT
  const bookedSlots = useMemo(
    () =>
      reservations.reduce((total, reservation) => {
        const placement = reservationToSpan(reservation)
        return total + (placement?.span ?? 0)
      }, 0),
    [reservations],
  )

  const handleConfirm = useCallback(
    async (booking) => {
      setSaving(true)
      setError(null)

      const { error: insertError } = await createReservation(booking)

      setSaving(false)

      if (insertError) {
        setError(insertError.message ?? 'Could not save the reservation. Please try again.')
        return
      }

      setSelectedSlot(null)
      setToast(
        `${booking.room.name} reserved · ${formatTime(booking.startMin)} – ${formatTime(booking.endMin)}`,
      )
    },
    [createReservation],
  )

  const closeModal = useCallback(() => {
    setSelectedSlot(null)
    setError(null)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        date={date}
        onChangeDate={setDate}
        freeSlots={Math.max(0, totalSlots - bookedSlots)}
        totalSlots={totalSlots}
      />

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Room availability
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Pick any open {SLOT_MINUTES}-minute block to reserve a discussion room.
            </p>
          </div>
        </div>

        {usingDemoData && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={2} />
            <p className="text-sm text-amber-800">
              Showing sample data. Add your Supabase credentials to
              <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs">.env.local</code>
              and seed the <span className="font-medium">rooms</span> table to go live.
            </p>
          </div>
        )}

        <TimeslotGrid
          rooms={rooms}
          reservations={reservations}
          dateKey={dateKey}
          nowMinutes={nowMinutes}
          selectedSlot={selectedSlot}
          loading={loading}
          onSelectSlot={setSelectedSlot}
        />

        <p className="mt-4 text-xs text-slate-400">
          Times shown in your local timezone · Bookings run 8:00 AM to 5:00 PM
        </p>
      </main>

      {/* Keyed per slot so the form resets on every open. */}
      <BookingModal
        key={selectedSlot ? `${selectedSlot.room.id}-${selectedSlot.startMin}` : 'closed'}
        slot={selectedSlot}
        saving={saving}
        error={error}
        onClose={closeModal}
        onConfirm={handleConfirm}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
