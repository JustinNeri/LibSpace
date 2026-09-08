import { useState } from 'react'
import {
  AlertCircle,
  Camera,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  UserRound,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { MIN_PASSWORD_LENGTH, passwordProblem } from '../lib/validation'
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  COURSES,
  OTHER_COURSE,
  YEAR_LEVELS,
  formatFullName,
} from '../lib/constants'
import Avatar from './Avatar'
import { forgetAvatar } from '../lib/avatarUrl'

const KNOWN_PROGRAMS = COURSES.flatMap((group) => group.programs)

/** Edit the details captured at sign-up, and change the password. */
export default function ProfileSettings() {
  const { user, profile, isAdmin, refreshProfile, signOut } = useAuth()

  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState(null)

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

  /**
   * Replace the profile photo.
   *
   * The file goes to a fresh path every time rather than overwriting one: a
   * signed URL and the browser cache both key on the path, so reusing it
   * would keep serving the old picture. The previous file is removed once the
   * profile row points at the new one, so a failure part-way leaves the old
   * photo working rather than none at all.
   */
  const changePhoto = async (file) => {
    if (!file) return
    setPhotoError(null)

    if (!AVATAR_TYPES.includes(file.type)) {
      setPhotoError('Choose a JPG, PNG or WebP image.')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setPhotoError(`That image is over ${AVATAR_MAX_BYTES / (1024 * 1024)} MB.`)
      return
    }

    setPhotoBusy(true)
    const previous = profile?.avatar_path ?? null
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      setPhotoBusy(false)
      setPhotoError(uploadError.message)
      return
    }

    const { error: saveError } = await supabase
      .from('profiles')
      .update({ avatar_path: path })
      .eq('id', user.id)

    if (saveError) {
      await supabase.storage.from(AVATAR_BUCKET).remove([path])
      setPhotoBusy(false)
      setPhotoError(saveError.message)
      return
    }

    if (previous) {
      await supabase.storage.from(AVATAR_BUCKET).remove([previous])
      forgetAvatar(previous)
    }

    await refreshProfile()
    setPhotoBusy(false)
  }

  const removePhoto = async () => {
    const previous = profile?.avatar_path
    if (!previous) return

    setPhotoBusy(true)
    setPhotoError(null)

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_path: null })
      .eq('id', user.id)

    if (error) {
      setPhotoBusy(false)
      setPhotoError(error.message)
      return
    }

    await supabase.storage.from(AVATAR_BUCKET).remove([previous])
    forgetAvatar(previous)
    await refreshProfile()
    setPhotoBusy(false)
  }

  return (
    <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-2">
      {/* Who this account belongs to */}
      <section className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center lg:col-span-2">
        <div className="relative shrink-0 self-start">
          <Avatar
            profile={profile}
            user={user}
            className="size-16"
            rounded="rounded-2xl"
            textClass="text-lg"
          />
          <label
            className={[
              'absolute -right-2 -bottom-2 grid size-8 cursor-pointer place-items-center',
              'rounded-full bg-brand-700 text-white ring-2 ring-white transition-colors',
              'duration-200 hover:bg-brand-800',
              photoBusy ? 'pointer-events-none opacity-60' : '',
            ].join(' ')}
            title="Change photo"
          >
            {photoBusy ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
            ) : (
              <Camera className="size-4" strokeWidth={2} />
            )}
            <span className="sr-only">Change profile photo</span>
            <input
              type="file"
              accept={AVATAR_TYPES.join(',')}
              disabled={photoBusy}
              onChange={(event) => {
                changePhoto(event.target.files?.[0])
                // Let the same file be picked again after a failure.
                event.target.value = ''
              }}
              className="sr-only"
            />
          </label>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-xl font-semibold text-slate-900">
            {profile?.full_name || 'Your account'}
          </p>
          <p className="mt-0.5 truncate text-sm text-slate-500">{user?.email}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={[
                'rounded-md px-2 py-1 text-[11px] font-bold tracking-wider uppercase',
                isAdmin ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600',
              ].join(' ')}
            >
              {isAdmin ? 'Administrator' : 'Student'}
            </span>
            {!isAdmin && (
              <span className="text-xs text-slate-500">
                {[profile?.student_id, profile?.year_level, profile?.course]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </div>

          {profile?.avatar_path && (
            <button
              type="button"
              onClick={removePhoto}
              disabled={photoBusy}
              className="mt-2 text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 transition-colors duration-200 hover:text-rose-700 disabled:pointer-events-none disabled:opacity-50"
            >
              Remove photo
            </button>
          )}

          {photoError && (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-rose-600">
              <AlertCircle className="mt-0.5 size-3 shrink-0" strokeWidth={2.5} />
              {photoError}
            </p>
          )}
        </div>
      </section>

      {/* Details */}
      <form onSubmit={saveDetails} className="surface p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <UserRound className="size-4.5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Your details</p>
            <p className="text-xs text-slate-500">
              {isAdmin ? 'Used across LibSpace' : 'Shown on every reservation'}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_72px] gap-3 sm:grid-cols-[1fr_1fr_80px]">
          <Field label="Last name" className="col-span-2 sm:col-span-1">
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
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700">
              <Check className="size-3" strokeWidth={3} />
              Saved
            </span>
          )}
        </div>
      </form>

      {/* Password */}
      <form onSubmit={savePassword} className="surface h-fit p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
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
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700">
              <Check className="size-3" strokeWidth={3} />
              Updated
            </span>
          )}
        </div>
      </form>

      {/* Sign out is here rather than in the phone's overflow sheet: students
          have four tabs and no overflow, so the sheet never renders for them
          and this was unreachable on a phone. */}
      <section className="surface p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Sign out</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Ends your session on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold tracking-wide text-slate-700 transition-colors duration-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 sm:w-auto"
          >
            <LogOut className="size-4" strokeWidth={2} />
            Sign out
          </button>
        </div>
      </section>
    </div>
  )
}

/* ---------- pieces ---------- */

const fieldClass = 'field mt-1.5'

function Field({ label, className = '', children }) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
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
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold tracking-wide text-white transition-colors duration-200 hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
    >
      {busy && <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />}
      {children}
    </button>
  )
}
