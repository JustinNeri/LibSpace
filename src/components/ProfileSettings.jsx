import { useState } from 'react'
import { AlertCircle, Check, Eye, EyeOff, KeyRound, Loader2, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { MIN_PASSWORD_LENGTH, passwordProblem } from '../lib/validation'
import { COURSES, OTHER_COURSE, YEAR_LEVELS, formatFullName } from '../lib/constants'

const KNOWN_PROGRAMS = COURSES.flatMap((group) => group.programs)

/** Edit the details captured at sign-up, and change the password. */
export default function ProfileSettings() {
  const { user, profile, isAdmin, refreshProfile } = useAuth()

  const storedCourse = profile?.course ?? ''
  const [details, setDetails] = useState({
    lastName: profile?.last_name ?? '',
    firstName: profile?.first_name ?? '',
    middleInitial: profile?.middle_initial ?? '',
    studentId: profile?.student_id ?? '',
    yearLevel: profile?.year_level ?? '',
    course:
      storedCourse && !KNOWN_PROGRAMS.includes(storedCourse) ? OTHER_COURSE : storedCourse,
    otherCourse:
      storedCourse && !KNOWN_PROGRAMS.includes(storedCourse) ? storedCourse : '',
  })
  const [detailsBusy, setDetailsBusy] = useState(false)
  const [detailsSaved, setDetailsSaved] = useState(false)
  const [detailsError, setDetailsError] = useState(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState(null)

  const saveDetails = async (event) => {
    event.preventDefault()
    setDetailsError(null)
    setDetailsSaved(false)

    if (!details.lastName.trim() || !details.firstName.trim()) {
      setDetailsError('Last name and first name are required.')
      return
    }

    const course =
      details.course === OTHER_COURSE ? details.otherCourse.trim() : details.course

    setDetailsBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        last_name: details.lastName.trim(),
        first_name: details.firstName.trim(),
        middle_initial: details.middleInitial.trim().toUpperCase(),
        full_name: formatFullName(details),
        student_id: details.studentId.trim(),
        year_level: details.yearLevel,
        course,
      })
      .eq('id', user.id)
    setDetailsBusy(false)

    if (error) setDetailsError(error.message)
    else {
      setDetailsSaved(true)
      refreshProfile?.()
    }
  }

  const savePassword = async (event) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSaved(false)

    const problem = passwordProblem(password)
    if (problem) {
      setPasswordError(problem)
      return
    }
    if (password !== confirm) {
      setPasswordError('The two passwords do not match.')
      return
    }

    setPasswordBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setPasswordBusy(false)

    if (error) {
      setPasswordError(error.message)
      return
    }

    setPassword('')
    setConfirm('')
    setPasswordSaved(true)
  }

  return (
    <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
      {/* Details */}
      <form onSubmit={saveDetails} className="surface p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <UserRound className="size-4.5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Your details</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_64px]">
          <Field label="Last name">
            <input
              value={details.lastName}
              onChange={(event) =>
                setDetails({ ...details, lastName: event.target.value })
              }
              className={fieldClass}
            />
          </Field>
          <Field label="First name">
            <input
              value={details.firstName}
              onChange={(event) =>
                setDetails({ ...details, firstName: event.target.value })
              }
              className={fieldClass}
            />
          </Field>
          <Field label="M.I.">
            <input
              maxLength={1}
              value={details.middleInitial}
              onChange={(event) =>
                setDetails({
                  ...details,
                  middleInitial: event.target.value.replace(/[^a-zA-Z]/g, ''),
                })
              }
              className={`${fieldClass} text-center uppercase`}
            />
          </Field>
        </div>

        {!isAdmin && (
          <>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Student number">
                <input
                  value={details.studentId}
                  onChange={(event) =>
                    setDetails({ ...details, studentId: event.target.value })
                  }
                  className={fieldClass}
                />
              </Field>
              <Field label="Year level">
                <select
                  value={details.yearLevel}
                  onChange={(event) =>
                    setDetails({ ...details, yearLevel: event.target.value })
                  }
                  className={fieldClass}
                >
                  <option value="">Select…</option>
                  {YEAR_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Course" className="mt-3">
              <select
                value={details.course}
                onChange={(event) =>
                  setDetails({ ...details, course: event.target.value })
                }
                className={fieldClass}
              >
                <option value="">Select…</option>
                {COURSES.map((group) => (
                  <optgroup key={group.school} label={group.school}>
                    {group.programs.map((program) => (
                      <option key={program} value={program}>
                        {program}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value={OTHER_COURSE}>Other (not listed)</option>
              </select>
            </Field>

            {details.course === OTHER_COURSE && (
              <input
                value={details.otherCourse}
                onChange={(event) =>
                  setDetails({ ...details, otherCourse: event.target.value })
                }
                placeholder="Type your course"
                className={`${fieldClass} mt-2`}
              />
            )}
          </>
        )}

        {detailsError && (
          <Note tone="error">{detailsError}</Note>
        )}

        <div className="mt-5 flex items-center gap-3">
          <SaveButton busy={detailsBusy}>Save details</SaveButton>
          {detailsSaved && !detailsBusy && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check className="size-3" strokeWidth={3} />
              Saved
            </span>
          )}
        </div>
      </form>

      {/* Password */}
      <form onSubmit={savePassword} className="surface h-fit p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <KeyRound className="size-4.5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Change password</p>
            <p className="text-xs text-slate-500">
              At least {MIN_PASSWORD_LENGTH} characters, with a letter and a number.
            </p>
          </div>
        </div>

        <Field label="New password" className="mt-5">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
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
        </Field>

        <Field label="Confirm password" className="mt-3">
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            className={fieldClass}
          />
        </Field>

        {passwordError && <Note tone="error">{passwordError}</Note>}

        <div className="mt-5 flex items-center gap-3">
          <SaveButton busy={passwordBusy}>Update password</SaveButton>
          {passwordSaved && !passwordBusy && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check className="size-3" strokeWidth={3} />
              Updated
            </span>
          )}
        </div>
      </form>
    </div>
  )
}

/* ---------- pieces ---------- */

const fieldClass =
  'mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 ease-in-out placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 focus:outline-none'

function Field({ label, className = '', children }) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  )
}

function Note({ children }) {
  return (
    <p className="mt-4 flex items-start gap-1.5 text-xs font-medium text-rose-600">
      <AlertCircle className="mt-0.5 size-3 shrink-0" strokeWidth={2.5} />
      {children}
    </p>
  )
}

function SaveButton({ busy, children }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
    >
      {busy && <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />}
      {children}
    </button>
  )
}
