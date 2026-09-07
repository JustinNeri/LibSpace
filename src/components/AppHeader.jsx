import { CalendarDays, ChevronLeft, ChevronRight, LibraryBig } from 'lucide-react'
import { addDays, formatLongDate, isSameDay, toDateKey } from '../lib/time'

/**
 * Sticky application bar: brand, day navigation and the availability legend.
 */
export default function AppHeader({ date, onChangeDate, freeSlots, totalSlots }) {
  const today = new Date()
  const viewingToday = isSameDay(date, today)

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-6 py-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/25">
            <LibraryBig className="size-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-900">LibSpace</p>
            <p className="text-xs text-slate-500">Discussion room reservations</p>
          </div>
        </div>

        <div className="mx-2 hidden h-8 w-px bg-slate-200/70 lg:block" />

        {/* Day navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
            <NavButton label="Previous day" onClick={() => onChangeDate(addDays(date, -1))}>
              <ChevronLeft className="size-4" strokeWidth={2.5} />
            </NavButton>
            <NavButton label="Next day" onClick={() => onChangeDate(addDays(date, 1))}>
              <ChevronRight className="size-4" strokeWidth={2.5} />
            </NavButton>
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {formatLongDate(date)}
            </p>
            <p className="text-xs text-slate-500">
              {viewingToday ? 'Today' : toDateKey(date)}
            </p>
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

        {/* Legend + availability */}
        <div className="ml-auto flex items-center gap-5">
          <div className="hidden items-center gap-4 md:flex">
            <LegendChip className="border-slate-200/60 bg-white" label="Available" />
            <LegendChip className="border-slate-200/70 bg-slate-100" label="Booked" />
            <LegendChip className="border-brand-500 bg-brand-50" label="Selected" />
          </div>

          <div className="rounded-xl border border-slate-200/60 bg-white px-4 py-2 text-right shadow-sm">
            <p className="text-sm font-semibold text-slate-900">
              {freeSlots}
              <span className="font-normal text-slate-400"> / {totalSlots}</span>
            </p>
            <p className="text-[11px] tracking-wide text-slate-500 uppercase">Slots open</p>
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

function LegendChip({ className, label }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
      <span className={`size-3.5 rounded-md border ${className}`} />
      {label}
    </span>
  )
}
