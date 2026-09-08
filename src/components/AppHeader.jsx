import { LibSpaceMark } from './Logo'
import NotificationBell from './NotificationBell'
import { UNIVERSITY_SHORT } from '../lib/constants'

/**
 * Slim top bar. Navigation used to live here — seven tabs, a day stepper and
 * an account menu on one row — and it wrapped into a wall on anything
 * narrower than a laptop. All of that has moved to SideNav / BottomNav and
 * DayStrip.
 *
 * The greeting has moved too, down onto the rooms screen itself, where a
 * phone can see it as well — so this bar is left holding the brand and the
 * one thing that needs your attention.
 *
 * White rather than the page's own green: the ground is dark enough now that
 * a bar tinted to match it would simply disappear, and this way the top bar,
 * the phone's tab bar and the desktop rail are all the same white surface.
 */
export default function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3 sm:px-6 lg:py-5">
        {/* Phones get the brand mark — there is no rail to carry it. */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <LibSpaceMark className="size-9 shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-sm leading-tight font-semibold text-slate-900">
              LibSpace
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {UNIVERSITY_SHORT} · Discussion rooms
            </p>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
