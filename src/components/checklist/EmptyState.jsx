import { motion, useReducedMotion } from "motion/react";
import { Button } from "../ui/Button";

export function EmptyItems({ canEdit }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col items-center px-6 py-14 text-center"
    >
      <svg
        viewBox="0 0 120 80"
        className="mb-5 h-20 w-30"
        fill="none"
        aria-hidden
      >
        {[16, 40, 64].map((y, i) => (
          <g key={y}>
            <rect
              x="8"
              y={y - 8}
              width="16"
              height="16"
              rx="4"
              stroke="var(--c-line-strong)"
              strokeWidth="1.5"
            />
            <line
              x1="34"
              y1={y}
              x2={96 - i * 14}
              y2={y}
              stroke="var(--c-line-strong)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ))}
        <motion.path
          d="M11.5 16.5l3.2 3.4 6-7"
          stroke="var(--c-accent)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        />
      </svg>
      <h3 className="font-serif text-2xl">
        {canEdit ? "This list is empty" : "Nothing on this list yet"}
      </h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted">
        {canEdit
          ? "Type an item above and press Enter. Keep typing to add the next one."
          : "The owner hasn’t added any items."}
      </p>
    </motion.div>
  );
}

export function NoMatches({ onReset }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-medium">No items match</p>
      <p className="mt-1 text-sm text-muted">
        Try a different search or filter.
      </p>
      <Button className="mt-4" size="sm" onClick={onReset}>
        Show all items
      </Button>
    </div>
  );
}
