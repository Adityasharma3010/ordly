import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PartyPopper } from "lucide-react";
import { celebrate } from "../../lib/animations";

export function ProgressBar({ stats }) {
  const reduce = useReducedMotion();
  const prev = useRef(stats.isComplete);
  const barRef = useRef(null);
  const [announce, setAnnounce] = useState(false);

  // Celebrate only when the user finishes the list, not when a finished list loads.
  useEffect(() => {
    if (stats.isComplete && !prev.current) {
      celebrate(barRef.current); // GSAP confetti in the list's accent colour
      setAnnounce(true);
      const t = setTimeout(() => setAnnounce(false), 2000);
      prev.current = true;
      return () => clearTimeout(t);
    }
    prev.current = stats.isComplete;
  }, [stats.isComplete]);

  return (
    <div className="relative">
      <div
        ref={barRef}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={stats.percent}
        aria-label={`List progress: ${stats.done} of ${stats.total} done`}
        className="h-1.5 overflow-hidden rounded-full bg-raised"
      >
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={false}
          animate={{ width: `${stats.percent}%` }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 160, damping: 26 }
          }
        />
      </div>
      <p className="sr-only" role="status">
        {announce ? "List complete" : ""}
      </p>
      <AnimatePresence>
        {stats.isComplete && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 flex items-center gap-1.5 text-[13px] text-accent"
          >
            <PartyPopper className="size-3.5" aria-hidden /> Everything on this
            list is done.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
