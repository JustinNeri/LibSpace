import { useState } from 'react'
import { AlertCircle, ArrowRight, Loader2, UserRound } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

/**
 * Shown once, right after a student's first verification. Their name and
 * student number are stamped onto every reservation they make.
 */
export default function ProfileSetup() {
  const { user, completeProfile, signOut } = useAuth()
  const [fullName, setFullName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (!fullName.trim() || !studentId.trim()) {
      setError('Both fields are required.')
      return
    }

    setBusy(true)
    const { error: saveError } = await completeProfile({ fullName, studentId })
    setBusy(false)

    if (saveError) setError(saveError.message)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-sm animate-slide-up">
        <span className="grid size-11 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/25">
          <UserRound className="size-5" strokeWidth={2} />
        </span>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">
          Finish your account
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Signed in as <span className="font-medium text-slate-900">{user?.email}</span>.
          These details appear on your reservations.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
            <label className="text-sm font-medium text-slate-700">Student number</label>
            <input
              type="text"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              placeholder="2024-00123"
              className={fieldClass}
            />
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
                Continue to LibSpace
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
