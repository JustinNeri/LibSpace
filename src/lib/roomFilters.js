/** Shared shape and predicates for the room filter bar. */
export const EMPTY_FILTERS = { minCapacity: 0, equipment: [], freeOnly: false }

export const CAPACITY_STEPS = [0, 6, 8, 10, 12]
export const EQUIPMENT_OPTIONS = ['Whiteboard', 'Display', 'Outlets']

export function filterRooms(rooms, filters, summaries) {
  return rooms.filter((room) => {
    if (room.capacity < filters.minCapacity) return false
    if (!filters.equipment.every((item) => room.equipment?.includes(item))) return false
    if (filters.freeOnly && (summaries?.get(room.id)?.free ?? 0) === 0) return false
    return true
  })
}

export function isFiltered(filters) {
  return filters.minCapacity > 0 || filters.equipment.length > 0 || filters.freeOnly
}
