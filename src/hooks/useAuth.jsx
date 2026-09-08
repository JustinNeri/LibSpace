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
import { forgetView } from '../lib/nav'
import { formatFullName } from '../lib/constants'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Set when the user came in through "forgot password": they hold a valid
  // session from the OTP, but must choose a new password before continuing.
  const [resetRequested, setResetRequested] = useState(false)

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

  /**
   * Keyed on the user's id, deliberately — not on the session object.
   *
   * Supabase refreshes the token whenever the tab regains focus and fires
   * `onAuthStateChange` with a fresh session object every time. Depending on
   * that object meant this effect re-ran on every alt-tab, flipped `loading`
   * back to true, and `Routes` swapped the whole workspace for the spinner —
   * unmounting it and throwing away which view you were on, the day you were
   * looking at and any filters. The id only changes when the user actually
   * changes, which is the only time the profile needs fetching again.
   */
  const userId = session?.user?.id ?? null

  useEffect(() => {
    let cancelled = false
    if (!userId) return

    setLoading(true)
    loadProfile(userId).then((row) => {
      if (cancelled) return
      setProfile(row)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [userId, loadProfile])

  /* ---------------- sign in ---------------- */

  /** Returning users: email + the password they set on this app. */
  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (!error && data.session) setSession(data.session)
    return { error }
  }, [])

  /* ---------------- OTP verification ---------------- */

  /**
   * Email a 6-digit code.
   * @param {boolean} isNewAccount  false for password recovery, so the code
   *                                is not sent to an address with no account.
   */
  const requestCode = useCallback(async (email, isNewAccount = true) => {
    const address = email.trim().toLowerCase()

    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase is not configured.' } }
    }
    if (isNewAccount && !isGmailAddress(address)) {
      return {
        error: { message: `Please use a valid @${STUDENT_EMAIL_DOMAIN} address.` },
      }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: isNewAccount },
    })

    return { error }
  }, [])

  /**
   * Exchange the emailed code for a session.
   *
   * Which template Supabase sent decides the token type: a brand-new sign-up
   * with "Confirm email" enabled issues a `signup` token, everything else an
   * `email` one. Trying both keeps registration working under either project
   * setting instead of depending on a dashboard toggle.
   */
  const verifyCode = useCallback(async (email, token) => {
    const address = email.trim().toLowerCase()
    const code = token.trim()

    let { data, error } = await supabase.auth.verifyOtp({
      email: address,
      token: code,
      type: 'email',
    })

    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email: address,
        token: code,
        type: 'signup',
      })
      // Only prefer the retry when it actually succeeded, so a genuinely
      // wrong code still reports the first, more accurate error.
      if (!retry.error) ({ data, error } = retry)
    }

    if (!error && data.session) setSession(data.session)
    return { data, error }
  }, [])

  const beginPasswordReset = useCallback(() => setResetRequested(true), [])

  /* ---------------- account setup ---------------- */

  /**
   * Store the password the user chose, plus their details on first setup.
   * `has_password` is what keeps them out of this screen next time.
   *
   * Recovery passes only `password`, so the profile fields are left alone.
   */
  const completeAccount = useCallback(
    async ({
      password,
      lastName,
      firstName,
      middleInitial,
      studentId,
      yearLevel,
      course,
    }) => {
      if (!session?.user) return { error: { message: 'Not signed in.' } }

      const { error: passwordError } = await supabase.auth.updateUser({ password })

      // "Same as the old password" means the password is already what the
      // user wants — that happens when an earlier attempt set it but failed
      // before the profile saved. Treat it as done and carry on, otherwise
      // a retry can never succeed.
      const alreadySet = passwordError?.message
        ?.toLowerCase()
        .includes('should be different from the old password')

      if (passwordError && !alreadySet) return { error: passwordError }

      const patch = { has_password: true }

      if (lastName !== undefined) {
        patch.last_name = lastName.trim()
        patch.first_name = (firstName ?? '').trim()
        patch.middle_initial = (middleInitial ?? '').trim().toUpperCase()
        // Rendered once here so every read site can just use full_name.
        patch.full_name = formatFullName({ lastName, firstName, middleInitial })
      }
      if (studentId !== undefined) patch.student_id = studentId.trim()
      if (yearLevel !== undefined) patch.year_level = yearLevel
      if (course !== undefined) patch.course = course

      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          { id: session.user.id, email: session.user.email, ...patch },
          { onConflict: 'id' },
        )
        .select()
        .single()

      if (!error && data) {
        setProfile(data)
        setResetRequested(false)
      }
      return { data, error }
    },
    [session],
  )

  /** Re-read the profile after the user edits it in settings. */
  const refreshProfile = useCallback(async () => {
    if (!session?.user) return
    const row = await loadProfile(session.user.id)
    if (row) setProfile(row)
  }, [session, loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setResetRequested(false)
    // The remembered view belongs to the session, not to the tab. Leaving it
    // behind opens the next person's workspace on the last screen this one
    // was looking at.
    forgetView()
  }, [])

  const value = useMemo(() => {
    const authenticated = Boolean(session?.user)
    // Anyone without a password or a name still owes us a step. A missing
    // profile row counts too — account setup upserts it, so sending them
    // there repairs the account instead of dropping them into a workspace
    // that has nothing to work with.
    const needsSetup =
      authenticated &&
      !loading &&
      (profile === null || !profile.has_password || !profile.last_name)

    return {
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAuthenticated: authenticated,
      isAdmin: profile?.role === 'admin',
      needsSetup: needsSetup || (authenticated && resetRequested),
      resetRequested,
      signIn,
      requestCode,
      verifyCode,
      beginPasswordReset,
      completeAccount,
      refreshProfile,
      signOut,
    }
  }, [
    session,
    profile,
    loading,
    resetRequested,
    signIn,
    requestCode,
    verifyCode,
    beginPasswordReset,
    completeAccount,
    refreshProfile,
    signOut,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
