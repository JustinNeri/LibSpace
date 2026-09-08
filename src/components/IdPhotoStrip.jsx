import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const ID_BUCKET = 'reservation-ids'

/**
 * The uploaded student IDs for one booking.
 *
 * The bucket is private, so each file needs a short-lived signed URL. These
 * are generated on demand rather than up front — most requests are handled
 * without anyone opening the photos.
 */
export default function IdPhotoStrip({ paths }) {
  const [urls, setUrls] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (paths.length === 0) {
      setUrls([])
      return
    }

    supabase.storage
      .from(ID_BUCKET)
      .createSignedUrls(paths, 300)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[LibSpace] Could not sign ID photos.', error)
          setUrls([])
          return
        }
        setUrls(data.map((item) => item.signedUrl).filter(Boolean))
      })

    return () => {
      cancelled = true
    }
  }, [paths])

  return (
    <div className="border-t border-slate-200/70 bg-slate-50/70 p-5">
      {urls === null ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {paths.map((path) => (
            <div key={path} className="aspect-[4/3] animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : urls.length === 0 ? (
        <p className="text-sm text-slate-500">No ID photos were attached.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {urls.map((url, index) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-300 bg-white transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md"
            >
              <img
                src={url}
                alt={`Student ID ${index + 1}`}
                className="size-full object-cover"
              />
              <span className="absolute bottom-1 left-1 grid size-5 place-items-center rounded-md bg-slate-900/70 text-[10px] font-semibold text-white">
                {index + 1}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
