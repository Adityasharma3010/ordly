import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { prefersReducedMotion } from "../../lib/animations";

/**
 * The floating box a picker lives in. Draws in a portal (so nothing can clip it), animates
 * in with GSAP, and closes on Escape, a click outside, Tab, or when the page scrolls or
 * resizes underneath it. Pass the object from usePopover() as `popover`.
 * (No CSS transitions or Tailwind transforms here: GSAP owns this element's transform.)
 */
export function PickerPanel({ popover, label, children, onKeyDown }) {
  const { pos, close, panelRef, anchorRef } = popover;
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        {
          opacity: 0,
          y: pos.up ? 10 : -10,
          scale: 0.96,
          transformOrigin: pos.up ? "50% 100%" : "50% 0%",
        },
        { opacity: 1, y: 0, scale: 1, duration: 0.26, ease: "power3.out" },
      );
    });
    return () => ctx.revert();
    // Plays once when the panel appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (
        !panelRef.current?.contains(e.target) &&
        !anchorRef.current?.contains(e.target)
      )
        closeRef.current({ refocus: false });
    };
    const onMove = (e) => {
      // A window resize has no element as its target; scrolling inside the panel is fine.
      const inside =
        e.target instanceof Node && panelRef.current?.contains(e.target);
      if (!inside) closeRef.current({ refocus: false });
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
  }, [panelRef, anchorRef]);

  const keyDown = (e) => {
    if (e.key === "Escape") {
      // Close only the picker, not a dialog that happens to be around it.
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === "Tab") {
      close();
      return;
    }
    onKeyDown?.(e);
  };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      onKeyDown={keyDown}
      style={{
        position: "fixed",
        zIndex: 60,
        width: pos.width,
        left: pos.left,
        top: pos.top,
        bottom: pos.bottom,
      }}
      className="rounded-xl border border-line-strong bg-surface p-3 shadow-pop"
    >
      {children}
    </div>,
    document.body,
  );
}
