import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, History, Search } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatTime, minutesFromDate, toDateKey } from '../lib/time'

const STATUS_STYLES = {
  completed: 'bg-emerald-50 text-emerald-700',
  approved: 'bg-brand-50 text-brand-700',
  pending: 'bg-amber-50 text-amber-700',
  rejected: 'bg-rose-50 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-500',
  no_show: 'bg-rose-50 text-rose-700',
}

const STATUS_LABELS = {
  completed: 'Used',
  approved: 'Confirmed',
  pending: 'Pending',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

/** Escape a value for CSV — quotes doubled, field wrapped when needed. */
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * The audit trail the paper logbook used to be: every reservation, what
 * became of it, and who actually turned up. Exportable for reporting.
 */
export default function HistoryView() {
  const today = toDateKey(new Date())
  const [from, setFrom] = useState(() => {
    const start = new Date()
    start.setDate(start.getDate() - 30)
    return toDateKey(start)
  })
  const [to, setTo] = useState(today)
  const [status, setStatus] = useState('all')
  const [term, setTerm] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('reservations')
      .select('*, rooms(name)')
      .gte('start_time', new Date(`${from}T00:00:00`).toISOString())
      .lte('start_time', new Date(`${to}T23:59:59`).toISOString())
      .order('start_time', { ascending: false })
      .limit(1000)

    if (status !== 'all') query = query.eq('status', status)

    const { data, error: loadError } = await query
    if (loadError) setError(loadError.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [from, to, status])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      [row.student_name, row.student_id, row.rooms?.name, row.purpose]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle)),
    )
  }, [rows, term])

  const stats = useMemo(() => {
    const used = visible.filter((row) => row.status === 'completed').length
    const noShow = visible.filter((row) => row.status === 'no_show').length
    const hours = visible
      .filter((row) => ['completed', 'approved'].includes(row.status))
      .reduce(
        (total, row) =>
          total + (new Date(row.end_time) - new Date(row.start_time)) / 3_600_000,
        0,
      )
    return { used, noShow, hours: Math.round(hours * 10) / 10 }
  }, [visible])

  const exportCsv = () => {
    const header = [
      'Date',
      'Start',
      'End',
      'Room',
      'Student',
      'Student number',
      'Group size',
      'Purpose',
      'Status',
      'Checked in',
      'Checked out',
      'Rejection reason',
    ]

    const lines = visible.map((row) => {
      const start = new Date(row.start_time)
      const end = new Date(row.end_time)
      return [
        toDateKey(start),
        formatTime(minutesFromDate(start)),
        formatTime(minutesFromDate(end)),
        row.rooms?.name ?? '',
        row.student_name,
        row.student_id,
        row.group_size,
        row.purpose ?? '',
        STATUS_LABELS[row.status] ?? row.status,
        row.checked_in_at ? new Date(row.checked_in_at).toLocaleString() : '',
        row.checked_out_at ? new Date(row.checked_out_at).toLocaleString() : '',
        row.rejection_reason ?? '',
      ].map(csvCell).join(',')
    })

    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `libspace-${from}-to-${to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Filters */}
      <div className="surface mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="From">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={fieldClass}
          >
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Search" className="min-w-48 flex-1">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              strokeWidth={2}
            />
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Name, student number, room…"
              className={`${fieldClass} pl-9`}
            />
          </div>
        </Field>

        <button
          type="button"
          onClick={exportCsv}
          disabled={visible.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-40"
        >
          <Download className="size-4" strokeWidth={2.5} />
          Export CSV
        </button>
      </div>

      {/* Totals */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Total value={visible.length} label="Reservations" />
        <Total value={stats.hours} label="Room hours" suffix="h" />
        <Total
          value={stats.noShow}
          label="No-shows"
          tone={stats.noShow > 0 ? 'rose' : 'slate'}
        />
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200/70 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="surface h-14 animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="surface p-16 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-400">
            <History className="size-5" strokeWidth={2} />
          </span>
          <p className="mt-4 text-sm font-medium text-slate-900">Nothing in this range</p>
          <p className="mt-1 text-sm text-slate-500">Widen the dates or clear the search.</p>
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200/70 bg-slate-50/70">
                <tr className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  <Th>When</Th>
                  <Th>Room</Th>
                  <Th>Student</Th>
                  <Th>Group</Th>
                  <Th>Status</Th>
                  <Th>Attendance</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {visible.map((row) => {
                  const start = new Date(row.start_time)
                  const end = new Date(row.end_time)
                  return (
                    <tr
                      key={row.id}
                      className="transition-colors duration-200 hover:bg-slate-50/70"
                    >
                      <Td>
                        <span className="tnum font-medium text-slate-900">
                          {toDateKey(start)}
                        </span>
                        <span className="tnum block text-xs text-slate-500">
                          {formatTime(minutesFromDate(start))} –{' '}
                          {formatTime(minutesFromDate(end))}
                        </span>
                      </Td>
                      <Td>{row.rooms?.name ?? '—'}</Td>
                      <Td>
                        <span className="text-slate-900">{row.student_name}</span>
                        <span className="block text-xs text-slate-500">
                          {row.student_id}
                        </span>
                      </Td>
                      <Td className="tnum">{row.group_size}</Td>
                      <Td>
                        <span
                          className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                            STATUS_STYLES[row.status] ?? STATUS_STYLES.cancelled
                          }`}
                        >
                          {STATUS_LABELS[row.status] ?? row.status}
                        </span>
                      </Td>
                      <Td className="text-xs text-slate-500">
                        {row.checked_in_at ? (
                          <>
                            <span className="tnum">
                              in{' '}
                              {formatTime(minutesFromDate(new Date(row.checked_in_at)))}
                            </span>
                            {row.checked_out_at && (
                              <span className="tnum block">
                                out{' '}
                                {formatTime(
                                  minutesFromDate(new Date(row.checked_out_at)),
                                )}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- pieces ---------- */

const fieldClass =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all duration-200 ease-in-out placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 focus:outline-none'

function Field({ label, className = '', children }) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  )
}

function Total({ value, label, suffix = '', tone = 'slate' }) {
  return (
    <div className="surface px-4 py-3">
      <p
        className={[
          'tnum text-xl font-bold tracking-tight',
          tone === 'rose' ? 'text-rose-600' : 'text-slate-900',
        ].join(' ')}
      >
        {value}
        <span className="text-sm font-medium text-slate-400">{suffix}</span>
      </p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function Th({ children }) {
  return <th className="px-4 py-3">{children}</th>
}

function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>
}
