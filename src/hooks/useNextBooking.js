import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './useAuth'

/**
 * The signed-in student's own next booking, whatever day it falls on.
 *
 * The rooms screen is scoped to one day, so a reservation on Thursday is
 * invisible from Tuesday — which is exactly when a student wants reminding
 * that they already have a room. This asks the one extra question that day
 * cannot answer: what is next, and when.
 *
 * Pending counts. "Waiting on staff" is something you need to see before you
 * request a second room, not after.
 */
export function useNextBooking() {
  const { user } = useAuth()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) {
      setBooking(null)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('reservations')
      .select('*, rooms(name)')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved'])
      // Still running counts as next: a booking you are sitting in is the
      // one you most want a link to.
      .gt('end_time', new Date().toISOString())
      .order('start_time')
      .limit(1)
      .maybeSingle()

    if (error) console.error('[LibSpace] Could not load your next booking.', error)
    setBooking(error ? null : data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  /* Keep it honest while the tab is open: approvals land from the staff side,
     and a booking the student just made should appear without a reload. */
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`libspace:next-booking:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `user_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, load])

  return { booking, loading, refresh: load }
}
