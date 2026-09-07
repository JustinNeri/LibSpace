import { useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { MIN_PASSWORD_LENGTH, passwordProblem } from '../lib/validation'

/**
 * Shown after a verified access code — the point where the user chooses
 * their own LibSpace password.
 *
 * Two shapes:
 *   registration  name + student number + password
 *   recovery      password only (the profile is already filled in)
 */
export default function AccountSetup() {
  const { user, profile, resetRequested, completeAccount, signOut } = useAuth()

  const isRecovery = resetRequested && Boolean(profile?.full_name)

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [studentId, setStudentId] = useState(profile?.student_id ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const problem = password ? passwordProblem(password) : null
  const mismatch = confirm.length > 0 && confirm !== password

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (!isRecovery && (!fullName.trim() || !studentId.trim())) {
      setError('Your name and student number are required.')
      return
    }

    const passwordIssue = passwordProblem(password)
    if (passwordIssue) {
      setError(passwordIssue)
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }

    setBusy(true)
    const { error: saveError } = await completeAccount(
      isRecovery ? { password } : { password, fullName, studentId },
    )
    setBusy(false)

    if (saveError) setError(saveError.message)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-sm animate-slide-up">
        <span className="grid size-11 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/25">
          {isRecovery ? (
            <Lock className="size-5" strokeWidth={2} />
          ) : (
            <UserRound className="size-5" strokeWidth={2} />
          )}
        </span>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">
          {isRecovery ? 'Set a new password' : 'Finish your account'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Email verified as <span className="font-medium text-slate-900">{user?.email}</span>.
          {isRecovery
            ? ' Choose a new password to finish.'
            : ' Choose a password you will use to sign in from now on.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {!isRecovery && (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Juan Dela Cruz"
                  autoComplete="name"
                  autoFocus
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Student number
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  placeholder="2024-00123"
                  className={fieldClass}
                />
              </div>
            </>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                autoFocus={isRecovery}
                className={`${fieldClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:text-slate-700"
              >
                {showPassword ? (
                  <EyeOff className="size-4" strokeWidth={2} />
                ) : (
                  <Eye className="size-4" strokeWidth={2} />
                )}
              </button>
            </div>

            <p
              className={[
                'mt-1.5 text-xs',
                problem ? 'font-medium text-amber-600' : 'text-slate-400',
              ].join(' ')}
            >
              {problem ??
                `At least ${MIN_PASSWORD_LENGTH} characters, with a letter and a number.`}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Confirm password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className={`${fieldClass} ${mismatch ? 'border-rose-300' : ''}`}
            />
            {mismatch && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                These do not match.
              </p>
            )}
            {!mismatch && confirm.length > 0 && !problem && (
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                <Check className="size-3" strokeWidth={3} />
                Passwords match
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200/70 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md hover:shadow-brand-600/30 active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
                Saving…
              </>
            ) : (
              <>
                {isRecovery ? 'Save new password' : 'Continue to LibSpace'}
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={signOut}
          className="mt-6 w-full text-center text-xs font-medium text-slate-400 transition-colors duration-200 hover:text-slate-700"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 ease-in-out placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 focus:outline-none'
