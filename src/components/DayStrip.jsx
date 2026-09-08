import { useEffect, useMemo, useRef } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, isSameDay, toDateKey, fromDateKey } from '../lib/time'

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Sunday of the week the given date falls in. */
function startOfWeek(date) {
  return addDays(date, -date.getDay())
}

/**
 * The day picker, as a week of tappable dates rather than a pair of tiny
 * chevrons. It is the same control on a phone and on a desktop — the week
 * simply gets more room — which is what makes the two layouts feel like one
 * product.
 *
 * The whole strip scrolls horizontally on narrow screens, and the selected
 * day is scrolled into view whenever it changes from outside (jumping to
 * "Today", or picking a far-off date from the native calendar).
 */
export default function DayStrip({ date, onChangeDate }) {
  const scrollerRef = useRef(null)
  const selectedRef = useRef(null)

  const today = new Date()
  const viewingToday = isSameDay(date, today)

  const week = useMemo(() => {
    const first = startOfWeek(date)
    return Array.from({ length: 7 }, (_, index) => addDays(first, index))
  }, [date])

  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [date])

  return (
    <section
      aria-label="Choose a day"
      className="surface mb-5 overflow-hidden px-3 pt-3 pb-3 sm:px-4"
    >
      {/* Month + jump controls */}
      <div className="mb-3 flex items-center gap-2 px-1">
        <div className="relative min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-base font-semibold text-slate-900">
            <CalendarDays className="size-4 shrink-0 text-slate-400" strokeWidth={2} />
            <span className="font-display">
              {MONTHS[date.getMonth()]} {date.getFullYear()}
            </span>
          </p>
          {/* An invisible native picker over the label: one tap reaches any
              date instead of stepping a week at a time. */}
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
            className="shrink-0 rounded-full bg-accent-50 px-3 py-1.5 text-xs font-bold tracking-wide text-accent-700 uppercase transition-colors duration-200 hover:bg-accent-100"
          >
            Today
          </button>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <StepButton
            label="Previous week"
            onClick={() => onChangeDate(addDays(date, -7))}
          >
            <ChevronLeft className="size-4" strokeWidth={2.5} />
          </StepButton>
          <StepButton label="Next week" onClick={() => onChangeDate(addDays(date, 7))}>
            <ChevronRight className="size-4" strokeWidth={2.5} />
          </StepButton>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 sm:gap-2"
      >
        {week.map((day) => {
          const selected = isSameDay(day, date)
          const isToday = isSameDay(day, today)
          const isSunday = day.getDay() === 0

          return (
            <button
              key={toDateKey(day)}
              ref={selected ? selectedRef : null}
              type="button"
              onClick={() => onChangeDate(day)}
              aria-current={selected ? 'date' : undefined}
              className={[
                'group relative flex min-w-[3.25rem] flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 transition-all duration-200 ease-in-out',
                selected
                  ? 'bg-slate-900 text-white shadow-sm'
                  : isSunday
                    ? 'text-slate-400 hover:bg-slate-100'
                    : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              <span
                className={[
                  'text-[10px] font-bold tracking-widest uppercase',
                  selected ? 'text-white/60' : 'text-slate-400',
                ].join(' ')}
              >
                <span className="sm:hidden">{DAY_INITIALS[day.getDay()]}</span>
                <span className="hidden sm:inline">{DAY_SHORT[day.getDay()]}</span>
              </span>
              <span
                className={[
                  'tnum text-lg leading-none font-semibold',
                  selected ? 'text-white' : 'text-slate-900',
                ].join(' ')}
              >
                {day.getDate()}
              </span>
              <span
                aria-hidden
                className={[
                  'size-1.5 rounded-full transition-colors duration-200',
                  isToday
                    ? selected
                      ? 'bg-accent-400'
                      : 'bg-accent-500'
                    : 'bg-transparent',
                ].join(' ')}
              />
            </button>
          )
        })}
      </div>
    </section>
  )
}

function StepButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-8 place-items-center rounded-full text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </button>
  )
}
