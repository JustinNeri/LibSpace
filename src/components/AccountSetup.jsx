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
import {
  COURSES,
  OTHER_COURSE,
  UNIVERSITY_NAME,
  YEAR_LEVELS,
  formatFullName,
} from '../lib/constants'

const KNOWN_PROGRAMS = COURSES.flatMap((group) => group.programs)

/**
 * Shown after a verified access code — where the user gives their details
 * and chooses their own LibSpace password.
 *
 * Two shapes:
 *   registration  name parts + student number + year + course + password
 *   recovery      password only (the profile is already filled in)
 */
export default function AccountSetup() {
  const { user, profile, resetRequested, completeAccount, signOut } = useAuth()

  const isRecovery = resetRequested && Boolean(profile?.last_name)

  const [lastName, setLastName] = useState(profile?.last_name ?? '')
  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [middleInitial, setMiddleInitial] = useState(profile?.middle_initial ?? '')
  const [studentId, setStudentId] = useState(profile?.student_id ?? '')
  const [yearLevel, setYearLevel] = useState(profile?.year_level ?? '')

  const storedCourse = profile?.course ?? ''
  const [course, setCourse] = useState(
    storedCourse && !KNOWN_PROGRAMS.includes(storedCourse) ? OTHER_COURSE : storedCourse,
  )
  const [otherCourse, setOtherCourse] = useState(
    storedCourse && !KNOWN_PROGRAMS.includes(storedCourse) ? storedCourse : '',
  )

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const problem = password ? passwordProblem(password) : null
  const mismatch = confirm.length > 0 && confirm !== password
  const resolvedCourse = course === OTHER_COURSE ? otherCourse.trim() : course

  const preview = formatFullName({ lastName, firstName, middleInitial })

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (!isRecovery) {
      if (!lastName.trim() || !firstName.trim()) {
        setError('Last name and first name are required.')
        return
      }
      if (!studentId.trim()) {
        setError('Your student number is required.')
        return
      }
      if (!yearLevel) {
        setError('Select your year level.')
        return
      }
      if (!resolvedCourse) {
        setError('Select or type your course.')
        return
      }
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
      isRecovery
        ? { password }
        : {
            password,
            lastName,
            firstName,
            middleInitial,
            studentId,
            yearLevel,
            course: resolvedCourse,
          },
    )
    setBusy(false)

    if (saveError) setError(saveError.message)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md animate-slide-up">
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
          Email verified as{' '}
          <span className="font-medium text-slate-900">{user?.email}</span>.
          {isRecovery
            ? ' Choose a new password to finish.'
            : ` Your details appear on every reservation you make at the ${UNIVERSITY_NAME} library.`}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {!isRecovery && (
            <>
              <Section title="Name">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_72px]">
                  <Field label="Last name">
                    <input
                      type="text"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Dela Cruz"
                      autoComplete="family-name"
                      autoFocus
                      className={fieldClass}
                    />
                  </Field>

                  <Field label="First name">
                    <input
                      type="text"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="Juan"
                      autoComplete="given-name"
                      className={fieldClass}
                    />
                  </Field>

                  <Field label="M.I.">
                    <input
                      type="text"
                      value={middleInitial}
                      onChange={(event) =>
                        setMiddleInitial(
                          event.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 1),
                        )
                      }
                      placeholder="M"
                      maxLength={1}
                      className={`${fieldClass} text-center uppercase`}
                    />
                  </Field>
                </div>

                {preview && (
                  <p className="mt-2 text-xs text-slate-400">
                    Shown as <span className="font-medium text-slate-600">{preview}</span>
                  </p>
                )}
              </Section>

              <Section title="Academic details">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Student number">
                    <input
                      type="text"
                      value={studentId}
                      onChange={(event) => setStudentId(event.target.value)}
                      placeholder="2024-00123"
                      className={fieldClass}
                    />
                  </Field>

                  <Field label="Year level">
                    <select
                      value={yearLevel}
                      onChange={(event) => setYearLevel(event.target.value)}
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
                    value={course}
                    onChange={(event) => setCourse(event.target.value)}
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

                {course === OTHER_COURSE && (
                  <input
                    type="text"
                    value={otherCourse}
                    onChange={(event) => setOtherCourse(event.target.value)}
                    placeholder="Type your course"
                    className={`${fieldClass} mt-2`}
                  />
                )}
              </Section>
            </>
          )}

          <Section title={isRecovery ? 'New password' : 'Password'}>
            <Field label="Password">
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
            </Field>

            <Field label="Confirm password" className="mt-3">
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
            </Field>
          </Section>

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

/* ---------- layout helpers ---------- */

function Section({ title, children }) {
  return (
    <fieldset className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <legend className="px-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

function Field({ label, className = '', children }) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  )
}

const fieldClass =
  'mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 ease-in-out placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 focus:outline-none'
