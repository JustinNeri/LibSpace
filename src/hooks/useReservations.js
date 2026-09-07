import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { DEMO_ROOMS, demoReservations } from '../lib/demoData'
import { dateAtMinutes, DAY_END_MIN, DAY_START_MIN } from '../lib/time'

/**
 * Loads rooms + the reservations for a single day, and keeps the day in
 * sync through a Supabase Realtime subscription.
 *
 * Falls back to demo data when Supabase is not configured yet, so the grid
 * is never a blank page during development.
 */
export function useReservations(dateKey) {
  const [rooms, setRooms] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [usingDemoData, setUsingDemoData] = useState(!isSupabaseConfigured)

  /** True when a row belongs to the day currently on screen. */
  const belongsToDay = useCallback(
    (row) => {
      if (!row?.start_time) return false
      const start = new Date(row.start_time)
      return (
        start >= dateAtMinutes(dateKey, DAY_START_MIN) &&
        start < dateAtMinutes(dateKey, DAY_END_MIN)
      )
    },
    [dateKey],
  )

  /* ---------- initial + per-date fetch ---------- */
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setRooms(DEMO_ROOMS)
          setReservations(demoReservations(dateKey))
          setUsingDemoData(true)
          setLoading(false)
        }
        return
      }

      const dayStart = dateAtMinutes(dateKey, DAY_START_MIN).toISOString()
      const dayEnd = dateAtMinutes(dateKey, DAY_END_MIN).toISOString()

      const [roomsResult, reservationsResult] = await Promise.all([
        supabase.from('rooms').select('*').order('name'),
        supabase
          .from('reservations')
          .select('*')
          .eq('status', 'active')
          .gte('start_time', dayStart)
          .lt('start_time', dayEnd),
      ])

      if (cancelled) return

      if (roomsResult.error || reservationsResult.error) {
        console.error(
          '[LibSpace] Supabase fetch failed — falling back to demo data.',
          roomsResult.error ?? reservationsResult.error,
        )
        setRooms(DEMO_ROOMS)
        setReservations(demoReservations(dateKey))
        setUsingDemoData(true)
        setLoading(false)
        return
      }

      const fetchedRooms = roomsResult.data ?? []
      if (fetchedRooms.length === 0) {
        // Tables exist but are empty — demo data keeps the UI meaningful.
        setRooms(DEMO_ROOMS)
        setReservations(demoReservations(dateKey))
        setUsingDemoData(true)
      } else {
        setRooms(fetchedRooms)
        setReservations(reservationsResult.data ?? [])
        setUsingDemoData(false)
      }

      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [dateKey])

  /* ---------- realtime ---------- */
  useEffect(() => {
    if (!isSupabaseConfigured || usingDemoData) return

    const channel = supabase
      .channel(`reservations:${dateKey}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reservations' },
        ({ new: row }) => {
          if (row.status !== 'active' || !belongsToDay(row)) return
          setReservations((current) =>
            current.some((item) => item.id === row.id) ? current : [...current, row],
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reservations' },
        ({ new: row }) => {
          setReservations((current) => {
            const withoutRow = current.filter((item) => item.id !== row.id)
            const stillVisible = row.status === 'active' && belongsToDay(row)
            return stillVisible ? [...withoutRow, row] : withoutRow
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reservations' },
        ({ old: row }) => {
          setReservations((current) => current.filter((item) => item.id !== row.id))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [dateKey, usingDemoData, belongsToDay])

  /* ---------- writes ---------- */
  const createReservation = useCallback(
    async ({ room, dateKey: day, startMin, endMin, studentName, studentId, groupSize, purpose }) => {
      const payload = {
        room_id: room.id,
        student_name: studentName,
        student_id: studentId,
        group_size: groupSize,
        purpose: purpose || null,
        status: 'active',
        start_time: dateAtMinutes(day, startMin).toISOString(),
        end_time: dateAtMinutes(day, endMin).toISOString(),
      }

      if (!isSupabaseConfigured || usingDemoData) {
        const optimistic = { ...payload, id: `local-${crypto.randomUUID()}` }
        setReservations((current) => [...current, optimistic])
        return { data: optimistic, error: null }
      }

      const { data, error } = await supabase
        .from('reservations')
        .insert(payload)
        .select()
        .single()

      // The realtime INSERT handler dedupes, so adding here is safe and
      // makes the booking feel instant even on a slow socket.
      if (!error && data) {
        setReservations((current) =>
          current.some((item) => item.id === data.id) ? current : [...current, data],
        )
      }

      return { data, error }
    },
    [usingDemoData],
  )

  return { rooms, reservations, loading, usingDemoData, createReservation }
}
