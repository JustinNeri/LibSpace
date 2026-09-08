import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCheck,
  Clock,
  DoorOpen,
  IdCard,
  LogIn,
  LogOut,
  Loader2,
  Users,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatTime, minutesFromDate } from '../lib/time'
import IdPhotoStrip from './IdPhotoStrip'

/**
 * The front desk. Today's approved bookings, in time order, with the
 * check-in and check-out actions that make this an attendance record
 * rather than a list of intentions.
 */
export default function DeskView({ dateKey, onChanged }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Free anything nobody turned up for before drawing the list.
    await supabase.rpc('release_no_shows')

    const dayStart = new Date(`${dateKey}T00:00:00`).toISOString()
    const dayEnd = new Date(`${dateKey}T23:59:59`).toISOString()

    const { data, error: loadError } = await supabase
      .from('reservations')
      .select('*, rooms(name)')
      .in('status', ['approved', 'completed', 'no_show'])
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .order('start_time')

    if (loadError) setError(loadError.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [dateKey])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('desk-view')
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

  const act = async (row, fn) => {
    setBusyId(row.id)
    setError(null)
    const { error: rpcError } = await supabase.rpc(fn, { reservation_id: row.id })
    setBusyId(null)

    if (rpcError) {
      setError(rpcError.message)
      return
    }
    await load()
    onChanged?.()
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="surface p-16 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400">
          <DoorOpen className="size-5" strokeWidth={2} />
        </span>
        <p className="mt-4 text-sm font-medium text-slate-900">
          No confirmed bookings today
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Approved requests appear here for check-in.
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
        const state = deskState(row)

        return (
          <article key={row.id} className="surface overflow-hidden">
            <div className="flex flex-wrap items-center gap-4 p-5">
              {/* Time block reads first — staff scan by clock */}
              <div className="tnum shrink-0 text-center">
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  {formatTime(minutesFromDate(start))}
                </p>
                <p className="text-xs text-slate-400">
                  to {formatTime(minutesFromDate(end))}
                </p>
              </div>

              <div className="min-w-0 flex-1 border-l border-slate-200/70 pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {row.rooms?.name ?? 'Room'}
                  </p>
                  <StatePill state={state} />
                </div>
                <p className="mt-1 truncate text-sm text-slate-600">
                  {row.student_name}
                  <span className="text-slate-400"> · {row.student_id}</span>
                </p>
                <p className="mt-1 inline-flex items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3.5" strokeWidth={2} />
                    {row.group_size}
                  </span>
                  {row.checked_in_at && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5" strokeWidth={2} />
                      in at{' '}
                      {formatTime(minutesFromDate(new Date(row.checked_in_at)))}
                    </span>
                  )}
                  {row.checked_out_at && (
                    <span className="inline-flex items-center gap-1.5">
                      out at{' '}
                      {formatTime(minutesFromDate(new Date(row.checked_out_at)))}
                    </span>
                  )}
                </p>

                <button
                  type="button"
                  onClick={() => setOpenId(openId === row.id ? null : row.id)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 transition-colors duration-200 hover:text-brand-700"
                >
                  <IdCard className="size-3.5" strokeWidth={2.5} />
                  {openId === row.id ? 'Hide' : 'Verify'} {row.id_photos?.length ?? 0} IDs
                </button>
              </div>

              <div className="flex shrink-0 gap-2">
                {!row.checked_in_at && row.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => act(row, 'check_in_reservation')}
                    disabled={isBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold tracking-wide text-white transition-colors duration-200 hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {isBusy ? (
                      <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
                    ) : (
                      <LogIn className="size-4" strokeWidth={2.5} />
                    )}
                    Check in
                  </button>
                )}

                {row.checked_in_at && !row.checked_out_at && (
                  <button
                    type="button"
                    onClick={() => act(row, 'check_out_reservation')}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/70 px-4 py-2.5 text-sm font-medium text-slate-600 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isBusy ? (
                      <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
                    ) : (
                      <LogOut className="size-4" strokeWidth={2.5} />
                    )}
                    Check out
                  </button>
                )}
              </div>
            </div>

            {openId === row.id && <IdPhotoStrip paths={row.id_photos ?? []} />}
          </article>
        )
      })}
    </div>
  )
}

/* ---------- state ---------- */

function deskState(row) {
  if (row.status === 'no_show') return 'no_show'
  if (row.checked_out_at || row.status === 'completed') return 'done'
  if (row.checked_in_at) return 'in'
  if (new Date(row.start_time) <= new Date()) return 'due'
  return 'upcoming'
}

const STATE_STYLES = {
  upcoming: { label: 'Upcoming', className: 'bg-slate-100 text-slate-600', Icon: Clock },
  due: { label: 'Waiting', className: 'bg-amber-50 text-amber-700', Icon: AlertTriangle },
  in: { label: 'In room', className: 'bg-emerald-50 text-emerald-700', Icon: DoorOpen },
  done: { label: 'Finished', className: 'bg-slate-100 text-slate-500', Icon: CheckCheck },
  no_show: { label: 'No-show', className: 'bg-rose-50 text-rose-700', Icon: AlertTriangle },
}

function StatePill({ state }) {
  const { label, className, Icon } = STATE_STYLES[state]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${className}`}
    >
      <Icon className="size-3" strokeWidth={2.5} />
      {label}
    </span>
  )
}
