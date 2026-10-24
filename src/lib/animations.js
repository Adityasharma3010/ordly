// All GSAP animation lives here. Components just call these functions.
// Every effect is skipped when the user has asked for reduced motion.
import { gsap } from "gsap";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const prefersReducedMotion = reducedMotion;

/* ------------------------------------------------------------------ *
 * 1. Sign-in page: headline → copy → features → preview card → ticks
 * ------------------------------------------------------------------ */
export function playAuthIntro(root) {
  if (!root || reducedMotion()) return () => {};

  const rows = [...root.querySelectorAll("[data-intro=row]")];
  const ctx = gsap.context(() => {
    const q = gsap.utils.selector(root);
    const ticks = q("[data-intro=tick]");
    const bar = q("[data-intro=bar]");

    // Start the preview unfinished; the timeline "completes" it.
    rows.forEach((r) => r.classList.remove("is-done"));
    ticks.forEach((t) => {
      const len =
        typeof t.getTotalLength === "function" ? t.getTotalLength() : 24;
      gsap.set(t, { strokeDasharray: len, strokeDashoffset: len });
    });

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(q("[data-intro=logo]"), { y: -10, opacity: 0, duration: 0.5 })
      .from(
        q("[data-intro=word]"),
        {
          yPercent: 115,
          opacity: 0,
          duration: 0.85,
          stagger: 0.09,
          ease: "power4.out",
        },
        0.15,
      )
      .from(q("[data-intro=lede]"), { y: 18, opacity: 0, duration: 0.6 }, 0.75)
      .from(
        q("[data-intro=feature]"),
        { x: -16, opacity: 0, duration: 0.5, stagger: 0.1 },
        0.95,
      )
      .from(q("[data-intro=panel]"), { y: 28, opacity: 0, duration: 0.7 }, 0.35)
      .from(
        q("[data-intro=card]"),
        {
          y: 56,
          opacity: 0,
          scale: 0.95,
          rotate: -2,
          duration: 0.9,
          transformOrigin: "50% 100%",
        },
        0.55,
      )
      .from(
        q("[data-intro=card-title]"),
        { opacity: 0, y: 8, duration: 0.4 },
        1.2,
      )
      .fromTo(bar, { width: "0%" }, { width: "0%", duration: 0.01 }, 1.2)
      .from(rows, { opacity: 0, x: -14, duration: 0.45, stagger: 0.1 }, 1.3);

    // Tick the two finished tasks one after another; the progress bar follows.
    const doneRows = rows.filter((r) => r.dataset.done === "true");
    ticks.forEach((tick, i) => {
      const at = 1.9 + i * 0.5;
      tl.to(
        tick,
        { strokeDashoffset: 0, duration: 0.45, ease: "power2.inOut" },
        at,
      )
        .call(() => doneRows[i]?.classList.add("is-done"), null, at + 0.25)
        .to(
          bar,
          { width: `${(i + 1) * 33}%`, duration: 0.6, ease: "power2.out" },
          at,
        );
    });
  }, root);

  return () => {
    ctx.revert(); // restores inline styles
    rows.forEach(
      (r) => r.dataset.done === "true" && r.classList.add("is-done"),
    );
  };
}

/* ------------------------------------------------------------------ *
 * 2. Finishing a list: confetti in the list's accent colour
 * ------------------------------------------------------------------ */
export function celebrate(anchor) {
  if (!anchor || reducedMotion()) return;

  const rect = anchor.getBoundingClientRect();
  const style = getComputedStyle(anchor);
  const accent = style.getPropertyValue("--c-accent").trim() || "#f0b24b";
  const fg = style.getPropertyValue("--c-fg").trim() || "#ffffff";
  const palette = [
    accent,
    accent,
    accent,
    `color-mix(in srgb, ${accent} 55%, white)`,
    `color-mix(in srgb, ${accent} 70%, black)`,
    fg,
  ];

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:80;overflow:hidden";
  document.body.appendChild(layer);

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const pieces = Array.from({ length: 72 }, () => {
    const el = document.createElement("i");
    const round = Math.random() < 0.3;
    const w = gsap.utils.random(6, 11);
    el.style.cssText =
      `position:absolute;left:${cx}px;top:${cy}px;width:${w}px;height:${round ? w : w * gsap.utils.random(0.4, 0.7)}px;` +
      `background:${gsap.utils.random(palette)};border-radius:${round ? "50%" : "2px"};will-change:transform`;
    layer.appendChild(el);
    return el;
  });

  const done = () => layer.remove();
  const tl = gsap.timeline({ onComplete: done });
  pieces.forEach((el) => {
    const angle = gsap.utils.random(-165, -15) * (Math.PI / 180); // fan upwards
    const power = gsap.utils.random(160, 520);
    const dur = gsap.utils.random(1.4, 2.2);
    const peak = Math.sin(angle) * power;
    tl.to(
      el,
      { x: Math.cos(angle) * power, duration: dur, ease: "power1.out" },
      0,
    )
      .to(el, { y: peak, duration: dur * 0.42, ease: "power2.out" }, 0)
      .to(
        el,
        {
          y: peak + gsap.utils.random(280, 560),
          duration: dur * 0.58,
          ease: "power2.in",
        },
        dur * 0.42,
      )
      .to(
        el,
        {
          rotation: gsap.utils.random(-720, 720),
          rotationX: gsap.utils.random(0, 540),
          duration: dur,
          ease: "none",
        },
        0,
      )
      .to(el, { opacity: 0, duration: 0.45, ease: "power1.in" }, dur - 0.45);
  });
  setTimeout(done, 4000); // safety net

  // A quick pulse on the bar itself.
  gsap.fromTo(
    anchor,
    { scaleY: 1 },
    { scaleY: 2.6, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" },
  );
}

/* ------------------------------------------------------------------ *
 * 3. App load: sidebar + first list stagger in (once per page load)
 * ------------------------------------------------------------------ */
let workspaceIntroStarted = false;

export function playWorkspaceIntro(root) {
  if (workspaceIntroStarted || !root) return;
  workspaceIntroStarted = true;
  if (reducedMotion()) return;

  const all = (sel) => [...root.querySelectorAll(sel)];
  const clear = { clearProps: "opacity,transform" }; // leave no inline styles behind
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.from(all("[data-anim=topbar]"), {
    opacity: 0,
    y: -8,
    duration: 0.4,
    ...clear,
  })
    .from(
      all("[data-anim=nav]"),
      { opacity: 0, x: -12, duration: 0.4, stagger: 0.045, ...clear },
      0.05,
    )
    .from(
      all("[data-anim=row]"),
      { opacity: 0, x: -12, duration: 0.4, stagger: 0.04, ...clear },
      0.25,
    )
    .from(
      all("[data-anim=block]"),
      { opacity: 0, y: 16, duration: 0.55, stagger: 0.08, ...clear },
      0.2,
    )
    .from(
      all("[data-anim=item]").slice(0, 14),
      { opacity: 0, y: 12, duration: 0.45, stagger: 0.045, ...clear },
      0.5,
    );
}
