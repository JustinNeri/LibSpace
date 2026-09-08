import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LibraryBig,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { STUDENT_EMAIL_DOMAIN, isEmailAddress, isGmailAddress } from '../lib/validation'
import { LIBRARY_NAME, UNIVERSITY_NAME } from '../lib/constants'

// Supabase's "Email OTP Length" is configurable from 6 to 10 digits, so the
// form accepts that whole range rather than assuming the default.
const MIN_CODE_LENGTH = 6
const MAX_CODE_LENGTH = 10
const RESEND_SECONDS = 60

/** What the rubber stamp in the card header reads, per screen. */
const STAMP = {
  login: 'Sign in',
  register: 'New card',
  forgot: 'Recover',
  code: 'Verify',
}

/**
 * Login, registration and password recovery.
 *
 *   login     email + password
 *   register  Gmail -> emailed code -> (AccountSetup takes over)
 *   forgot    email -> emailed code -> (AccountSetup takes over)
 *
 * Verifying a code signs the user in. Choosing a password happens on the
 * next screen, which App mounts because `needsSetup` is true.
 *
 * The screen is dressed as a borrower's card on a ruled page, because that
 * is the object this whole app replaces. It is a single centred column at
 * every width — the old split panel spent half a desktop screen on
 * decoration and collapsed to nothing on a phone.
 */
