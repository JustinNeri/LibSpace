import { useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import AuthLayout, { SectionHeading, Steps, authField } from './AuthLayout'
import { forgetView } from '../lib/nav'
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

    if (saveError) {
      setError(saveError.message)
      return
    }

    // A newly created account opens on the rooms list. Recovery deliberately
    // does not clear it: someone resetting a password mid-session should come
    // back to the screen they were on.
    if (!isRecovery) forgetView()
  }

  return (
    <AuthLayout
      wide={!isRecovery}
      hero={{
        title: isRecovery ? 'Set a new password' : 'Finish your account',
        subtitle: (
          <>
            Email verified as{' '}
            <span className="font-semibold text-white">{user?.email}</span>.
            {isRecovery
              ? ' Choose a new password to finish.'
              : ` Your details appear on every reservation you make at the ${UNIVERSITY_NAME} library.`}
          </>
        ),
      }}
      footer={
        <button
          type="button"
          onClick={signOut}
          className="font-semibold text-white/70 underline decoration-white/30 underline-offset-4 transition-colors duration-200 hover:text-white"
        >
          Sign out
        </button>
      }
    >
      <div className="animate-slide-up">
        {!isRecovery && <Steps current={2} />}

        <form onSubmit={handleSubmit} className="space-y-7">
          {!isRecovery && (
            <>
              <Section title="Name">
                {/* Last name owns its row; first name and the single initial
                    share the next one, so the initial is never a lone wide box. */}
                <div className="grid grid-cols-[1fr_72px] gap-3 sm:grid-cols-[1fr_1fr_80px]">
                  <Field label="Last name" className="col-span-2 sm:col-span-1">
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
                <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3.5 text-sm font-bold tracking-wide text-white transition-colors duration-200 hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-60"
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

      </div>
    </AuthLayout>
  )
}

/* ---------- layout helpers ---------- */

function Section({ title, children }) {
  return (
    <section>
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  )
}

function Field({ label, className = '', children }) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  )
}

const fieldClass = `mt-1.5 ${authField}`
