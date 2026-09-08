import { useCallback, useEffect, useState } from 'react'
import {
  CalendarClock,
  Check,
  ChevronDown,
  IdCard,
  Inbox,
  Loader2,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatLongDate, formatTime, minutesFromDate } from '../lib/time'
import IdPhotoStrip from './IdPhotoStrip'

/**
 * Pending requests awaiting a decision.
 *
 * Approving or rejecting only writes the status — the notice to the student
 * is raised by a database trigger, so it cannot be missed.
 */
export default function ApprovalQueue({ onDecided }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [rejecting, setRejecting] = useState(null) // { id, reason }
  // Ticked rather than read during render, so a request crossing its end time
  // becomes un-approvable on its own instead of at the next unrelated redraw.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('reservations')
      .select('*, rooms(name, capacity)')
      .eq('status', 'pending')
      .order('start_time')

    if (loadError) setError(loadError.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Live updates so two staff at the desk do not both work the same request.
  useEffect(() => {
    const channel = supabase
      .channel('approval-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => load(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const decide = async (row, status, reason = null) => {
    setBusyId(row.id)
    setError(null)

    const { error: updateError } = await supabase
      .from('reservations')
      .update({ status, rejection_reason: reason })
      .eq('id', row.id)

    setBusyId(null)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setRejecting(null)
    setRows((current) => current.filter((item) => item.id !== row.id))
    onDecided?.()
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-slate-200/60 bg-white"
          />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="surface p-16 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Inbox className="size-5" strokeWidth={2} />
        </span>
        <p className="mt-4 text-sm font-medium text-slate-900">Nothing waiting</p>
        <p className="mt-1 text-sm text-slate-500">
          New requests appear here the moment a student submits one.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl border border-rose-200/70 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {rows.map((row) => {
        const start = new Date(row.start_time)
        const end = new Date(row.end_time)
        const isBusy = busyId === row.id
        const isRejecting = rejecting?.id === row.id
        // The queue has no date filter — a request nobody decided is still
        // here days later. Approving one of those either books a room in the
        // past or hands the student a slot release_no_shows() sweeps on its
        // next run, so approval is closed once the booking's time has gone.
        const expired = end.getTime() <= now

        return (
          <article
            key={row.id}
            className="surface overflow-hidden"
          >
            <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 lg:max-w-2xl">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-display text-lg font-semibold text-slate-900">
                    {row.rooms?.name ?? 'Room'}
                  </h3>
                  <p
                    className={[
                      'tnum text-sm font-semibold',
                      expired ? 'text-slate-400' : 'text-slate-700',
                    ].join(' ')}
                  >
                    {formatTime(minutesFromDate(start))} –{' '}
                    {formatTime(minutesFromDate(end))}
                  </p>
                  <span
                    className={[
                      'rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                      expired
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-amber-50 text-amber-700',
                    ].join(' ')}
                  >
                    {expired ? 'Expired' : 'Pending'}
                  </span>
                </div>

                <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <CalendarClock className="size-3.5" strokeWidth={2} />
                  {formatLongDate(start)}
                </p>

                {expired && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                    This time has already passed — decline it to clear the queue.
                  </p>
                )}

                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {row.student_name}
                  <span className="font-normal text-slate-400">
                    {' '}
                    · {row.student_id}
                  </span>
                </p>

                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
                  <Users className="size-3.5" strokeWidth={2} />
                  {row.group_size} members
                  {row.purpose && <span className="text-slate-400">· {row.purpose}</span>}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(expandedId === row.id ? null : row.id)
                  }
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-brand-600 transition-colors duration-200 hover:text-brand-700"
                >
                  <IdCard className="size-3.5" strokeWidth={2.5} />
                  {row.id_photos?.length ?? 0} ID photo
                  {(row.id_photos?.length ?? 0) === 1 ? '' : 's'}
                  <ChevronDown
                    className={[
                      'size-3.5 transition-transform duration-200',
                      expandedId === row.id ? 'rotate-180' : '',
                    ].join(' ')}
                    strokeWidth={2.5}
                  />
                </button>
              </div>

              <div className="flex shrink-0 gap-2 lg:w-52 lg:justify-end">
                <button
                  type="button"
                  onClick={() => setRejecting({ id: row.id, reason: '' })}
                  disabled={isBusy}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:pointer-events-none disabled:opacity-50 lg:flex-none"
                >
                  <X className="size-4" strokeWidth={2.5} />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => decide(row, 'approved')}
                  disabled={isBusy || expired}
                  title={expired ? 'That time has already passed' : undefined}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold tracking-wide text-white transition-colors duration-200 hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-50 lg:flex-none"
                >
                  {isBusy ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
                  ) : (
                    <Check className="size-4" strokeWidth={2.5} />
                  )}
                  Approve
                </button>
              </div>
            </div>

            {expandedId === row.id && <IdPhotoStrip paths={row.id_photos ?? []} />}

            {isRejecting && (
              <div className="border-t border-slate-200/60 bg-slate-50/70 p-5">
                <label className="text-xs font-medium text-slate-600">
                  Reason (the student sees this)
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={rejecting.reason}
                    onChange={(event) =>
                      setRejecting({ ...rejecting, reason: event.target.value })
                    }
                    placeholder="Incomplete IDs, group too small, room reserved for an event…"
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 ease-in-out placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setRejecting(null)}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(row, 'rejected', rejecting.reason.trim() || null)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-rose-600/25 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-rose-700 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isBusy ? (
                      <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
                    ) : (
                      <X className="size-4" strokeWidth={2.5} />
                    )}
                    Confirm rejection
                  </button>
                </div>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
