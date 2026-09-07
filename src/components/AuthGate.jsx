import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  LibraryBig,
  Loader2,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { STUDENT_EMAIL_DOMAIN, isGmailAddress } from '../lib/validation'

const CODE_LENGTH = 6
const RESEND_SECONDS = 60

/**
 * Sign-in / registration.
 *
 *   email  ->  6-digit code emailed  ->  session  ->  profile details
 *
 * Supabase creates the account on first verification, so there is no
 * separate "register" path for students.
 */
export default function AuthGate() {
  const { requestCode, verifyCode } = useAuth()

  const [step, setStep] = useState('email') // 'email' | 'code'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [cooldown, setCooldown] = useState(0)
  const codeRef = useRef(null)

  // Resend cooldown, so students do not hammer the mail rate limit.
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  const sendCode = async (event) => {
    event?.preventDefault()
    setError(null)

    if (!isGmailAddress(email)) {
      setError(`Please use a valid @${STUDENT_EMAIL_DOMAIN} address.`)
      return
    }

    setBusy(true)
    const { error: sendError } = await requestCode(email)
    setBusy(false)

    if (sendError) {
      setError(sendError.message)
      return
    }

    setStep('code')
    setCooldown(RESEND_SECONDS)
  }

  const submitCode = async (event) => {
    event.preventDefault()
    setError(null)

    if (code.trim().length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code from your email.`)
      return
    }

    setBusy(true)
    const { error: verifyError } = await verifyCode(email, code)
    setBusy(false)

    // On success the AuthProvider swaps this screen out for the app.
    if (verifyError) {
      setError(
        verifyError.message?.includes('expired')
          ? 'That code has expired. Send a new one.'
          : 'That code is not right. Check your email and try again.',
      )
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-slate-900 p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute -top-32 -right-24 size-96 rounded-full bg-brand-600/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 size-96 rounded-full bg-brand-500/20 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-900/40">
            <LibraryBig className="size-5" strokeWidth={2} />
          </span>
          <p className="text-sm font-semibold tracking-tight text-white">LibSpace</p>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            The logbook, retired.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Check which discussion rooms are free right now and reserve one before you
            walk over. No queueing at the front desk, no paper sign-up sheet.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Live availability across every room',
              'Book in half-hour blocks, up to 2 hours',
              'Cancel from your phone if plans change',
            ].map((line) => (
              <li key={line} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-600/20 text-brand-300">
                  <ShieldCheck className="size-3" strokeWidth={2.5} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          Campus Library · Discussion Room Reservations
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/25">
              <LibraryBig className="size-5" strokeWidth={2} />
            </span>
            <p className="text-sm font-semibold tracking-tight text-slate-900">LibSpace</p>
          </div>

          {step === 'email' ? (
            <form onSubmit={sendCode} className="animate-slide-up">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Sign in
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Enter your Gmail address and we'll email you a {CODE_LENGTH}-digit access
                code. New here? This creates your account.
              </p>

              <label className="mt-8 block text-sm font-medium text-slate-700">
                Gmail address
              </label>
              <div className="relative mt-1.5">
                <Mail
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
                  strokeWidth={2}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={`juan.delacruz@${STUDENT_EMAIL_DOMAIN}`}
                  autoComplete="email"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200/80 bg-white py-2.5 pr-3.5 pl-10 text-sm text-slate-900 shadow-sm transition-all duration-200 ease-in-out placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 focus:outline-none"
                />
              </div>

              {error && <ErrorNote>{error}</ErrorNote>}

              <SubmitButton busy={busy}>
                Send access code
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </SubmitButton>

              <p className="mt-6 text-center text-xs text-slate-400">
                Library staff sign in with the same form using their work address.
              </p>
            </form>
          ) : (
            <form onSubmit={submitCode} className="animate-slide-up">
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                }}
                className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-all duration-200 ease-in-out hover:-translate-x-0.5 hover:text-slate-900"
              >
                <ArrowLeft className="size-4" strokeWidth={2.5} />
                Use a different email
              </button>

              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Check your inbox
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                We sent a {CODE_LENGTH}-digit code to{' '}
                <span className="font-medium text-slate-900">{email}</span>. It expires in
                one hour.
              </p>

              <label className="mt-8 block text-sm font-medium text-slate-700">
                Access code
              </label>
              <input
                ref={codeRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
                }
                placeholder="000000"
                className="mt-1.5 w-full rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-slate-900 shadow-sm transition-all duration-200 ease-in-out placeholder:text-slate-300 hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 focus:outline-none"
              />

              {error && <ErrorNote>{error}</ErrorNote>}

              <SubmitButton busy={busy}>
                Verify and continue
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </SubmitButton>

              <button
                type="button"
                disabled={cooldown > 0 || busy}
                onClick={sendCode}
                className="mt-4 w-full text-center text-xs font-medium text-slate-500 transition-colors duration-200 hover:text-brand-600 disabled:pointer-events-none disabled:text-slate-300"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}

/* ---------- shared bits ---------- */

function ErrorNote({ children }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200/70 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md hover:shadow-brand-600/30 active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
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
