import { useState } from 'react'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import {
  CAPACITY_STEPS,
  EMPTY_FILTERS,
  EQUIPMENT_OPTIONS,
  isFiltered,
} from '../lib/roomFilters'

/**
 * Narrow ten rooms down to the ones a group can actually use.
 *
 * The chips sit on one line that scrolls sideways on a phone — wrapping them
 * turned a control strip into a four-row block above the rooms. From `lg`
 * they wrap onto one or two lines as normal.
 */
export default function RoomFilters({ filters, onChange, matchCount, totalCount }) {
  // Closed by default on a phone: an untouched filter strip was a whole band
  // of chrome above the rooms, every visit.
  const [open, setOpen] = useState(false)
  const active = isFiltered(filters)

  const toggleEquipment = (item) =>
    onChange({
      ...filters,
      equipment: filters.equipment.includes(item)
        ? filters.equipment.filter((value) => value !== item)
        : [...filters.equipment, item],
    })

  return (
    <div className="surface mb-4 px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-slate-500 uppercase lg:pointer-events-none"
        >
          <SlidersHorizontal className="size-3.5" strokeWidth={2.5} />
          Filter
          {active && (
            <span className="rounded-full bg-brand-600 px-1.5 text-[10px] text-white">
              on
            </span>
          )}
          <ChevronDown
            className={[
              'size-3.5 transition-transform duration-200 lg:hidden',
              open ? 'rotate-180' : '',
            ].join(' ')}
            strokeWidth={2.5}
          />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            <span className="tnum font-semibold text-slate-900">{matchCount}</span> of{' '}
            {totalCount}
          </span>
          {isFiltered(filters) && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-3" strokeWidth={3} />
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        className={[
          'scrollbar-none -mx-3 mt-2.5 items-center gap-1.5 overflow-x-auto px-3',
          'lg:mx-0 lg:flex lg:flex-wrap lg:gap-2 lg:overflow-visible lg:px-0',
          open ? 'flex' : 'hidden',
        ].join(' ')}
      >
        {CAPACITY_STEPS.map((size) => (
          <Chip
            key={size}
            active={filters.minCapacity === size}
            onClick={() => onChange({ ...filters, minCapacity: size })}
          >
            {size === 0 ? 'Any size' : `${size}+`}
          </Chip>
        ))}

        <Divider />

        {EQUIPMENT_OPTIONS.map((item) => (
          <Chip
            key={item}
            active={filters.equipment.includes(item)}
            onClick={() => toggleEquipment(item)}
          >
            {item}
          </Chip>
        ))}

        <Divider />

        <Chip
          active={filters.freeOnly}
          onClick={() => onChange({ ...filters, freeOnly: !filters.freeOnly })}
        >
          Has free time
        </Chip>
      </div>
    </div>
  )
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-slate-200" />
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-200',
        active
          ? 'bg-brand-700 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
