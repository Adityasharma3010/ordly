import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "../../lib/animations";
import { dayKey } from "../../utils/due";
import {
  addDays,
  addMonths,
  longDay,
  monthGrid,
  monthLabel,
  parseDay,
  shortDay,
  weekday,
  WEEKDAYS,
} from "../../utils/calendar";
import { PickerPanel } from "./PickerPanel";
import { usePopover } from "./usePopover";

export const triggerClass =
  "inline-flex h-9 min-w-40 cursor-pointer items-center gap-2 rounded-lg border border-line bg-raised px-3 text-sm text-fg transition-colors hover:border-line-strong focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-expanded:border-accent";

/**
 * A date picker in the app's own style (instead of the browser's). `value` is "YYYY-MM-DD"
 * or null; `onChange` gets the new day, or null when cleared. Keyboard: arrows move by a day
 * or a week, PageUp/PageDown by a month (with Shift, a year), Home/End to the start or end
 * of the week, Enter picks, Escape closes.
 */
export function DatePicker({ value, onChange, label, labelledBy, disabled }) {
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
            : popover.openFor(e.currentTarget, { width: 296, height: 360 })
        }
        className={triggerClass}
      >
        <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
        <span className={value ? "" : "text-faint"}>
          {value ? shortDay(value) : "Pick a date"}
        </span>
      </button>
      {popover.open && (
        <Calendar popover={popover} value={value} onChange={onChange} />
      )}
    </>
  );
}

function Calendar({ popover, value, onChange }) {
  const today = dayKey();
  const [focus, setFocus] = useState(value || today); // the day the keyboard is on
  const [view, setView] = useState(() => {
    const { y, m } = parseDay(value || today);
    return { y, m };
  });
  const gridRef = useRef(null);
  const dayRefs = useRef({});
  const slide = useRef(0); // -1 / 1 = which way the month just moved
  const shown = useRef(false);

  // Put keyboard focus on the focused day (on open, and as the arrows move it).
  useEffect(() => {
    dayRefs.current[focus]?.focus();
  }, [focus, view]);

  // The month slides in from the side it came from.
  useLayoutEffect(() => {
    if (!shown.current) {
      shown.current = true;
      return;
    }
    const el = gridRef.current;
    if (!el || !slide.current || prefersReducedMotion()) return;
    gsap.fromTo(
      el,
      { x: slide.current * 28, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.28, ease: "power3.out" },
    );
  }, [view]);

  const goTo = (key, dir = 0) => {
    const { y, m } = parseDay(key);
    if (y !== view.y || m !== view.m) {
      slide.current = dir || (y * 12 + m > view.y * 12 + view.m ? 1 : -1);
      setView({ y, m });
    }
    setFocus(key);
  };
  const stepMonth = (n) => {
    const to = addMonths(
      `${view.y}-${String(view.m + 1).padStart(2, "0")}-01`,
      n,
    );
    const { y, m } = parseDay(to);
    slide.current = n;
    setView({ y, m });
    // Keep the keyboard on the same day-of-month if there is one.
    setFocus(addMonths(focus, n));
  };

  const pick = (key, el) => {
    onChange(key);
    if (prefersReducedMotion() || !el) return popover.close();
    gsap.fromTo(
      el,
      { scale: 0.78 },
      {
        scale: 1,
        duration: 0.22,
        ease: "back.out(3)",
        onComplete: () => popover.close(),
      },
    );
  };

  const onKeyDown = (e) => {
    const move = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      Home: () => addDays(focus, -weekday(focus)),
      End: () => addDays(focus, 6 - weekday(focus)),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
    }[e.key];
    if (!move) return;
    e.preventDefault();
    goTo(move());
  };

  const days = monthGrid(view.y, view.m);
  const nav =
    "grid size-8 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-fg";

  return (
    <PickerPanel popover={popover} label="Choose a date" onKeyDown={onKeyDown}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => stepMonth(-1)}
          className={nav}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <div
          aria-live="polite"
          className="font-serif text-lg leading-none text-fg"
        >
          {monthLabel(view.y, view.m)}
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => stepMonth(1)}
          className={nav}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <div aria-hidden className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1 text-[11px] font-medium text-faint">
            {d}
          </span>
        ))}
      </div>

      <div ref={gridRef} role="group" aria-label={monthLabel(view.y, view.m)}>
        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map((key) => {
            const { m, d } = parseDay(key);
            const inMonth = m === view.m;
            const selected = key === value;
            const isToday = key === today;
            return (
              <button
                key={key}
                ref={(el) => {
                  if (el) dayRefs.current[key] = el;
                  else delete dayRefs.current[key];
                }}
                type="button"
                tabIndex={key === focus ? 0 : -1}
                aria-label={longDay(key)}
                aria-pressed={selected}
                aria-current={isToday ? "date" : undefined}
                onClick={(e) => pick(key, e.currentTarget)}
                className={`mx-auto grid size-9 cursor-pointer place-items-center rounded-full text-[13px] tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                  selected
                    ? "bg-accent font-semibold text-on-accent"
                    : isToday
                      ? "border border-accent/60 text-fg hover:bg-raised"
                      : inMonth
                        ? "text-fg hover:bg-raised"
                        : "text-faint hover:bg-raised"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
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
          onClick={(e) => {
            goTo(today);
            pick(today, dayRefs.current[today] || e.currentTarget);
          }}
          className="h-8 cursor-pointer rounded-lg px-2.5 font-medium text-accent-ink transition-colors hover:bg-raised"
        >
          Today
        </button>
      </div>
    </PickerPanel>
  );
}
