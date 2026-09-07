import { useEffect, useState } from 'react'
import { CalendarX2, Clock, Loader2, MapPin, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { formatLongDate, formatTime, minutesFromDate } from '../lib/time'

/**
 * The signed-in student's own bookings, upcoming first, with cancellation.
 * Admins see everyone's instead.
 *
 * Rejected requests stay listed so the student can read why before dismissing
 * them; only pending and approved bookings can be cancelled.
 */

const STATUS_STYLES = {
  pending: { label: 'Awaiting approval', className: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Confirmed', className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Declined', className: 'bg-rose-50 text-rose-700' },
}

export default function MyReservations({ onCancelled }) {
  const { user, isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      let query = supabase
        .from('reservations')
        .select('*, rooms(name)')
        .in('status', ['pending', 'approved', 'rejected'])
        .gte('end_time', new Date().toISOString())
        .order('start_time')

      if (!isAdmin) query = query.eq('user_id', user.id)

      const { data, error: loadError } = await query
      if (cancelled) return

      if (loadError) setError(loadError.message)
      else setRows(data ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, isAdmin])

  const cancel = async (id) => {
    setCancellingId(id)
    const { error: cancelError } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', id)
    setCancellingId(null)

    if (cancelError) {
      setError(cancelError.message)
      return
    }

    setRows((current) => current.filter((row) => row.id !== id))
    onCancelled?.()
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-xl border border-slate-200/60 bg-white"
          />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white p-16 text-center shadow-sm">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400">
          <CalendarX2 className="size-5" strokeWidth={2} />
        </span>
        <p className="mt-4 text-sm font-medium text-slate-900">No upcoming bookings</p>
        <p className="mt-1 text-sm text-slate-500">
          Head to Rooms and pick a free time.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-xl border border-rose-200/70 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {rows.map((row) => {
        const start = new Date(row.start_time)
        const end = new Date(row.end_time)

        return (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-slate-300/70 hover:shadow-md"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MapPin className="size-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                  <span className="truncate">{row.rooms?.name ?? 'Room'}</span>
                </p>
                <span
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                    (STATUS_STYLES[row.status] ?? STATUS_STYLES.pending).className
                  }`}
                >
                  {(STATUS_STYLES[row.status] ?? STATUS_STYLES.pending).label}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <Clock className="size-3.5 shrink-0" strokeWidth={2} />
                {formatLongDate(start)} · {formatTime(minutesFromDate(start))} –{' '}
                {formatTime(minutesFromDate(end))}
              </p>
              {isAdmin && (
                <p className="mt-1 truncate text-xs text-slate-400">
                  {row.student_name} · {row.student_id} · {row.group_size} pax
                </p>
              )}

              {row.status === 'rejected' && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-600">
                  <XCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                  {row.rejection_reason || 'No reason was given.'}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => cancel(row.id)}
              disabled={cancellingId === row.id}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/60 px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:pointer-events-none disabled:opacity-50"
            >
              {cancellingId === row.id ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
              ) : null}
              {row.status === 'rejected' ? 'Dismiss' : 'Cancel'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