export default function AuthGate() {
  const { signIn, requestCode, verifyCode, beginPasswordReset } = useAuth()

  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot'
  const [step, setStep] = useState('form') // 'form' | 'code'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [cooldown, setCooldown] = useState(0)
  const codeRef = useRef(null)

  // Resend cooldown, so students do not burn through the mail rate limit.
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  const switchMode = (next) => {
    setMode(next)
    setStep('form')
    setCode('')
    setPassword('')
    setError(null)
  }

  /* ---------------- actions ---------------- */

  const handleLogin = async (event) => {
    event.preventDefault()
    setError(null)

    if (!isEmailAddress(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }

    setBusy(true)
    const { error: signInError } = await signIn(email, password)
    setBusy(false)

    if (signInError) {
      setError(
        signInError.message?.includes('Invalid login credentials')
          ? 'Wrong email or password. If you have not set a password yet, create your account below.'
          : signInError.message,
      )
    }
  }

  const handleSendCode = async (event) => {
    event?.preventDefault()
    setError(null)

    const isNewAccount = mode === 'register'

    if (isNewAccount && !isGmailAddress(email)) {
      setError(`Registration requires a valid @${STUDENT_EMAIL_DOMAIN} address.`)
      return
    }
    if (!isNewAccount && !isEmailAddress(email)) {
      setError('Enter a valid email address.')
      return
    }

    setBusy(true)
    const { error: sendError } = await requestCode(email, isNewAccount)
    setBusy(false)

    if (sendError) {
      setError(
        sendError.message?.toLowerCase().includes('signups not allowed')
          ? 'No account uses that email. Create one instead.'
          : sendError.message,
      )
      return
    }

    setStep('code')
    setCooldown(RESEND_SECONDS)
  }

  const handleVerify = async (event) => {
    event.preventDefault()
    setError(null)

    if (code.trim().length < MIN_CODE_LENGTH) {
      setError('That code looks too short — check your email and retype it.')
      return
    }

    // Flag recovery before the session lands, so App routes to the
    // password screen instead of straight into the workspace.
    if (mode === 'forgot') beginPasswordReset()

    setBusy(true)
    const { error: verifyError } = await verifyCode(email, code)
    setBusy(false)

    // On success App swaps this screen for AccountSetup.
    if (verifyError) {
      setError(
        verifyError.message?.includes('expired')
          ? 'That code has expired. Send a new one.'
          : 'That code is not right. Check your email and try again.',
      )
    }
  }

  /* ---------------- render ---------------- */

  return (
    <div className="ruled-paper flex min-h-screen flex-col px-5 py-8 sm:px-6 sm:py-10">
      <main className="flex flex-1 flex-col items-center justify-center gap-7 py-6">
        {/* Masthead */}
        <div className="flex items-center justify-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
            <LibraryBig className="size-5" strokeWidth={2} />
          </span>
          <div>
            <p className="font-display text-lg leading-tight font-semibold text-slate-900">
              LibSpace
            </p>
            <p className="text-[11px] tracking-wide text-slate-500">{UNIVERSITY_NAME}</p>
          </div>
        </div>

        <div className="relative w-full max-w-[27rem]">
          {/* The card underneath, so this reads as one card off a stack. */}
          <span
            aria-hidden
            className="absolute inset-x-4 -bottom-2 h-16 rounded-2xl border border-slate-200 bg-white/60"
          />

          <div className="relative overflow-hidden rounded-2xl border border-slate-300/90 bg-white shadow-[0_20px_44px_-28px_oklch(0.228_0.014_64/0.55)]">
            {/* Card header — the printed part of a borrower's card. */}
            <div className="flex items-center justify-between gap-3 border-b border-dashed border-slate-300 px-6 py-3.5">
              <p className="truncate text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                {LIBRARY_NAME}
                {/* The letterspacing that makes this read as printed also
                    makes it too long for a 390px card. */}
                <span className="hidden sm:inline"> · Discussion rooms</span>
              </p>
              <span className="stamp shrink-0 -rotate-3">
                {step === 'code' ? STAMP.code : STAMP[mode]}
              </span>
            </div>

            <div className="px-6 py-7 sm:px-8">
              {step === 'code' ? (
                <form onSubmit={handleVerify} className="animate-slide-up">
                  <BackLink
                    onClick={() => {
                      setStep('form')
                      setCode('')
                      setError(null)
                    }}
                  >
                    Use a different email
                  </BackLink>

                  <h1 className="text-2xl font-semibold text-slate-900">
                    Check your inbox
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    We sent an access code to{' '}
                    <span className="font-semibold text-slate-900">{email}</span>. It
                    expires in one hour.
                  </p>

                  <Label htmlFor="code">Access code</Label>
                  <input
                    id="code"
                    ref={codeRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={MAX_CODE_LENGTH}
                    value={code}
                    onChange={(event) =>
                      setCode(
                        event.target.value.replace(/\D/g, '').slice(0, MAX_CODE_LENGTH),
                      )
                    }
                    placeholder="000000"
                    className="tnum w-full rounded-xl border border-slate-300 bg-slate-50/60 px-4 py-3.5 text-center text-2xl font-semibold tracking-[0.35em] text-slate-900 transition-colors duration-200 placeholder:text-slate-300 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/15 focus:outline-none"
                  />

                  {error && <ErrorNote>{error}</ErrorNote>}

                  <SubmitButton busy={busy}>
                    Verify code
                    <ArrowRight className="size-4" strokeWidth={2.5} />
                  </SubmitButton>

                  <button
                    type="button"
                    disabled={cooldown > 0 || busy}
                    onClick={handleSendCode}
                    className="tnum mt-4 w-full text-center text-xs font-semibold text-slate-500 transition-colors duration-200 hover:text-brand-700 disabled:pointer-events-none disabled:text-slate-300"
                  >
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </button>
                </form>
              ) : mode === 'login' ? (
                <form onSubmit={handleLogin} className="animate-slide-up">
                  <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Sign in to reserve a discussion room.
                  </p>

                  <Label htmlFor="email">Email</Label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={`juan.delacruz@${STUDENT_EMAIL_DOMAIN}`}
                    autoComplete="email"
                    autoFocus
                    className={fieldClass}
                  />

                  <div className="mt-5 flex items-baseline justify-between gap-3">
                    <label
                      htmlFor="password"
                      className="text-[11px] font-bold tracking-[0.14em] text-slate-500 uppercase"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 transition-colors duration-200 hover:text-brand-800"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative mt-1.5">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className={`${fieldClass} mt-0 pr-12`}
                    />
                    <RevealButton shown={showPassword} onToggle={setShowPassword} />
                  </div>

                  {error && <ErrorNote>{error}</ErrorNote>}

                  <SubmitButton busy={busy}>
                    Sign in
                    <ArrowRight className="size-4" strokeWidth={2.5} />
                  </SubmitButton>

                  <p className="mt-6 border-t border-dashed border-slate-200 pt-5 text-center text-sm text-slate-500">
                    First time here?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 transition-colors duration-200 hover:text-brand-800"
                    >
                      Get your card
                    </button>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleSendCode} className="animate-slide-up">
                  {mode === 'forgot' && (
                    <BackLink onClick={() => switchMode('login')}>
                      Back to sign in
                    </BackLink>
                  )}

                  <h1 className="text-2xl font-semibold text-slate-900">
                    {mode === 'register' ? 'Create your account' : 'Reset your password'}
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {mode === 'register'
                      ? `Register with your ${STUDENT_EMAIL_DOMAIN} address. We'll email an access code to verify it, then you pick your own password.`
                      : `We'll email an access code so you can set a new password.`}
                  </p>

                  <Label htmlFor="email">
                    {mode === 'register' ? 'Gmail address' : 'Email'}
                  </Label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={`juan.delacruz@${STUDENT_EMAIL_DOMAIN}`}
                    autoComplete="email"
                    autoFocus
                    className={fieldClass}
                  />

                  {error && <ErrorNote>{error}</ErrorNote>}

                  <SubmitButton busy={busy}>
                    Send access code
                    <ArrowRight className="size-4" strokeWidth={2.5} />
                  </SubmitButton>

                  {mode === 'register' && (
                    <p className="mt-6 border-t border-dashed border-slate-200 pt-5 text-center text-sm text-slate-500">
                      Already registered?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 transition-colors duration-200 hover:text-brand-800"
                      >
                        Sign in
                      </button>
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <p className="text-center text-[11px] tracking-wide text-slate-400">
        {UNIVERSITY_NAME} · {LIBRARY_NAME}
      </p>
    </div>
  )
}

/* ---------------- pieces ---------------- */

function Label({ htmlFor, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mt-5 block text-[11px] font-bold tracking-[0.14em] text-slate-500 uppercase"
    >
      {children}
    </label>
  )
}

function RevealButton({ shown, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!shown)}
      aria-label={shown ? 'Hide password' : 'Show password'}
      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2.5 text-slate-400 transition-colors duration-200 hover:text-slate-900"
    >
      {shown ? (
        <EyeOff className="size-4" strokeWidth={2} />
      ) : (
        <Eye className="size-4" strokeWidth={2} />
      )}
    </button>
  )
}

function BackLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-all duration-200 ease-in-out hover:-translate-x-0.5 hover:text-slate-900"
    >
      <ArrowLeft className="size-4" strokeWidth={2.5} />
      {children}
    </button>
  )
}

function ErrorNote({ children }) {
  return (
    <div
      role="alert"
      className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-800"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      <p>{children}</p>
    </div>
  )
}

function SubmitButton({ busy, children }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3.5 text-sm font-bold tracking-wide text-white transition-colors duration-200 hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-60"
    >
      {busy ? (
        <>
          <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
          Working…
        </>
      ) : (
        children
      )}
    </button>
  )
}

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50/60 px-4 py-3 text-sm text-slate-900 transition-colors duration-200 placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/15 focus:outline-none'
