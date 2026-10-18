// Every animation on the landing page lives here; components only call these functions.
// Nothing runs for people who asked for reduced motion (the page is then a normal, still
// page that shows its finished state), and everything is undone when the page unmounts.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
// Phones resize the viewport as the address bar slides away; don't re-measure on that.
ScrollTrigger.config({ ignoreMobileResize: true });

const MOTION = "(prefers-reduced-motion: no-preference)";
const HOVER = "(hover: hover) and (pointer: fine)";

const reduced = () =>
  typeof window !== "undefined" && !window.matchMedia(MOTION).matches;

// Runs `build` only when motion is allowed. `build` gets { q, hover, root } where q selects
// inside `root`, and hover says whether a mouse is available (for pointer effects).
function withMotion(root, build) {
  if (!root) return () => {};
  const mm = gsap.matchMedia();
  mm.add(
    { motion: MOTION, hover: HOVER },
    ({ conditions }) => {
      if (!conditions.motion) return;
      return build({
        q: gsap.utils.selector(root),
        hover: !!conditions.hover,
        root,
      });
    },
    root,
  );
  return () => mm.revert();
}

// Fonts change the page's height, so measure again once they are in.
export function refreshWhenFontsLoad() {
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

/** Smooth-scroll to a section (an instant jump for reduced motion). */
export function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (reduced()) return el.scrollIntoView();
  gsap.to(window, {
    duration: 1.1,
    ease: "power3.inOut",
    scrollTo: { y: el, offsetY: 64 },
  });
}

/* ---------------------------------------------------------------- *
 * Small building blocks
 * ---------------------------------------------------------------- */

