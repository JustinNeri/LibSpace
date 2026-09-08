import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, Mail } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import AuthLayout, {
  AuthButton,
  IconField,
  Label,
  Steps,
  authField,
} from './AuthLayout'
import { STUDENT_EMAIL_DOMAIN, isEmailAddress, isGmailAddress } from '../lib/validation'

// Supabase's "Email OTP Length" is configurable from 6 to 10 digits, so the
// form accepts that whole range rather than assuming the default.
const MIN_CODE_LENGTH = 6
const MAX_CODE_LENGTH = 10
const RESEND_SECONDS = 60

/**
 * Login, registration and password recovery.
 *
 *   login     email + password
 *   register  Gmail -> emailed code -> (AccountSetup takes over)
 *   forgot    email -> emailed code -> (AccountSetup takes over)
 *
 * Verifying a code signs the user in. Choosing a password happens on the
 * next screen, which App mounts because `needsSetup` is true.
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

  /**
   * The screen's greeting, shown on the field above the card. Every mode
   * defines one, so the card itself is only ever the form.
   */
  const hero =
    step === 'code'
      ? {
          title: 'Check your inbox',
          subtitle: (
            <>
              We sent a code to{' '}
              <span className="font-semibold text-white">{email}</span>. It expires in
              one hour.
            </>
          ),
        }
      : mode === 'login'
        ? {
            title: 'Welcome back',
            subtitle: 'Find your space and get studying.',
          }
        : mode === 'register'
          ? {
              title: 'Create your account',
              subtitle: `Register with your ${STUDENT_EMAIL_DOMAIN} address. We'll email a code to verify it, then you pick a password.`,
            }
          : {
              title: 'Reset your password',
              subtitle: `We'll email a code so you can set a new password.`,
            }

  const footer =
    step === 'code' ? null : mode === 'login' ? (
      <>
        First time here?{' '}
        <FooterLink onClick={() => switchMode('register')}>Create an account</FooterLink>
      </>
    ) : mode === 'register' ? (
      <>
        Already registered?{' '}
        <FooterLink onClick={() => switchMode('login')}>Sign in</FooterLink>
      </>
    ) : null

  return (
    <AuthLayout hero={hero} footer={footer}>
      {step === 'code' ? (
        <form onSubmit={handleVerify} className="animate-slide-up">
          <Steps current={1} />

          <BackLink
            onClick={() => {
              setStep('form')
              setCode('')
              setError(null)
            }}
          >
            Use a different email
          </BackLink>

          <Label htmlFor="code">
            Access code
          </Label>
          <input
            id="code"
            ref={codeRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={MAX_CODE_LENGTH}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, '').slice(0, MAX_CODE_LENGTH))
            }
            placeholder="000000"
            className="tnum mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 text-center text-3xl font-bold tracking-[0.3em] text-slate-900 transition-colors duration-200 placeholder:text-slate-300 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20 focus:outline-none"
          />

          {error && <ErrorNote>{error}</ErrorNote>}

          <AuthButton busy={busy} busyLabel="Checking…">
            Verify code
            <ArrowRight className="size-4" strokeWidth={2.5} />
          </AuthButton>

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
          <Label htmlFor="email">Email</Label>
          <div className="mt-2">
            <IconField icon={Mail}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={`juan.delacruz@${STUDENT_EMAIL_DOMAIN}`}
                autoComplete="email"
                autoFocus
                className={`${authField} pl-11`}
              />
            </IconField>
          </div>

          <div className="mt-5 flex items-baseline justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="text-xs font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 transition-colors duration-200 hover:text-brand-800"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative mt-2">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className={`${authField} pr-12`}
            />
            <RevealButton shown={showPassword} onToggle={setShowPassword} />
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}

          <AuthButton busy={busy} busyLabel="Signing in…">
            Sign in
            <ArrowRight className="size-4" strokeWidth={2.5} />
          </AuthButton>
        </form>
      ) : (
        <form onSubmit={handleSendCode} className="animate-slide-up">
          {mode === 'register' && <Steps current={0} />}

          {mode === 'forgot' && (
            <BackLink onClick={() => switchMode('login')}>Back to sign in</BackLink>
          )}

          <Label htmlFor="email">
            {mode === 'register' ? 'Gmail address' : 'Email'}
          </Label>
          <div className="mt-2">
            <IconField icon={Mail}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={`juan.delacruz@${STUDENT_EMAIL_DOMAIN}`}
                autoComplete="email"
                autoFocus
                className={`${authField} pl-11`}
              />
            </IconField>
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}

          <AuthButton busy={busy} busyLabel="Sending…">
            Send access code
            <ArrowRight className="size-4" strokeWidth={2.5} />
          </AuthButton>
        </form>
      )}
    </AuthLayout>
  )
}

/* ---------------- pieces ---------------- */

function FooterLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors duration-200 hover:decoration-white"
    >
      {children}
    </button>
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
