import { useLayoutEffect, useRef } from "react";
import { Check } from "lucide-react";
import { ShareCard } from "./mock";
import { Words } from "./common";
import { playShare } from "../../lib/landingMotion";

const POINTS = [
  "Viewers need no account. Editors sign in first.",
  "Let the link expire in a day, a week or a month.",
  "Add people by email. They get access when they sign in.",
  "Switch the link off any time. Everyone who came through it is removed.",
];

const face =
  "grid size-11 place-items-center rounded-full border border-line bg-surface text-sm font-medium shadow-pop";

export function ShareShowcase() {
  const ref = useRef(null);
  useLayoutEffect(() => playShare(ref.current), []);

  return (
    <section
      id="sharing"
      ref={ref}
      aria-labelledby="sharing-title"
      className="relative isolate overflow-x-clip py-28 sm:py-36"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div data-speed="0.18" className="absolute top-10 right-[-6rem]">
          <div
            className="size-[28rem] rounded-full blur-3xl"
            style={{
              background:
                "color-mix(in srgb, var(--c-accent) 16%, transparent)",
            }}
          />
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
        <div>
          <p className="text-sm font-medium text-accent-ink">Sharing</p>
          <h2
            id="sharing-title"
            data-sh="title"
            className="mt-3 font-serif text-5xl leading-[0.98] sm:text-7xl"
          >
            <Words text="Share it the way you share a doc." scope="sh" />
          </h2>
          <ul data-sh="points" className="mt-9 space-y-4">
            {POINTS.map((p) => (
              <li key={p} data-sh="point" className="flex gap-3 text-muted">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent/15 text-accent-ink">
                  <Check className="size-3" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div
            data-speed="0.12"
            className="absolute -top-6 -left-6 z-10 max-sm:hidden"
            aria-hidden
          >
            <div data-float className={face}>
              S
            </div>
          </div>
          <div
            data-speed="-0.08"
            className="absolute -right-5 bottom-24 z-10 max-sm:hidden"
            aria-hidden
          >
            <div data-float className={`${face} text-accent-ink`}>
              M
            </div>
          </div>
          <div
            data-speed="0.1"
            className="absolute bottom-2 -left-8 z-10 max-sm:hidden"
            aria-hidden
          >
            <div data-float className={face}>
              A
            </div>
          </div>
          <ShareCard />
        </div>
      </div>
    </section>
  );
}