// Drift layers at different speeds while `trigger` scrolls past (a parallax effect).
// data-speed="0.3" moves 30% of a screen up over the scroll; negative moves down.
function parallaxLayers(q, trigger) {
  gsap.utils.toArray(q("[data-speed]")).forEach((el) => {
    const speed = parseFloat(el.dataset.speed);
    gsap.to(el, {
      y: () => -speed * window.innerHeight,
      ease: "none",
      scrollTrigger: {
        trigger,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
  });
}

// Layers that follow the pointer a little, deeper layers further.
function pointerLayers(q, root) {
  const layers = gsap.utils.toArray(q("[data-depth]")).map((el) => ({
    x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3.out" }),
    y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3.out" }),
    depth: parseFloat(el.dataset.depth),
  }));
  const onMove = (e) => {
    const r = root.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    layers.forEach((l) => {
      l.x(nx * l.depth * 60);
      l.y(ny * l.depth * 60);
    });
  };
  root.addEventListener("pointermove", onMove);
  return () => root.removeEventListener("pointermove", onMove);
}

// A button that leans toward the pointer.
function magnetic(el, strength = 0.35) {
  const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
  const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
  const move = (e) => {
    const r = el.getBoundingClientRect();
    x((e.clientX - (r.left + r.width / 2)) * strength);
    y((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const leave = () => {
    x(0);
    y(0);
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", leave);
  return () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerleave", leave);
  };
}

// Tilt a card toward the pointer and move its spotlight under it.
function tiltCard(card) {
  const rx = gsap.quickTo(card, "rotationX", {
    duration: 0.5,
    ease: "power3.out",
  });
  const ry = gsap.quickTo(card, "rotationY", {
    duration: 0.5,
    ease: "power3.out",
  });
  gsap.set(card, { transformPerspective: 900 });
  const move = (e) => {
    const r = card.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    ry((nx - 0.5) * 8);
    rx((0.5 - ny) * 8);
    card.style.setProperty("--mx", `${nx * 100}%`);
    card.style.setProperty("--my", `${ny * 100}%`);
  };
  const leave = () => {
    rx(0);
    ry(0);
  };
  card.addEventListener("pointermove", move);
  card.addEventListener("pointerleave", leave);
  return () => {
    card.removeEventListener("pointermove", move);
    card.removeEventListener("pointerleave", leave);
  };
}

// Types `text` into `el` over the timeline (a proxy number drives the characters shown).
function typeInto(tl, el, text, at, duration) {
  const p = { n: 0 };
  tl.to(
    p,
    {
      n: text.length,
      duration,
      ease: "none",
      onUpdate: () => {
        el.textContent = text.slice(0, Math.round(p.n));
      },
    },
    at,
  );
}
const setText = (tl, el, text, at) =>
  tl.call(() => (el.textContent = text), null, at);

// Ticks a mock row: the box fills, the check draws itself, the label gets struck through.
function tickRow(tl, row, at) {
  const part = (s) => row.querySelector(s);
  tl.fromTo(
    part("[data-box]"),
    { scale: 1 },
    { scale: 1.2, duration: 0.12, yoyo: true, repeat: 1 },
    at,
  )
    .to(part("[data-fill]"), { opacity: 1, duration: 0.18 }, at)
    .to(
      part("[data-tick]"),
      { strokeDashoffset: 0, duration: 0.28, ease: "power2.out" },
      at + 0.05,
    )
    .to(
      part("[data-strike]"),
      { scaleX: 1, duration: 0.32, ease: "power2.out" },
      at + 0.08,
    )
    .to(part("[data-label]"), { opacity: 0.45, duration: 0.3 }, at + 0.08);
}
// Puts a mock row back to "not done" instantly.
function untickRow(row) {
  const part = (s) => row.querySelector(s);
  gsap.set(part("[data-fill]"), { opacity: 0 });
  gsap.set(part("[data-tick]"), { strokeDashoffset: 1 });
  gsap.set(part("[data-strike]"), { scaleX: 0 });
  gsap.set(part("[data-label]"), { opacity: 1 });
}

/* ---------------------------------------------------------------- *
 * The share window demo (used by the scroll story and the sharing section)
 * ---------------------------------------------------------------- */

// Puts the share window in its "nothing shared yet" starting state.
function initShare(card) {
  const $ = (s) => card.querySelector(s);
  gsap.set($("[data-share=menu]"), { autoAlpha: 0, y: -6, scale: 0.96 });
  gsap.set($("[data-share=option-hot]"), { opacity: 0 });
  gsap.set($("[data-share=globe]"), { opacity: 0 });
  gsap.set($("[data-share=lock]"), { opacity: 1 });
  gsap.set(
    card.querySelectorAll(
      "[data-share=link-row], [data-share=role], [data-share=expiry]",
    ),
    { autoAlpha: 0, y: 8 },
  );
  gsap.set($("[data-share=pending]"), { autoAlpha: 0, y: 10 });
  gsap.set($("[data-share=joined]"), { autoAlpha: 0, y: 10 });
  gsap.set($("[data-share=ring]"), { opacity: 0, scale: 0.6 });
  $("[data-share=access-label]").textContent = "Restricted";
  $("[data-share=role-label]").textContent = "Viewer";
  $("[data-share=expiry-label]").textContent = "Never expires";
  $("[data-share=email-text]").textContent = "";
  $("[data-share=copy-label]").textContent = "Copy";
}

// Adds the share demo to `tl`, starting at `t0`; k stretches or squeezes its pacing.
function shareSequence(tl, card, t0, k = 1) {
  const $ = (s) => card.querySelector(s);
  const T = (x) => t0 + x * k;
  const D = (x) => x * k;

  // General access: open the menu, pick "Anyone with the link".
  tl.to(
    $("[data-share=menu]"),
    { autoAlpha: 1, y: 0, scale: 1, duration: D(0.3), ease: "power3.out" },
    T(0.3),
  )
    .to($("[data-share=option-hot]"), { opacity: 1, duration: D(0.2) }, T(0.8))
    .to(
      $("[data-share=menu]"),
      { autoAlpha: 0, y: -6, duration: D(0.25) },
      T(1.2),
    )
    .call(
      () =>
        ($("[data-share=access-label]").textContent = "Anyone with the link"),
      null,
      T(1.2),
    )
    .to($("[data-share=lock]"), { opacity: 0, duration: D(0.2) }, T(1.2))
    .to($("[data-share=globe]"), { opacity: 1, duration: D(0.2) }, T(1.2))
    .to(
      $("[data-share=link-row]"),
      { autoAlpha: 1, y: 0, duration: D(0.4), ease: "power3.out" },
      T(1.35),
    )
    .to(
      card.querySelectorAll("[data-share=role], [data-share=expiry]"),
      { autoAlpha: 1, y: 0, duration: D(0.35), stagger: D(0.1) },
      T(1.6),
    );

  // Viewer -> Editor, then an expiry.
  tl.fromTo(
    $("[data-share=role]"),
    { scale: 1 },
    { scale: 0.93, duration: D(0.1), yoyo: true, repeat: 1 },
    T(2.1),
  );
  setText(tl, $("[data-share=role-label]"), "Editor", T(2.15));
  tl.fromTo(
    $("[data-share=expiry]"),
    { scale: 1 },
    { scale: 0.93, duration: D(0.1), yoyo: true, repeat: 1 },
    T(2.6),
  );
  setText(tl, $("[data-share=expiry-label]"), "In 7 days", T(2.65));

  // Add someone by email.
  typeInto(tl, $("[data-share=email-text]"), "maya@studio.co", T(3), D(0.6));
  tl.fromTo(
    $("[data-share=add]"),
    { scale: 1 },
    { scale: 0.9, duration: D(0.1), yoyo: true, repeat: 1 },
    T(3.7),
  );
  setText(tl, $("[data-share=email-text]"), "", T(3.75));
  tl.to(
    $("[data-share=pending]"),
    { autoAlpha: 1, y: 0, duration: D(0.4), ease: "power3.out" },
    T(3.8),
  ).to(
    $("[data-share=joined]"),
    { autoAlpha: 1, y: 0, duration: D(0.4), ease: "power3.out" },
    T(4.3),
  );

  // Copy the link.
  tl.fromTo(
    $("[data-share=copy]"),
    { scale: 1 },
    { scale: 0.92, duration: D(0.1), yoyo: true, repeat: 1 },
    T(4.8),
  );
  setText(tl, $("[data-share=copy-label]"), "Copied", T(4.85));
  tl.fromTo(
    $("[data-share=ring]"),
    { opacity: 0.7, scale: 0.6 },
    { opacity: 0, scale: 1.5, duration: D(0.6), ease: "power2.out" },
    T(4.85),
  );
  return T(5.4);
}

/* ---------------------------------------------------------------- *
 * Sections
 * ---------------------------------------------------------------- */

export function playNav(root) {
  return withMotion(root, ({ q }) => {
    gsap.fromTo(
      q("[data-nav=progress]"),
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: document.documentElement,
          start: 0,
          end: "max",
          scrub: 0.3,
        },
      },
    );
    gsap.from(q("[data-nav=item]"), {
      y: -14,
      opacity: 0,
      duration: 0.7,
      stagger: 0.07,
      ease: "power3.out",
      delay: 0.1,
    });
  });
}

export function playHero(root) {
  return withMotion(root, ({ q, hover }) => {
    const cleanups = [];

    // Entrance
    gsap.set(q("[data-hero=window]"), { transformPerspective: 1400 });
    const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
    intro
      .from(q("[data-hero=eyebrow]"), { y: 16, opacity: 0, duration: 0.7 })
      .from(
        q("[data-hero=word]"),
        { yPercent: 115, duration: 1.1, stagger: 0.08 },
        0.1,
      )
      .from(q("[data-hero=sub]"), { y: 20, opacity: 0, duration: 0.9 }, 0.55)
      .from(
        q("[data-hero=cta]"),
        { y: 20, opacity: 0, duration: 0.8, stagger: 0.1 },
        0.7,
      )
      .from(
        q("[data-hero=window]"),
        {
          y: 100,
          opacity: 0,
          rotateX: 24,
          scale: 0.9,
          duration: 1.5,
          ease: "power3.out",
        },
        0.45,
      )
      .from(
        q("[data-hero=chip]"),
        {
          scale: 0.5,
          opacity: 0,
          duration: 0.8,
          stagger: 0.14,
          ease: "back.out(1.8)",
        },
        1.2,
      );

    // The window lies back at first and stands up as you scroll.
    gsap.fromTo(
      q("[data-hero=tilt]"),
      { rotateX: 14, scale: 0.94, transformPerspective: 1400 },
      {
        rotateX: 0,
        scale: 1,
        ease: "none",
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "bottom 80%",
          scrub: 0.6,
        },
      },
    );
    gsap.to(q("[data-hero=copy]"), {
      y: -60,
      opacity: 0.1,
      ease: "none",
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "60% top",
        scrub: true,
      },
    });
    parallaxLayers(q, root);

    // Chips bob gently.
    gsap.utils.toArray(q("[data-float]")).forEach((el, i) =>
      gsap.to(el, {
        y: i % 2 ? 12 : -12,
        duration: 2.6 + i * 0.5,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      }),
    );
    if (hover) cleanups.push(pointerLayers(q, root));
    q("[data-magnetic]").forEach((el) => cleanups.push(magnetic(el)));

    // The checklist in the window ticks itself, then starts over.
    const demo = root.querySelector("[data-demo=window]");
    if (demo) {
      const row = (id) => demo.querySelector(`[data-row=${id}]`);
      const count = demo.querySelector("[data-demo=count]");
      const badge = demo.querySelector("[data-demo=badge]");
      const bar = demo.querySelector("[data-demo=bar]");
      const glow = demo.querySelector("[data-demo=glow]");
      const kids = ["passport", "charger", "jacket"];
      const total = 5;
      const state = (done, inside) => {
        count.innerHTML = `<b class="font-medium text-fg">${done}</b> of ${total} tasks done`;
        badge.textContent = `${inside}/3`;
      };
      const loop = gsap.timeline({
        repeat: -1,
        delay: 1.8,
        defaults: { ease: "power2.out" },
      });
      loop.call(
        () => {
          [...kids, "pack"].forEach((id) => untickRow(row(id)));
          state(1, 0);
        },
        null,
        0,
      );
      loop.set(bar, { scaleX: 0.2 }, 0).set(glow, { opacity: 0 }, 0);
      kids.forEach((id, i) => {
        const at = 0.8 + i * 0.7;
        tickRow(loop, row(id), at);
        loop.call(() => state(2 + i, i + 1), null, at + 0.1);
        loop.to(
          bar,
          { scaleX: 0.4 + i * 0.2, duration: 0.4, ease: "power2.out" },
          at,
        );
      });
      tickRow(loop, row("pack"), 3.1);
      loop.fromTo(glow, { opacity: 0.9 }, { opacity: 0, duration: 0.9 }, 3.1);
      loop.to({}, { duration: 2.8 }, 3.2); // hold the finished picture
    }

    return () => cleanups.forEach((fn) => fn());
  });
}

export function playMarquee(root) {
  return withMotion(root, ({ q }) => {
    const rows = gsap.utils.toArray(q("[data-marquee=row]"));
    const tweens = rows.map((row, i) =>
      gsap.fromTo(
        row,
        { xPercent: i % 2 ? -50 : 0 },
        { xPercent: i % 2 ? 0 : -50, duration: 42, ease: "none", repeat: -1 },
      ),
    );
    // Scrolling fast speeds the ribbons up (and scrolling up turns them around).
    ScrollTrigger.create({
      trigger: root,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 260, 7);
        tweens.forEach((t) =>
          gsap.to(t, {
            timeScale: self.direction * boost,
            duration: 0.25,
            overwrite: true,
          }),
        );
        gsap.to(tweens, {
          timeScale: self.direction,
          duration: 1.2,
          delay: 0.2,
          overwrite: "auto",
        });
      },
    });
    gsap.from(root, {
      opacity: 0,
      y: 40,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: root, start: "top 90%" },
    });
  });
}

