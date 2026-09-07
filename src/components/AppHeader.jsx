import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LibraryBig,
  LogOut,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import NotificationBell from './NotificationBell'
import { useAuth } from '../hooks/useAuth'
import { addDays, formatLongDate, fromDateKey, isSameDay, toDateKey } from '../lib/time'
import { UNIVERSITY_SHORT } from '../lib/constants'

/**
 * Sticky application bar: brand, day navigation, view switch and account menu.
 */
export default function AppHeader({ date, onChangeDate, view, onChangeView }) {
  const { profile, user, isAdmin, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const today = new Date()
  const viewingToday = isSameDay(date, today)

  // Dismiss the account menu on an outside click.
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen])

  const initials = (profile?.full_name || user?.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-6 py-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-600/30">
            <LibraryBig className="size-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-900">LibSpace</p>
            <p className="text-xs text-slate-500">
              {UNIVERSITY_SHORT} · Discussion rooms
            </p>
          </div>
        </div>

        <div className="mx-2 hidden h-8 w-px bg-slate-200/70 lg:block" />

        {/* Day navigation — only relevant on the grid */}
        {['rooms', 'grid', 'desk'].includes(view) && (
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
              <NavButton label="Previous day" onClick={() => onChangeDate(addDays(date, -1))}>
                <ChevronLeft className="size-4" strokeWidth={2.5} />
              </NavButton>
              <NavButton label="Next day" onClick={() => onChangeDate(addDays(date, 1))}>
                <ChevronRight className="size-4" strokeWidth={2.5} />
              </NavButton>
            </div>

            <div className="relative min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {formatLongDate(date)}
              </p>
              <p className="text-xs text-slate-500">
                {viewingToday ? 'Today' : toDateKey(date)}
              </p>
              {/* Invisible native picker over the label — one tap jumps to
                  any date instead of stepping a day at a time. */}
              <input
                type="date"
                aria-label="Pick a date"
                value={toDateKey(date)}
                onChange={(event) => {
                  if (event.target.value) onChangeDate(fromDateKey(event.target.value))
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>

            {!viewingToday && (
              <button
                type="button"
                onClick={() => onChangeDate(new Date())}
                className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-brand-50"
              >
                <CalendarDays className="size-3.5" strokeWidth={2.5} />
                Today
              </button>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {/* View switch */}
          <div className="flex flex-wrap items-center rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
            <ViewTab active={view === 'rooms'} onClick={() => onChangeView('rooms')}>
              Rooms
            </ViewTab>
            <ViewTab active={view === 'grid'} onClick={() => onChangeView('grid')}>
              Timetable
            </ViewTab>
            <ViewTab active={view === 'mine'} onClick={() => onChangeView('mine')}>
              My bookings
            </ViewTab>
            {isAdmin && (
              <>
                <ViewTab active={view === 'desk'} onClick={() => onChangeView('desk')}>
                  Desk
                </ViewTab>
                <ViewTab
                  active={view === 'requests'}
                  onClick={() => onChangeView('requests')}
                >
                  Requests
                </ViewTab>
                <ViewTab
                  active={view === 'history'}
                  onClick={() => onChangeView('history')}
                >
                  History
                </ViewTab>
                <ViewTab active={view === 'admin'} onClick={() => onChangeView('admin')}>
                  Manage
                </ViewTab>
              </>
            )}
          </div>

          <NotificationBell />

          {/* Account */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Account menu"
              className="grid size-10 place-items-center rounded-xl bg-slate-900 text-xs font-semibold text-white transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md"
            >
              {initials}
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-lg shadow-slate-900/5 animate-pop-in">
                <div className="border-b border-slate-200/60 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {profile?.full_name || 'Student'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p>

                  <div className="mt-2.5 flex items-center gap-2">
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">
                        <ShieldCheck className="size-3" strokeWidth={2.5} />
                        Administrator
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                        {profile?.student_id || 'Student'}
                      </span>
                    )}
                  </div>

                  {!isAdmin && (profile?.course || profile?.year_level) && (
                    <p className="mt-2 truncate text-xs text-slate-500">
                      {[profile.year_level, profile.course].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onChangeView('settings')
                  }}
                  className="flex w-full items-center gap-2.5 border-b border-slate-200/60 px-4 py-3 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Settings className="size-4" strokeWidth={2} />
                  Account settings
                </button>

                <button
                  type="button"
                  onClick={signOut}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900"
                >
                  <LogOut className="size-4" strokeWidth={2} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function NavButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-lg p-1.5 text-slate-500 transition-all duration-200 ease-in-out hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </button>
  )
}

function ViewTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-in-out',
        active
          ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
