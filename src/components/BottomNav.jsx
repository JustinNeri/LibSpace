import { useEffect, useState } from 'react'
import { LogOut, MoreHorizontal, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { navItems } from '../lib/nav'
import Avatar from './Avatar'

const FIXED_TABS = 4

/**
 * Phone navigation.
 *
 * A fixed bar of the four views a student actually uses, with everything
 * else — the six extra admin views — behind a "More" sheet. The old header
 * put all of them in one wrapping row of chips, which on a 390px screen was
 * three lines of tiny targets above the content.
 *
 * Hidden from `lg` up, where SideNav takes over.
 */
export default function BottomNav({ view, onChangeView }) {
  const { profile, user, isAdmin, signOut } = useAuth()
  const [sheetOpen, setSheetOpen] = useState(false)

  const items = navItems(isAdmin)
  const primary = items.slice(0, FIXED_TABS)
  const overflow = items.slice(FIXED_TABS)
  const overflowActive = overflow.some((item) => item.key === view)

  useEffect(() => {
    if (!sheetOpen) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSheetOpen(false)
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [sheetOpen])

  const go = (key) => {
    onChangeView(key)
    setSheetOpen(false)
  }

  return (
    <>
      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-brand-900/95 backdrop-blur-lg lg:hidden"
      >
        <div className="flex items-stretch">
          {primary.map(({ key, short, Icon }) => (
            <Tab
              key={key}
              active={view === key}
              label={short}
              Icon={Icon}
              onClick={() => go(key)}
            />
          ))}

          {overflow.length > 0 && (
            <Tab
              active={overflowActive}
              label="More"
              Icon={MoreHorizontal}
              onClick={() => setSheetOpen(true)}
            />
          )}
        </div>
      </nav>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 cursor-default bg-slate-900/40 animate-fade-in"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="More views"
            className="pb-safe relative max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white animate-sheet-up"
          >
            <div className="sticky top-0 z-10 bg-white pt-2">
              <span
                aria-hidden
                className="mx-auto block h-1 w-10 rounded-full bg-slate-200"
              />
              <div className="flex items-center gap-3 px-5 pt-4 pb-3">
                <Avatar profile={profile} user={user} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {profile?.full_name || 'Student'}
                  </p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"
                >
                  <X className="size-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 px-4 pb-3">
              {overflow.map(({ key, label, Icon }) => {
                const active = view === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => go(key)}
                    className={[
                      'flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition-colors duration-200',
                      active
                        ? 'border-brand-200 bg-brand-50 text-brand-800'
                        : 'border-slate-300 bg-white text-slate-700',
                    ].join(' ')}
                  >
                    <Icon
                      className={active ? 'size-4.5 text-brand-600' : 'size-4.5 text-slate-400'}
                      strokeWidth={2}
                    />
                    <span className="min-w-0 truncate">{label}</span>
                  </button>
                )
              })}
            </div>

            <div className="border-t border-slate-300 p-4">
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3.5 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <LogOut className="size-4" strokeWidth={2} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Tab({ active, label, Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="group relative flex flex-1 flex-col items-center gap-1 px-1 pt-2.5 pb-2"
    >
      <span
        className={[
          'grid h-8 w-14 place-items-center rounded-full transition-colors duration-200',
          active ? 'bg-white/15 text-white' : 'text-white/55',
        ].join(' ')}
      >
        <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
      </span>
      <span
        className={[
          'text-[10px] font-semibold tracking-tight transition-colors duration-200',
          active ? 'text-white' : 'text-white/60',
        ].join(' ')}
      >
        {label}
      </span>
    </button>
  )
}
