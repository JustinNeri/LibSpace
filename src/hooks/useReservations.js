import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { dateAtMinutes, fromDateKey, windowForWeekday } from '../lib/time'

/**
 * Natural ordering, so DR-2 comes before DR-10 rather than after it.
 * Plain alphabetical sorting compares "1" against "2" and gets this wrong.
 */
/** Private bucket holding one student-ID photo per group member. */
const ID_BUCKET = 'reservation-ids'

const byRoomName = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
}).compare

/**
 * Everything the grid needs for one day: rooms, the admin-set opening hours,
 * one-off blocks, and the day's active reservations — kept live through a
 * Supabase Realtime subscription.
 */
export function useReservations(dateKey) {
  const [rooms, setRooms] = useState([])
  const [schedules, setSchedules] = useState([])
  const [blocks, setBlocks] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const weekday = useMemo(() => fromDateKey(dateKey).getDay(), [dateKey])
  const dayWindow = useMemo(
    () => windowForWeekday(schedules, weekday),
    [schedules, weekday],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    // Blocks and reservations are fetched across the whole calendar day, not
    // just the visible window, so a block starting before opening still shows.
    const dayStart = dateAtMinutes(dateKey, 0).toISOString()
    const dayEnd = dateAtMinutes(dateKey, 24 * 60).toISOString()

    const [roomsResult, schedulesResult, blocksResult, reservationsResult] =
      await Promise.all([
        supabase.from('rooms').select('*').eq('is_active', true),
        supabase.from('room_schedules').select('*'),
        supabase
          .from('room_blocks')
          .select('*')
          .lt('start_time', dayEnd)
          .gt('end_time', dayStart),
        supabase
          .from('reservations')
          .select('*')
          .eq('status', 'active')
          .lt('start_time', dayEnd)
          .gt('end_time', dayStart),
      ])

    const failure =
      roomsResult.error ??
      schedulesResult.error ??
      blocksResult.error ??
      reservationsResult.error

    if (failure) {
      console.error('[LibSpace] Load failed.', failure)
      setLoadError(failure.message)
      setLoading(false)
      return
    }

    setRooms([...(roomsResult.data ?? [])].sort((a, b) => byRoomName(a.name, b.name)))
    setSchedules(schedulesResult.data ?? [])
    setBlocks(blocksResult.data ?? [])
    setReservations(reservationsResult.data ?? [])
    setLoading(false)
  }, [dateKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  /* ---------------- realtime ---------------- */
  useEffect(() => {
    const sameDay = (row) => {
      if (!row?.start_time) return false
      const start = new Date(row.start_time)
      return (
        start >= dateAtMinutes(dateKey, 0) && start < dateAtMinutes(dateKey, 24 * 60)
      )
    }

    const upsert = (setter) => (row, visible) =>
      setter((current) => {
        const without = current.filter((item) => item.id !== row.id)
        return visible ? [...without, row] : without
      })

    const upsertReservation = upsert(setReservations)
    const upsertBlock = upsert(setBlocks)

    const channel = supabase
      .channel(`libspace:${dateKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        ({ eventType, new: row, old }) => {
          if (eventType === 'DELETE') {
            setReservations((current) => current.filter((item) => item.id !== old.id))
            return
          }
          upsertReservation(row, row.status === 'active' && sameDay(row))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_blocks' },
        ({ eventType, new: row, old }) => {
          if (eventType === 'DELETE') {
            setBlocks((current) => current.filter((item) => item.id !== old.id))
            return
          }
          upsertBlock(row, sameDay(row))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [dateKey])

  /* ---------------- writes ---------------- */

  /**
   * Upload the ID photos, then insert the booking.
   *
   * Photos go first because the reservation row references them, and the
   * uploads are removed again if the insert is rejected — otherwise a
   * double-booking would leave orphaned files behind.
   */
  const createReservation = useCallback(
    async ({
      room,
      dateKey: day,
      startMin,
      endMin,
      studentName,
      studentId,
      groupSize,
      purpose,
      userId,
      photos = [],
      onProgress,
    }) => {
      const folder = `${userId}/${crypto.randomUUID()}`
      const uploaded = []

      for (const [index, file] of photos.entries()) {
        onProgress?.(`Uploading ID ${index + 1} of ${photos.length}…`)

        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${folder}/${index + 1}.${extension}`

        const { error: uploadError } = await supabase.storage
          .from(ID_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false })

        if (uploadError) {
          if (uploaded.length > 0) {
            await supabase.storage.from(ID_BUCKET).remove(uploaded)
          }
          return { data: null, error: uploadError }
        }
        uploaded.push(path)
      }

      onProgress?.('Saving reservation…')

      const { data, error } = await supabase
        .from('reservations')
        .insert({
          room_id: room.id,
          user_id: userId,
          student_name: studentName,
          student_id: studentId,
          group_size: groupSize,
          purpose: purpose || null,
          id_photos: uploaded,
          status: 'active',
          start_time: dateAtMinutes(day, startMin).toISOString(),
          end_time: dateAtMinutes(day, endMin).toISOString(),
        })
        .select()
        .single()

      if (error) {
        if (uploaded.length > 0) {
          await supabase.storage.from(ID_BUCKET).remove(uploaded)
        }
        return { data: null, error }
      }

      // Realtime will echo this back; adding it now keeps the UI instant.
      setReservations((current) =>
        current.some((item) => item.id === data.id) ? current : [...current, data],
      )

      return { data, error: null }
    },
    [],
  )

  const cancelReservation = useCallback(async (id) => {
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (!error) {
      setReservations((current) => current.filter((item) => item.id !== id))
    }
    return { error }
  }, [])

  return {
    rooms,
    schedules,
    blocks,
    reservations,
    dayWindow,
    weekday,
    loading,
    loadError,
    refresh,
    createReservation,
    cancelReservation,
  }
}
