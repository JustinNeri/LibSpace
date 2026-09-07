import { dateAtMinutes } from './time'

/**
 * Fallback data so the UI is explorable before Supabase is seeded.
 * Used only when the env vars are missing or the tables are empty.
 */
export const DEMO_ROOMS = [
  { id: 'demo-1', name: 'DR-101 · Quiet Study', capacity: 6, equipment: ['Whiteboard', 'Outlets'] },
  { id: 'demo-2', name: 'DR-102 · Collab Pod', capacity: 8, equipment: ['Display', 'Whiteboard', 'Outlets'] },
  { id: 'demo-3', name: 'DR-201 · Media Room', capacity: 10, equipment: ['Display', 'Outlets'] },
  { id: 'demo-4', name: 'DR-202 · Seminar', capacity: 12, equipment: ['Whiteboard', 'Display'] },
  { id: 'demo-5', name: 'DR-203 · Focus Booth', capacity: 4, equipment: ['Outlets'] },
]

export function demoReservations(dateKey) {
  const rows = [
    ['demo-1', 'Aira Santos', 9 * 60, 10 * 60, 4],
    ['demo-1', 'Miguel Reyes', 13 * 60, 14 * 60 + 30, 5],
    ['demo-2', 'Thesis Group C', 10 * 60 + 30, 12 * 60, 7],
    ['demo-3', 'Debate Society', 8 * 60, 9 * 60 + 30, 9],
    ['demo-3', 'Nina Villar', 15 * 60, 16 * 60, 3],
    ['demo-4', 'CS Capstone Team', 11 * 60, 13 * 60, 11],
    ['demo-5', 'Paolo Cruz', 14 * 60, 14 * 60 + 30, 2],
  ]

  return rows.map(([roomId, name, startMin, endMin, groupSize], index) => ({
    id: `demo-res-${index}`,
    room_id: roomId,
    student_name: name,
    student_id: `2024-${String(1000 + index)}`,
    group_size: groupSize,
    status: 'active',
    start_time: dateAtMinutes(dateKey, startMin).toISOString(),
    end_time: dateAtMinutes(dateKey, endMin).toISOString(),
  }))
}
