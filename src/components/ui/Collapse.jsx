import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "../../lib/animations";

/**
 * Shows or hides its children with a smooth height animation (GSAP). Hidden content is
 * really hidden (display: none), so it can't be tabbed to or read out by a screen reader.
 * With reduced motion it just shows or hides. Don't put CSS transitions on this element.
 */
export function Collapse({ open, children, id, className = "" }) {
  const ref = useRef(null);
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      el.style.display = open ? "" : "none";
      return;
    }
    gsap.killTweensOf(el);
    if (prefersReducedMotion()) {
      el.style.display = open ? "" : "none";
      return;
    }
    if (open) {
      el.style.display = "";
      gsap.fromTo(
        el,
        { height: 0, opacity: 0 },
        {
          height: "auto",
          opacity: 1,
          duration: 0.32,
          ease: "power3.out",
          onComplete: () => gsap.set(el, { clearProps: "height,opacity" }),
        },
      );
    } else {
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.22,
        ease: "power2.in",
        onComplete: () => {
          el.style.display = "none";
          gsap.set(el, { clearProps: "height,opacity" });
        },
      });
    }
  }, [open]);

  return (
    // The padding (cancelled by the negative margins) gives focus rings and shadows of what is
    // inside room to show, since the box has to clip while it animates.
    <div
      ref={ref}
      id={id}
      className={`-mx-2 -mb-2 overflow-hidden px-2 pb-2 ${className}`}
    >
      {children}
    </div>
  );
}
