import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

const icons = { success: CheckCircle2, error: AlertCircle, info: Info }
const tones = { success: 'text-ok', error: 'text-danger', info: 'text-accent' }

export function Toaster({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = icons[t.tone] || Info
          return (
            <motion.div
              key={t.id} layout role={t.tone === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-line bg-surface py-2.5 pr-2 pl-3.5 shadow-pop"
            >
              <Icon className={`size-4 shrink-0 ${tones[t.tone] || tones.info}`} aria-hidden />
              <p className="flex-1 text-sm">{t.message}</p>
              {t.action && (
                <button
                  className="cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-accent hover:bg-raised"
                  onClick={() => { t.action.onClick(); onDismiss(t.id) }}
                >
                  {t.action.label}
                </button>
              )}
              <button aria-label="Dismiss notification" className="cursor-pointer rounded-md p-1 text-faint hover:text-fg" onClick={() => onDismiss(t.id)}>
                <X className="size-4" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
