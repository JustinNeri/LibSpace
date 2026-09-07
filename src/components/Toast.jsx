import { useEffect } from 'react'
import { CheckCircle2, X } from 'lucide-react'

/** Transient confirmation, auto-dismissing after 4s. */
export default function Toast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [message, onDismiss])

  if (!message) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-6">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white py-3 pr-3 pl-4 shadow-lg shadow-slate-900/5 animate-slide-up">
        <CheckCircle2 className="size-4.5 shrink-0 text-emerald-500" strokeWidth={2} />
        <p className="text-sm font-medium text-slate-700">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-lg p-1.5 text-slate-400 transition-all duration-200 ease-in-out hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
