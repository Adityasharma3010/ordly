import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { PartyPopper } from 'lucide-react'

const SPARKS = Array.from({ length: 10 }, (_, i) => i)

export function ProgressBar({ stats }) {
  const reduce = useReducedMotion()
  const prev = useRef(stats.isComplete)
  const [celebrate, setCelebrate] = useState(false)

  // Celebrate only when the user finishes the list, not when a finished list loads.
  useEffect(() => {
    if (stats.isComplete && !prev.current) {
      setCelebrate(true)
      const t = setTimeout(() => setCelebrate(false), 1800)
      prev.current = true
      return () => clearTimeout(t)
    }
    prev.current = stats.isComplete
  }, [stats.isComplete])

  return (
    <div className="relative">
      <div
        role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.percent}
        aria-label={`List progress: ${stats.done} of ${stats.total} done`}
        className="h-1.5 overflow-hidden rounded-full bg-raised"
      >
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={false} animate={{ width: `${stats.percent}%` }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 26 }}
        />
      </div>
      <AnimatePresence>
        {celebrate && !reduce && (
          <motion.div className="pointer-events-none absolute -top-1 right-0" initial={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden>
            {SPARKS.map((i) => {
              const angle = (i / SPARKS.length) * Math.PI * 2
              return (
                <motion.span
                  key={i} className="absolute size-1.5 rounded-full bg-accent"
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                  animate={{ x: Math.cos(angle) * 34, y: Math.sin(angle) * 34 - 6, scale: 0, opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <p className="sr-only" role="status">{celebrate ? 'List complete' : ''}</p>
      <AnimatePresence>
        {stats.isComplete && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 flex items-center gap-1.5 text-[13px] text-accent"
          >
            <PartyPopper className="size-3.5" aria-hidden /> Everything on this list is done.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
