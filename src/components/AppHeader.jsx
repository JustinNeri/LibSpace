import { LibraryBig } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { useAuth } from '../hooks/useAuth'
import { UNIVERSITY_SHORT } from '../lib/constants'

function greeting(hour) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Slim top bar. Navigation used to live here — seven tabs, a day stepper and
 * an account menu on one row — and it wrapped into a wall on anything
 * narrower than a laptop. All of that has moved to SideNav / BottomNav and
 * DayStrip, which leaves this bar to do the one thing a top bar is good at:
 * say who you are and what needs your attention.
 */
export default function AppHeader() {
  const { profile, user } = useAuth()

  const firstName =
    profile?.first_name?.trim() ||
    profile?.full_name?.split(',')[1]?.trim().split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there'

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-slate-50/85 backdrop-blur-lg">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3 sm:px-6 lg:py-5">
        {/* Phones get the brand mark — there is no rail to carry it. */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
            <LibraryBig className="size-4.5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm leading-tight font-semibold text-slate-900">
              LibSpace
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {UNIVERSITY_SHORT} · Discussion rooms
            </p>
          </div>
        </div>

        {/* Desktops have the rail, so the bar can be a greeting instead. */}
        <div className="hidden min-w-0 lg:block">
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
            {greeting(new Date().getHours())}
          </p>
          <p className="font-display truncate text-xl font-semibold text-slate-900">
            {firstName}
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
