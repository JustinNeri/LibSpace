import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCircle2, Inbox, XCircle } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'

const KIND_STYLES = {
  approved: { Icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50' },
  rejected: { Icon: XCircle, tone: 'text-rose-600 bg-rose-50' },
  cancelled: { Icon: XCircle, tone: 'text-slate-500 bg-slate-100' },
  info: { Icon: Inbox, tone: 'text-brand-600 bg-brand-50' },
}

/** Relative time, falling back to a date once it stops being useful. */
function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

/**
 * Inbox for approval decisions. Opening the panel marks everything read,
 * so the badge reflects "things you have not looked at" rather than a
 * running total.
 */
export default function NotificationBell() {
  const { items, unreadCount, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && unreadCount > 0) markAllRead()
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        className="relative grid size-10 place-items-center rounded-xl border border-slate-200/60 bg-white text-slate-500 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:text-slate-900 hover:shadow-md"
      >
        <Bell className="size-4.5" strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-lg shadow-slate-900/5 animate-pop-in sm:w-96">
          <div className="border-b border-slate-200/60 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <span className="mx-auto grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-400">
                <Inbox className="size-4.5" strokeWidth={2} />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-900">Nothing yet</p>
              <p className="mt-1 text-xs text-slate-500">
                You'll hear here when staff review a request.
              </p>
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-200/60 overflow-y-auto scrollbar-slim">
              {items.map((item) => {
                const { Icon, tone } = KIND_STYLES[item.kind] ?? KIND_STYLES.info
                return (
                  <li
                    key={item.id}
                    className={[
                      'flex gap-3 px-4 py-3.5 transition-colors duration-200',
                      item.read_at ? 'bg-white' : 'bg-brand-50/40',
                    ].join(' ')}
                  >
                    <span
                      className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${tone}`}
                    >
                      <Icon className="size-3.5" strokeWidth={2.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        {item.body}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {timeAgo(item.created_at)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
