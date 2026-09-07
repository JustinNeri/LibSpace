import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export const DEFAULT_RULES = {
  no_show_grace_minutes: 15,
  max_active_bookings: 2,
  max_hours_per_day: 4,
  advance_days: 14,
}

/**
 * Library rules — grace period, booking caps, how far ahead booking opens.
 *
 * Stored in one row so staff can change policy without a deploy. The same
 * values are enforced again by a database trigger, so this copy is only for
 * showing students the limits before they hit them.
 */
export function useSettings() {
  const [rules, setRules] = useState(DEFAULT_RULES)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (error) console.error('[LibSpace] Could not load rules.', error)
    else if (data) setRules(data)

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = useCallback(async (patch) => {
    const { data, error } = await supabase
      .from('app_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .single()

    if (!error && data) setRules(data)
    return { data, error }
  }, [])

  return { rules, loading, save, refresh: load }
}
