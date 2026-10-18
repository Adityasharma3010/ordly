import { useLayoutEffect, useRef } from "react";
import { playMarquee } from "../../lib/landingMotion";

const ROW_A = [
  "🛒 Groceries",
  "🧳 Packing list",
  "🎓 Study plan",
  "🏗️ Project tasks",
  "🎉 Party prep",
  "📚 Reading list",
  "🏡 Moving day",
  "💍 Wedding checklist",
];
const ROW_B = [
  "🧹 Weekly chores",
  "🌱 Garden jobs",
  "🎬 Watch next",
  "🚗 Road trip",
  "🍳 Meal prep",
  "🧾 Tax paperwork",
  "🎁 Gift ideas",
  "🛠️ Home repairs",
];

function Row({ items, tone }) {
  // Four copies, so the ribbon is longer than any screen and can loop without a gap.
  const all = [...items, ...items, ...items, ...items];
  return (
    <div data-marquee="row" className="flex w-max gap-3 pr-3">
      {all.map((t, i) => (
        <span
          key={i}
          className={`rounded-full border border-line px-6 py-3 whitespace-nowrap ${tone}`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export function UseCaseMarquee() {
  const ref = useRef(null);
  useLayoutEffect(() => playMarquee(ref.current), []);
  return (
    <section
      ref={ref}
      aria-label="Things people keep lists for"
      className="relative overflow-hidden border-y border-line py-12"
    >
      <p className="mb-8 text-center text-sm text-faint">
        Made for everything you would otherwise forget
      </p>
      {/* Decorative ribbon; the sentence above and the sections below carry the meaning. */}
      <div aria-hidden className="space-y-3">
        <Row items={ROW_A} tone="bg-surface text-xl text-fg" />
        <Row items={ROW_B} tone="text-lg text-muted" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-bg to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-bg to-transparent"
      />
    </section>
  );
}
