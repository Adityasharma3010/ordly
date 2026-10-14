import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

/**
 * Accessible dropdown. items: [{ label, icon: Icon, onClick, danger, disabled, divider }]
 * `trigger` receives ({ ref, props, open }) so any button can be used.
 */
export function Menu({
  trigger,
  items,
  align = "right",
  side = "bottom",
  width = "w-56",
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // fixed-position coordinates for the panel
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };

  // The panel is rendered in a portal (outside any clipping/scrolling parent), so
  // work out where it goes from the trigger's position, flipping up if it won't fit.
  const openMenu = () => {
    const r = btnRef.current.getBoundingClientRect();
    const need = items.length * 36 + 16;
    const roomBelow = window.innerHeight - r.bottom;
    const roomAbove = r.top;
    const up =
      side === "top"
        ? roomAbove >= need || roomAbove > roomBelow
        : roomBelow < need && roomAbove > roomBelow;
    setPos({
      up,
      ...(up
        ? { bottom: window.innerHeight - r.top + 6 }
        : { top: r.bottom + 6 }),
      ...(align === "right"
        ? { right: Math.max(8, window.innerWidth - r.right) }
        : { left: Math.max(8, r.left) }),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        !wrapRef.current?.contains(e.target) &&
        !listRef.current?.contains(e.target)
      )
        close(false);
    };
    // The panel is positioned in viewport coordinates, so close it if the page moves underneath it.
    const onMove = (e) => {
      if (!listRef.current?.contains(e.target)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    requestAnimationFrame(() =>
      listRef.current
        ?.querySelector("[role=menuitem]:not([disabled])")
        ?.focus(),
    );
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const onListKey = (e) => {
    const els = [
      ...listRef.current.querySelectorAll("[role=menuitem]:not([disabled])"),
    ];
    const i = els.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      els[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      els[els.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") close(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      {trigger({
        ref: btnRef,
        open,
        props: {
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-controls": open ? id : undefined,
          onClick: () => (open ? setOpen(false) : openMenu()),
          onKeyDown: (e) => {
            if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              openMenu();
            }
          },
        },
      })}
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              id={id}
              ref={listRef}
              role="menu"
              onKeyDown={onListKey}
              initial={{ opacity: 0, y: pos.up ? 4 : -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              style={{
                position: "fixed",
                top: pos.top,
                bottom: pos.bottom,
                left: pos.left,
                right: pos.right,
              }}
              className={`z-[70] ${width} ${pos.up ? "origin-bottom" : "origin-top"} rounded-xl border border-line bg-surface p-1 shadow-pop`}
            >
              {items.map((it, idx) =>
                it.divider ? (
                  <div
                    key={idx}
                    role="separator"
                    className="my-1 h-px bg-line"
                  />
                ) : (
                  <button
                    key={idx}
                    role="menuitem"
                    type="button"
                    disabled={it.disabled}
                    onClick={() => {
                      close();
                      it.onClick?.();
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      it.danger
                        ? "text-danger hover:bg-danger/10 focus:bg-danger/10"
                        : "text-fg hover:bg-raised focus:bg-raised"
                    } focus:outline-none`}
                  >
                    {it.icon && (
                      <it.icon
                        className="size-4 shrink-0 opacity-80"
                        aria-hidden
                      />
                    )}
                    <span className="flex-1">{it.label}</span>
                    {it.hint && (
                      <span className="text-xs text-faint">{it.hint}</span>
                    )}
                  </button>
                ),
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
