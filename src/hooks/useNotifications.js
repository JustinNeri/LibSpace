import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './useAuth'

/**
 * The signed-in student's in-app inbox.
 *
 * Rows are written by a database trigger when an admin approves or rejects a
 * request, so the notice arrives even if the student had the tab closed.
 */
export function useNotifications() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) console.error('[LibSpace] Could not load notifications.', error)
    else setItems(data ?? [])

    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  /* ---------------- realtime ---------------- */
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        ({ new: row }) =>
          setItems((current) =>
            current.some((item) => item.id === row.id) ? current : [row, ...current],
          ),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const unreadCount = items.filter((item) => item.read_at === null).length

  const markRead = useCallback(async (id) => {
    const readAt = new Date().toISOString()
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read_at: readAt } : item)),
    )
    await supabase.from('notifications').update({ read_at: readAt }).eq('id', id)
  }, [])

  const markAllRead = useCallback(async () => {
    const unread = items.filter((item) => item.read_at === null).map((item) => item.id)
    if (unread.length === 0) return

    const readAt = new Date().toISOString()
    setItems((current) =>
      current.map((item) => (item.read_at ? item : { ...item, read_at: readAt })),
    )
    await supabase.from('notifications').update({ read_at: readAt }).in('id', unread)
  }, [items])

  return { items, unreadCount, loading, markRead, markAllRead, refresh: load }
}
