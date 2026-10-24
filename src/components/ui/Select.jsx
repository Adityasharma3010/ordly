import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";

/**
 * Dropdown that matches the rest of the app (use it instead of the browser's <select>).
 * options: [{ value, label }]. Keyboard: Arrow keys / Home / End move, Enter or Space
 * picks, Escape closes (without also closing a modal around it), Tab leaves.
 * Focus stays on the trigger the whole time (aria-activedescendant points at the highlighted option).
 */
export function Select({
  value,
  onChange,
  options,
  label,
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // fixed-position coordinates for the panel
  const [active, setActive] = useState(0); // highlighted option index
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const current = options[selectedIndex];

  // The panel lives in a portal (so no parent can clip it); work out where it goes
  // from the trigger's position, flipping up if it won't fit below.
  const openList = () => {
    if (disabled) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = Math.max(r.width, 176);
    const need = options.length * 36 + 12;
    const roomBelow = window.innerHeight - r.bottom;
    const up = roomBelow < need && r.top > roomBelow;
    setPos({
      up,
      width,
      ...(up
        ? { bottom: window.innerHeight - r.top + 6 }
        : { top: r.bottom + 6 }),
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
    });
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  };

  const pick = (i) => {
    const option = options[i];
    setOpen(false);
    if (option && option.value !== value) onChange(option.value);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        !btnRef.current?.contains(e.target) &&
        !listRef.current?.contains(e.target)
      )
        setOpen(false);
    };
    // The panel is positioned in viewport coordinates, so close it if the page moves underneath it.
    const onMove = (e) => {
      // A window resize has no element as its target (that used to throw an error).
      const inside =
        e.target instanceof Node && listRef.current?.contains(e.target);
      if (!inside) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const onKeyDown = (e) => {
    if (disabled) return;
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(active);
        break;
      case "Escape":
        // Close only the dropdown, not a modal that happens to be around it.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        // Space activates a button on key-up; we already handled it on key-down.
        onKeyUp={(e) => {
          if (e.key === " ") e.preventDefault();
        }}
        className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-raised pr-1.5 pl-2.5 text-[13px] text-fg transition-colors hover:border-line-strong focus:outline-none focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? "border-accent" : "border-line"
        } ${className}`}
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              id={id}
              ref={listRef}
              role="listbox"
              aria-label={label}
              // Keep keyboard focus on the trigger when the panel is clicked.
              onMouseDown={(e) => e.preventDefault()}
              initial={{ opacity: 0, y: pos.up ? 4 : -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              style={{
                position: "fixed",
                top: pos.top,
                bottom: pos.bottom,
                left: pos.left,
                width: pos.width,
              }}
              className={`z-[70] ${pos.up ? "origin-bottom" : "origin-top"} rounded-xl border border-line bg-surface p-1 shadow-pop`}
            >
              {options.map((o, i) => (
                <div
                  key={o.value}
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(i)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-fg transition-colors ${
                    i === active ? "bg-raised" : ""
                  }`}
                >
                  <span className="flex-1">{o.label}</span>
                  {o.value === value && (
                    <Check
                      className="size-4 shrink-0 text-accent"
                      aria-hidden
                    />
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
