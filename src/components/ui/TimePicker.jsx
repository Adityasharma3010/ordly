import { useEffect, useLayoutEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "../../lib/animations";
import { joinTime, shortTime, splitTime } from "../../utils/calendar";
import { PickerPanel } from "./PickerPanel";
import { usePopover } from "./usePopover";
import { triggerClass } from "./DatePicker";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const QUICK = [
  ["09:00", "Morning"],
  ["12:00", "Noon"],
  ["18:00", "Evening"],
];
const two = (n) => String(n).padStart(2, "0");

/**
 * A time picker in the app's own style: hour, minute and AM/PM columns. `value` is "HH:MM"
 * (24-hour) or null; `onChange` gets the new time, or null when cleared. Arrow keys move
 * inside a column, Left/Right jump between columns, Enter picks, Escape closes.
 */
export function TimePicker({ value, onChange, label, labelledBy, disabled }) {
  const popover = usePopover();
  return (
    <>
      <button
        type="button"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-haspopup="dialog"
        aria-expanded={popover.open}
        disabled={disabled}
        onClick={(e) =>
          popover.open
            ? popover.close()
            : popover.openFor(e.currentTarget, { width: 248, height: 330 })
        }
        className={`${triggerClass} min-w-36`}
      >
        <Clock className="size-4 shrink-0 text-muted" aria-hidden />
        <span className={value ? "" : "text-faint"}>
          {value ? shortTime(value) : "Add a time"}
        </span>
      </button>
      {popover.open && (
        <Columns popover={popover} value={value} onChange={onChange} />
      )}
    </>
  );
}

function Columns({ popover, value, onChange }) {
  const cur = splitTime(value) || { h12: 9, m: 0, pm: false };
  const colRefs = useRef({});

  // Open with the chosen hour/minute scrolled into view, and keyboard focus on the hour.
  useLayoutEffect(() => {
    for (const col of Object.values(colRefs.current)) {
      const on = col?.querySelector("[aria-selected=true]");
      if (on)
        col.scrollTop =
          on.offsetTop - col.clientHeight / 2 + on.offsetHeight / 2;
    }
  }, []);
  useEffect(() => {
    const first =
      colRefs.current.hour?.querySelector("[aria-selected=true]") ||
      colRefs.current.hour?.querySelector("button");
    first?.focus();
  }, []);

  const set = (patch, el) => {
    onChange(joinTime({ ...cur, ...patch }));
    if (el && !prefersReducedMotion())
      gsap.fromTo(
        el,
        { scale: 0.86 },
        { scale: 1, duration: 0.24, ease: "back.out(3)" },
      );
  };

  // Arrow keys: Up/Down inside a column, Left/Right to the neighbouring column.
  const onKeyDown = (e) => {
    const btn = e.target.closest?.("button[data-col]");
    if (!btn) return;
    const order = ["hour", "minute", "ampm"];
    const col = btn.dataset.col;
    const list = [...colRefs.current[col].querySelectorAll("button")];
    const i = list.indexOf(btn);
    let next = null;
    if (e.key === "ArrowDown") next = list[Math.min(list.length - 1, i + 1)];
    if (e.key === "ArrowUp") next = list[Math.max(0, i - 1)];
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const to = order[order.indexOf(col) + (e.key === "ArrowRight" ? 1 : -1)];
      const there = to && colRefs.current[to];
      next =
        there?.querySelector("[aria-selected=true]") ||
        there?.querySelector("button");
    }
    if (next) {
      e.preventDefault();
      next.focus();
      next.scrollIntoView?.({ block: "nearest" });
    }
  };

  const option = (on) =>
    `grid h-8 w-full cursor-pointer place-items-center rounded-lg text-sm tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${on ? "bg-accent font-semibold text-on-accent" : "text-fg hover:bg-raised"}`;
  const column = (name, label, items) => (
    <div
      ref={(el) => (colRefs.current[name] = el)}
      role="listbox"
      aria-label={label}
      className="scroll-thin h-44 flex-1 space-y-0.5 overflow-y-auto pr-0.5"
    >
      {items}
    </div>
  );

  return (
    <PickerPanel popover={popover} label="Choose a time" onKeyDown={onKeyDown}>
      <div className="mb-2 flex gap-1.5">
        {QUICK.map(([t, name]) => (
          <button
            key={t}
            type="button"
            title={shortTime(t)}
            onClick={(e) => {
              onChange(t);
              if (!prefersReducedMotion())
                gsap.fromTo(
                  e.currentTarget,
                  { scale: 0.9 },
                  { scale: 1, duration: 0.22, ease: "back.out(3)" },
                );
            }}
            className={`h-7 cursor-pointer rounded-full border px-2.5 text-xs transition-colors ${value === t ? "border-accent bg-accent/15 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg"}`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5">
        {column(
          "hour",
          "Hour",
          HOURS.map((h) => (
            <button
              key={h}
              type="button"
              role="option"
              data-col="hour"
              aria-selected={!!value && cur.h12 === h}
              tabIndex={cur.h12 === h ? 0 : -1}
              onClick={(e) => set({ h12: h }, e.currentTarget)}
              className={option(!!value && cur.h12 === h)}
            >
              {h}
            </button>
          )),
        )}
        {column(
          "minute",
          "Minute",
          MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              role="option"
              data-col="minute"
              aria-selected={!!value && cur.m === m}
              tabIndex={cur.m === m ? 0 : -1}
              onClick={(e) => set({ m }, e.currentTarget)}
              className={option(!!value && cur.m === m)}
            >
              {two(m)}
            </button>
          )),
        )}
        {column(
          "ampm",
          "AM or PM",
          [
            ["AM", false],
            ["PM", true],
          ].map(([t, pm]) => (
            <button
              key={t}
              type="button"
              role="option"
              data-col="ampm"
              aria-selected={!!value && cur.pm === pm}
              tabIndex={cur.pm === pm ? 0 : -1}
              onClick={(e) => set({ pm }, e.currentTarget)}
              className={option(!!value && cur.pm === pm)}
            >
              {t}
            </button>
          )),
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[13px]">
        <button
          type="button"
          disabled={!value}
          onClick={() => {
            onChange(null);
            popover.close();
          }}
          className="h-8 cursor-pointer rounded-lg px-2.5 text-muted transition-colors hover:bg-raised hover:text-fg disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => {
            if (!value) onChange(joinTime(cur));
            popover.close();
          }}
          className="h-8 cursor-pointer rounded-lg px-2.5 font-medium text-accent-ink transition-colors hover:bg-raised"
        >
          Done
        </button>
      </div>
    </PickerPanel>
  );
}