// The pinned "Capture, nest, share" story. Scrolling plays one timeline; the page stays put.
export function playStory(root) {
  return withMotion(root, () => {
    const stage = root.querySelector("[data-s=stage]");
    const frame = root.querySelector("[data-s=frame]");
    const rowOf = (id) => frame.querySelector(`[data-row=${id}]`);
    const order = ["book", "pack", "passport", "charger", "jacket", "cabin"];
    const labels = {
      book: "Book train tickets",
      pack: "Pack",
      passport: "Passport",
      charger: "Phone charger",
      jacket: "Rain jacket",
      cabin: "Reserve the cabin",
    };
    const composer = frame.querySelector("[data-s=typed]");
    const list = frame.querySelector("[data-s=list]");
    const share = frame.querySelector("[data-s=share]");
    const count = frame.querySelector("[data-s=count]");
    const bar = frame.querySelector("[data-s=bar]");
    const progress = frame.querySelector("[data-s=progress]");
    const badge = frame.querySelector("[data-s=badge]");
    const kids = ["passport", "charger", "jacket"];
    const total = 5;
    const setCount = (done) =>
      (count.innerHTML = `<b class="font-medium text-fg">${done}</b> of ${total} tasks done`);

    // Start from an empty list.
    order.forEach((id) => {
      untickRow(rowOf(id));
      gsap.set(rowOf(id), { autoAlpha: 0, y: 14 });
    });
    gsap.set(frame.querySelector("[data-s=guide]"), {
      scaleY: 0,
      transformOrigin: "top",
    });
    gsap.set(frame.querySelectorAll("[data-s=chev], [data-s=badge]"), {
      opacity: 0,
    });
    gsap.set(progress, { autoAlpha: 0 });
    gsap.set(bar, { scaleX: 0 });
    composer.textContent = "";
    setCount(0);
    badge.textContent = "0/3";
    gsap.set(share, { autoAlpha: 0, y: 50, scale: 0.95 });
    initShare(share);
    root.querySelectorAll("[data-s=step]").forEach((el, n) => {
      el.dataset.active = n === 0 ? "true" : "false";
    });
    gsap.set(root.querySelector("[data-s=rail]"), { scaleY: 0 });

    const tl = gsap.timeline({
      defaults: { ease: "power2.out" },
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * 3.2)}`,
        pin: stage,
        scrub: 0.7,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const i = self.progress < 0.34 ? 0 : self.progress < 0.68 ? 1 : 2;
          root.querySelectorAll("[data-s=step]").forEach((el, n) => {
            el.dataset.active = n === i ? "true" : "false";
          });
          gsap.set(root.querySelector("[data-s=rail]"), {
            scaleY: self.progress,
          });
        },
      },
    });

    // 1. Capture: type each item, press Enter.
    order.forEach((id, i) => {
      const t = i * 0.32;
      typeInto(tl, composer, labels[id], t, 0.2);
      tl.to(rowOf(id), { autoAlpha: 1, y: 0, duration: 0.2 }, t + 0.22);
      setText(tl, composer, "", t + 0.25);
    });

    // 2. Nest: indent the three, tick them, the parent finishes by itself.
    tl.to(progress, { autoAlpha: 1, duration: 0.2 }, 2.2)
      .to(kids.map(rowOf), { x: 26, duration: 0.35, stagger: 0.1 }, 2.3)
      .to(
        frame.querySelector("[data-s=guide]"),
        { scaleY: 1, duration: 0.4 },
        2.45,
      )
      .to(
        frame.querySelectorAll("[data-s=chev], [data-s=badge]"),
        { opacity: 1, duration: 0.3 },
        2.6,
      );
    kids.forEach((id, i) => {
      const at = 3.0 + i * 0.4;
      tickRow(tl, rowOf(id), at);
      tl.call(
        () => {
          setCount(i + 1);
          badge.textContent = `${i + 1}/3`;
        },
        null,
        at + 0.1,
      );
      tl.to(bar, { scaleX: (i + 1) / total, duration: 0.3 }, at);
    });
    tickRow(tl, rowOf("pack"), 4.35);
    tickRow(tl, rowOf("book"), 4.7);
    tl.call(() => setCount(4), null, 4.8).to(
      bar,
      { scaleX: 4 / total, duration: 0.3 },
      4.7,
    );

    // 3. Share: the list steps back, the share window comes forward.
    tl.to(
      list,
      { scale: 0.93, opacity: 0.25, filter: "blur(3px)", duration: 0.5 },
      5.3,
    ).to(
      share,
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out" },
      5.45,
    );
    const end = shareSequence(tl, share, 5.9, 0.42);
    tl.to({}, { duration: 0.4 }, end); // a beat at the end
  });
}

export function playBento(root) {
  return withMotion(root, ({ q, hover }) => {
    const cleanups = [];
    const cards = gsap.utils.toArray(q("[data-card]"));

    gsap.from(q("[data-bento=word]"), {
      yPercent: 115,
      duration: 1,
      stagger: 0.06,
      ease: "power4.out",
      scrollTrigger: { trigger: q("[data-bento=title]")[0], start: "top 85%" },
    });

    // Cards rise in as they arrive.
    gsap.set(cards, { opacity: 0, y: 60, scale: 0.96 });
    ScrollTrigger.batch(cards, {
      start: "top 90%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.9,
          stagger: 0.1,
          ease: "power3.out",
          overwrite: true,
        }),
    });

    // The pictures inside each card drift at their own pace as it scrolls by.
    gsap.utils.toArray(q("[data-parallax]")).forEach((el) => {
      const amount = parseFloat(el.dataset.parallax);
      gsap.fromTo(
        el,
        { yPercent: -amount },
        {
          yPercent: amount,
          ease: "none",
          scrollTrigger: {
            trigger: el.closest("[data-card]"),
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    });

    // Little loops that only run while their card is on screen.
    const whenVisible = (card) => ({
      trigger: card,
      toggleActions: "play pause resume pause",
    });

    const reorder = q("[data-loop=reorder]")[0];
    if (reorder) {
      const rows = reorder.querySelectorAll("[data-r]");
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.6,
        scrollTrigger: whenVisible(reorder.closest("[data-card]")),
      });
      tl.to(
        rows[0],
        {
          y: 44,
          scale: 1.04,
          boxShadow: "0 10px 24px -8px rgba(0,0,0,.45)",
          duration: 0.6,
          ease: "power2.inOut",
        },
        0.5,
      )
        .to(rows[1], { y: -44, duration: 0.6, ease: "power2.inOut" }, 0.5)
        .to(
          rows[0],
          { scale: 1, boxShadow: "0 0 0 rgba(0,0,0,0)", duration: 0.25 },
          1.1,
        )
        .to(rows, { y: 0, duration: 0.5, ease: "power2.inOut" }, 2.4);
    }

    const search = q("[data-loop=search]")[0];
    if (search) {
      const text = search.querySelector("[data-typed]");
      const chips = search.querySelectorAll("[data-chip]");
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.8,
        scrollTrigger: whenVisible(search.closest("[data-card]")),
      });
      tl.call(() => (text.textContent = ""), null, 0);
      typeInto(tl, text, "passport", 0.4, 0.8);
      tl.to(chips[0], { opacity: 0.4, duration: 0.2 }, 1.4).to(
        chips[1],
        { opacity: 1, duration: 0.2 },
        1.4,
      );
      tl.to({}, { duration: 1.2 }, 1.6).to(
        chips[0],
        { opacity: 1, duration: 0.1 },
        2.9,
      );
    }

    const sync = q("[data-loop=sync]")[0];
    if (sync) {
      const dot = sync.querySelector("[data-dot]");
      const a = sync.querySelector("[data-dev=a]");
      const b = sync.querySelector("[data-dev=b]");
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.4,
        scrollTrigger: whenVisible(sync.closest("[data-card]")),
      });
      tl.fromTo(
        a,
        { scale: 1 },
        { scale: 1.04, duration: 0.2, yoyo: true, repeat: 1 },
        0,
      )
        .fromTo(
          dot,
          { x: 0, opacity: 0 },
          { x: 150, opacity: 1, duration: 0.9, ease: "power1.inOut" },
          0.2,
        )
        .to(dot, { opacity: 0, duration: 0.15 }, 1.05)
        .fromTo(
          b,
          { scale: 1 },
          { scale: 1.04, duration: 0.2, yoyo: true, repeat: 1 },
          1.05,
        );
    }

    if (hover) cards.forEach((c) => cleanups.push(tiltCard(c)));
    return () => cleanups.forEach((fn) => fn());
  });
}

export function playShare(root) {
  return withMotion(root, ({ q }) => {
    const card = q("[data-share-card]")[0];
    if (!card) return;
    initShare(card);
    gsap.set(card, { opacity: 0, y: 70 });

    gsap.from(q("[data-sh=word]"), {
      yPercent: 115,
      duration: 1,
      stagger: 0.06,
      ease: "power4.out",
      scrollTrigger: { trigger: q("[data-sh=title]")[0], start: "top 85%" },
    });
    gsap.from(q("[data-sh=point]"), {
      x: -24,
      opacity: 0,
      duration: 0.7,
      stagger: 0.12,
      ease: "power3.out",
      scrollTrigger: { trigger: q("[data-sh=points]")[0], start: "top 85%" },
    });

    // The window plays through once when it comes into view, and again if you return.
    const tl = gsap.timeline({
      defaults: { ease: "power2.out" },
      scrollTrigger: {
        trigger: card,
        start: "top 72%",
        toggleActions: "play none none reset",
      },
    });
    tl.to(card, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 0);
    shareSequence(tl, card, 0.7);

    // Floating faces drift at different speeds.
    parallaxLayers(q, root);
    gsap.utils.toArray(q("[data-float]")).forEach((el, i) =>
      gsap.to(el, {
        y: i % 2 ? 10 : -10,
        duration: 2.8 + i * 0.4,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      }),
    );
  });
}

export function playFinal(root) {
  return withMotion(root, ({ q, hover }) => {
    const cleanups = [];
    gsap.from(q("[data-final=word]"), {
      yPercent: 115,
      duration: 1.2,
      stagger: 0.09,
      ease: "power4.out",
      scrollTrigger: { trigger: root, start: "top 65%" },
    });
    gsap.fromTo(
      q("[data-final=title]"),
      { scale: 0.86 },
      {
        scale: 1,
        ease: "none",
        scrollTrigger: {
          trigger: root,
          start: "top bottom",
          end: "center center",
          scrub: true,
        },
      },
    );
    gsap.from(q("[data-final=rest]"), {
      y: 24,
      opacity: 0,
      duration: 0.9,
      stagger: 0.12,
      ease: "power3.out",
      scrollTrigger: { trigger: root, start: "top 55%" },
    });
    parallaxLayers(q, root);
    if (hover)
      q("[data-magnetic]").forEach((el) => cleanups.push(magnetic(el)));
    return () => cleanups.forEach((fn) => fn());
  });
}
