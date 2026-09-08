import { LogOut, ShieldCheck } from 'lucide-react'
import { LibSpaceMark } from './Logo'
import { useAuth } from '../hooks/useAuth'
import { initialsFor, navItems } from '../lib/nav'
import { LIBRARY_NAME, UNIVERSITY_SHORT } from '../lib/constants'

/**
 * Desktop navigation rail.
 *
 * Seven views never fitted in a row of header tabs — they wrapped onto a
 * second line and pushed the account button around. A fixed rail gives every
 * view a full label, a stable position, and room to grow.
 *
 * Hidden below `lg`, where BottomNav takes over.
 */
export default function SideNav({ view, onChangeView }) {
  const { profile, user, isAdmin, signOut } = useAuth()
  const items = navItems(isAdmin)

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-300 bg-white lg:flex">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <LibSpaceMark className="size-10 shrink-0" />
        <div className="min-w-0">
          <p className="font-display text-base leading-tight font-semibold text-slate-900">
            LibSpace
          </p>
          <p className="truncate text-[11px] text-slate-500">
            {UNIVERSITY_SHORT} · {LIBRARY_NAME}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 scrollbar-slim">
        {items.map(({ key, label, Icon }) => {
          const active = view === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChangeView(key)}
              aria-current={active ? 'page' : undefined}
              className={[
                'relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200',
                active
                  ? 'bg-brand-50 text-brand-800'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
            >
              <Icon
                className={active ? 'size-4.5 text-brand-600' : 'size-4.5'}
                strokeWidth={2}
              />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Who you are */}
      <div className="border-t border-slate-300 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
            {initialsFor(profile, user)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {profile?.full_name || 'Student'}
            </p>
            <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="size-4" strokeWidth={2} />
          </button>
        </div>

        {isAdmin && (
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-[10px] font-bold tracking-wider text-brand-700 uppercase">
            <ShieldCheck className="size-3" strokeWidth={2.5} />
            Administrator
          </p>
        )}
      </div>
    </aside>
  )
}
