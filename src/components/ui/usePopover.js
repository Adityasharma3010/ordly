import { useCallback, useRef, useState } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "../../lib/animations";

/**
 * State for a small floating panel (date picker, time picker) that is drawn in a portal.
 * `openFor(button, { width, height })` works out where the panel goes from the button's
 * position (flipping above it if there is no room below). `close()` plays the closing
 * animation first, then removes the panel; with reduced motion it just removes it.
 * Everything happens in event handlers, never in effects.
 */
export function usePopover() {
  const [pos, setPos] = useState(null); // null = closed
  const panelRef = useRef(null);
  const anchorRef = useRef(null);
  const closing = useRef(false);

  const openFor = useCallback((anchor, { width = 288, height = 340 } = {}) => {
    const r = anchor.getBoundingClientRect();
    const roomBelow = window.innerHeight - r.bottom;
    const up = roomBelow < height + 12 && r.top > roomBelow;
    anchorRef.current = anchor;
    closing.current = false;
    setPos({
      up,
      width,
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      ...(up
        ? { bottom: window.innerHeight - r.top + 8 }
        : { top: r.bottom + 8 }),
    });
  }, []);

  const close = useCallback(
    ({ refocus = true } = {}) => {
      if (!pos || closing.current) return;
      const finish = () => {
        closing.current = false;
        setPos(null);
        if (refocus) anchorRef.current?.focus?.();
      };
      const el = panelRef.current;
      if (!el || prefersReducedMotion()) return finish();
      closing.current = true;
      gsap.to(el, {
        opacity: 0,
        y: pos.up ? 6 : -6,
        scale: 0.97,
        duration: 0.14,
        ease: "power2.in",
        onComplete: finish,
      });
    },
    [pos],
  );

  return { pos, open: !!pos, openFor, close, panelRef, anchorRef };
}
