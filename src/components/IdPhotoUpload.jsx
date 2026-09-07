import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, IdCard, Plus, X } from 'lucide-react'
import { ID_PHOTO_MAX_BYTES, ID_PHOTO_TYPES } from '../lib/constants'

const MB = 1024 * 1024

/**
 * Photos of each member's student ID, required before a room can be booked.
 *
 * Files are held in memory here and only uploaded once the booking is
 * confirmed, so an abandoned form leaves nothing behind in storage.
 */
export default function IdPhotoUpload({ photos, required, onChange, disabled }) {
  const inputRef = useRef(null)
  const [error, setError] = useState(null)
  const [previews, setPreviews] = useState([])

  // Object URLs must be revoked or the blobs leak for the page's lifetime.
  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [photos])

  const addFiles = (fileList) => {
    setError(null)
    const incoming = Array.from(fileList ?? [])
    if (incoming.length === 0) return

    const accepted = []
    for (const file of incoming) {
      if (!ID_PHOTO_TYPES.includes(file.type)) {
        setError(`${file.name} is not an image.`)
        continue
      }
      if (file.size > ID_PHOTO_MAX_BYTES) {
        setError(`${file.name} is larger than ${ID_PHOTO_MAX_BYTES / MB} MB.`)
        continue
      }
      accepted.push(file)
    }

    if (accepted.length > 0) onChange([...photos, ...accepted])
  }

  const removeAt = (index) => {
    setError(null)
    onChange(photos.filter((_, i) => i !== index))
  }

  const complete = photos.length >= required

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-slate-700">Student ID photos</label>
        <span
          className={[
            'text-xs font-semibold',
            complete ? 'text-emerald-600' : 'text-slate-400',
          ].join(' ')}
        >
          {photos.length} of {required}
        </span>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        One clear photo of each member's student ID. The library checks these on
        arrival.
      </p>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {previews.map((url, index) => (
          <div
            key={url}
            className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100"
          >
            <img
              src={url}
              alt={`Student ID ${index + 1}`}
              className="size-full object-cover"
            />

            {/* Numbered so a student can tell which one they are removing */}
            <span className="absolute bottom-1 left-1 grid size-5 place-items-center rounded-md bg-slate-900/70 text-[10px] font-semibold text-white">
              {index + 1}
            </span>

            {!disabled && (
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label={`Remove ID photo ${index + 1}`}
                title="Remove"
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-md bg-slate-900/75 text-white shadow-sm transition-all duration-200 ease-in-out hover:scale-105 hover:bg-rose-600"
              >
                <X className="size-3.5" strokeWidth={3} />
              </button>
            )}
          </div>
        ))}

        {photos.length < required && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 text-slate-400 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50/60 hover:text-brand-600 disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            <span className="text-[11px] font-medium">Add</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ID_PHOTO_TYPES.join(',')}
        multiple
        hidden
        onChange={(event) => {
          addFiles(event.target.files)
          // Reset so picking the same file twice still fires a change.
          event.target.value = ''
        }}
      />

      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-rose-600">
          <AlertCircle className="mt-0.5 size-3 shrink-0" strokeWidth={2.5} />
          {error}
        </p>
      ) : complete ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <Check className="size-3" strokeWidth={3} />
            All {required} IDs added
          </p>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-slate-400 transition-colors duration-200 hover:text-rose-600"
            >
              Remove all
            </button>
          )}
        </div>
      ) : (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
          <IdCard className="mt-0.5 size-3 shrink-0" strokeWidth={2} />
          {required - photos.length} more needed. JPG, PNG or WebP, up to{' '}
          {ID_PHOTO_MAX_BYTES / MB} MB each.
        </p>
      )}
    </div>
  )
}
