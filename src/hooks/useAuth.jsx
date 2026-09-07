import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { STUDENT_EMAIL_DOMAIN, isGmailAddress } from '../lib/validation'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  /* ---------------- session bootstrap ---------------- */
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      if (!data.session) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null)
      if (!next) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  /* ---------------- profile follows the session ---------------- */
  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[LibSpace] Could not load profile.', error)
      return null
    }
    return data
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!session?.user) return

    setLoading(true)
    loadProfile(session.user.id).then((row) => {
      if (cancelled) return
      setProfile(row)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [session, loadProfile])

  /* ---------------- actions ---------------- */

  /** Email the 6-digit access code. Creates the account on first use. */
  const requestCode = useCallback(async (email) => {
    const address = email.trim().toLowerCase()

    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase is not configured.' } }
    }
    if (!isGmailAddress(address)) {
      return {
        error: { message: `Please use a valid @${STUDENT_EMAIL_DOMAIN} address.` },
      }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    })

    return { error }
  }, [])

  /** Exchange the emailed code for a session. */
  const verifyCode = useCallback(async (email, token) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    })

    if (!error && data.session) setSession(data.session)
    return { data, error }
  }, [])

  /** Fill in name + student number after the first sign-in. */
  const completeProfile = useCallback(
    async ({ fullName, studentId }) => {
      if (!session?.user) return { error: { message: 'Not signed in.' } }

      const { data, error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), student_id: studentId.trim() })
        .eq('id', session.user.id)
        .select()
        .single()

      if (!error && data) setProfile(data)
      return { data, error }
    },
    [session],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAuthenticated: Boolean(session?.user),
      isAdmin: profile?.role === 'admin',
      needsProfile: Boolean(session?.user) && profile !== null && !profile.full_name,
      requestCode,
      verifyCode,
      completeProfile,
      signOut,
    }),
    [session, profile, loading, requestCode, verifyCode, completeProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
