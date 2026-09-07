import { SlidersHorizontal, X } from 'lucide-react'
import {
  CAPACITY_STEPS,
  EMPTY_FILTERS,
  EQUIPMENT_OPTIONS,
  isFiltered,
} from '../lib/roomFilters'

/** Narrow ten rooms down to the ones a group can actually use. */
export default function RoomFilters({ filters, onChange, matchCount, totalCount }) {
  const toggleEquipment = (item) =>
    onChange({
      ...filters,
      equipment: filters.equipment.includes(item)
        ? filters.equipment.filter((value) => value !== item)
        : [...filters.equipment, item],
    })

  return (
    <div className="surface mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
        <SlidersHorizontal className="size-3.5" strokeWidth={2.5} />
        Filter
      </span>

      {/* Capacity */}
      <div className="flex items-center gap-1.5">
        {CAPACITY_STEPS.map((size) => (
          <Chip
            key={size}
            active={filters.minCapacity === size}
            onClick={() => onChange({ ...filters, minCapacity: size })}
          >
            {size === 0 ? `Any size` : `${size}+`}
          </Chip>
        ))}
      </div>

      <span className="hidden h-5 w-px bg-slate-200 sm:block" />

      {/* Equipment */}
      <div className="flex flex-wrap items-center gap-1.5">
        {EQUIPMENT_OPTIONS.map((item) => (
          <Chip
            key={item}
            active={filters.equipment.includes(item)}
            onClick={() => toggleEquipment(item)}
          >
            {item}
          </Chip>
        ))}
      </div>

      <span className="hidden h-5 w-px bg-slate-200 sm:block" />

      <Chip
        active={filters.freeOnly}
        onClick={() => onChange({ ...filters, freeOnly: !filters.freeOnly })}
      >
        Has free time
      </Chip>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-slate-500">
          <span className="tnum font-semibold text-slate-900">{matchCount}</span> of{' '}
          {totalCount} rooms
        </span>
        {isFiltered(filters) && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-3" strokeWidth={3} />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ease-in-out',
        active
          ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
