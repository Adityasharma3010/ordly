import { useRef, useState } from "react";
import { Pipette } from "lucide-react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "../../lib/animations";
import { hexToHsv, hsvToHex, normalizeHex } from "../../utils/color";

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const canPickFromScreen = () =>
  typeof window !== "undefined" && "EyeDropper" in window;

/**
 * A colour picker in the app's own style: a shade square, a hue slider, a hex box, "Pick from
 * screen" (the browser's eyedropper, where it has one) and a row of ready-made colours.
 * `value` is "#rrggbb"; `onChange` gets the new one as it changes.
 */
export function ColorField({ value, onChange, presets = [] }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [text, setText] = useState(value);
  const area = useRef(null);
  const dragging = useRef(false);
  const swatch = useRef(null);
  const hex = hsvToHex(hsv);

  const flash = () => {
    if (swatch.current && !prefersReducedMotion())
      gsap.fromTo(
        swatch.current,
        { scale: 0.86 },
        { scale: 1, duration: 0.3, ease: "back.out(3)" },
      );
  };

  const commit = (next) => {
    setHsv(next);
    const h = hsvToHex(next);
    setText(h);
    onChange(h);
  };
  // Set from a finished colour (a ready-made one, the eyedropper, the hex box). Greys and
  // blacks have no hue of their own, so the hue slider stays where it was.
  const setHex = (raw) => {
    const n = normalizeHex(raw);
    if (!n) return false;
    const next = hexToHsv(n);
    if (next.s === 0 || next.v === 0) next.h = hsv.h;
    commit(next);
    return true;
  };

  const pickShade = (e) => {
    const r = area.current.getBoundingClientRect();
    if (!r.width || !r.height) return;
    commit({
      h: hsv.h,
      s: clamp((e.clientX - r.left) / r.width),
      v: 1 - clamp((e.clientY - r.top) / r.height),
    });
  };

  const onAreaKey = (e) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const move = {
      ArrowLeft: { s: -step },
      ArrowRight: { s: step },
      ArrowUp: { v: step },
      ArrowDown: { v: -step },
    }[e.key];
    if (!move) return;
    e.preventDefault();
    commit({
      h: hsv.h,
      s: clamp(hsv.s + (move.s || 0)),
      v: clamp(hsv.v + (move.v || 0)),
    });
  };

  const pickFromScreen = async () => {
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      if (setHex(sRGBHex)) flash();
    } catch {
      /* closed without picking */
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={area}
        role="slider"
        tabIndex={0}
        aria-label="Colour shade"
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={onAreaKey}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          pickShade(e);
        }}
        onPointerMove={(e) => dragging.current && pickShade(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        className="relative h-36 w-full cursor-crosshair rounded-lg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        style={{
          touchAction: "none",
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.45),0_2px_6px_rgb(0_0_0/0.5)]"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            background: hex,
          }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={359}
        value={Math.round(hsv.h)}
        aria-label="Hue"
        onChange={(e) => commit({ ...hsv, h: Number(e.target.value) })}
        className="hue-slider block w-full cursor-pointer"
      />

      <div className="flex flex-wrap items-center gap-2">
        <span
          ref={swatch}
          aria-hidden
          className="size-9 shrink-0 rounded-lg border border-line-strong"
          style={{ background: hex }}
        />
        <input
          aria-label="Hex colour"
          value={text}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            // Apply as soon as six digits are there; a short "#fb4" waits for Enter / leaving.
            if (/^#?[0-9a-f]{6}$/i.test(e.target.value.trim()))
              setHex(e.target.value);
          }}
          onBlur={() => {
            if (!setHex(text)) setText(hex);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!setHex(text)) setText(hex);
            }
          }}
          className="h-9 w-28 rounded-lg border border-line bg-raised px-3 font-mono text-sm text-fg uppercase focus:border-accent focus:outline-none"
        />
        {canPickFromScreen() && (
          <button
            type="button"
            onClick={pickFromScreen}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-[13px] text-fg transition-colors hover:border-line-strong"
          >
            <Pipette className="size-4" aria-hidden />
            Pick from screen
          </button>
        )}
      </div>

      {presets.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Ready-made colours"
        >
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              aria-label={`Use ${p}`}
              onClick={() => {
                if (setHex(p)) flash();
              }}
              className="size-6 cursor-pointer rounded-full border border-black/20"
              style={{ background: p }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
