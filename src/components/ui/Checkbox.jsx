import { motion, useReducedMotion } from "motion/react";

// The tick is drawn like a pen stroke in the list's accent colour. The box keeps
// its outline, and the tick shape (not only colour) signals completion.
export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  size = 22,
}) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative grid shrink-0 cursor-pointer place-items-center rounded-md border-[1.5px] transition-colors duration-150 disabled:cursor-default ${
        checked
          ? "border-accent bg-accent/15"
          : "border-line-strong hover:border-accent/70"
      }`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[78%] overflow-visible"
        fill="none"
        aria-hidden
      >
        <motion.path
          d="M4.5 12.8l4.6 4.7L19.8 5.6"
          stroke="var(--c-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : {
                  pathLength: { duration: 0.26, ease: [0.3, 0.8, 0.3, 1] },
                  opacity: { duration: 0.05 },
                }
          }
        />
      </svg>
    </button>
  );
}
