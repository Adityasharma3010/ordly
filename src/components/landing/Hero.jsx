import { useLayoutEffect, useRef } from "react";
import { Check, Share2, Sparkles } from "lucide-react";
import { MockRow, MockWindow } from "./mock";
import { LandingCta, Words, ctaGhost, ctaSize } from "./common";
import { playHero, scrollToId } from "../../lib/landingMotion";

const orb = (pct) => ({
  background: `color-mix(in srgb, var(--c-accent) ${pct}%, transparent)`,
});

function Chip({ className, depth, children }) {
  return (
    <div
      data-hero="chip"
      className={`absolute z-10 hidden w-max lg:block ${className}`}
    >
      <div data-depth={depth}>
        <div data-float>
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface/90 px-3.5 py-2 text-[13px] whitespace-nowrap shadow-pop backdrop-blur">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const ref = useRef(null);
  useLayoutEffect(() => playHero(ref.current), []);

  return (
    <section
      id="top"
      ref={ref}
      aria-labelledby="hero-title"
      className="relative isolate overflow-x-clip pt-28 pb-20 sm:pt-36"
    >
      {/* Soft glows at different depths: they drift at their own speed as you scroll. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div data-speed="0.3" className="absolute -top-32 left-[4%]">
          <div
            data-depth="0.9"
            className="size-[30rem] rounded-full blur-3xl"
            style={orb(22)}
          />
        </div>
        <div data-speed="0.12" className="absolute top-40 -right-24">
          <div
            data-depth="0.5"
            className="size-[26rem] rounded-full blur-3xl"
            style={{
              background: "color-mix(in srgb, #6c7dff 20%, transparent)",
            }}
          />
        </div>
        <div data-speed="-0.1" className="absolute right-[30%] bottom-0">
          <div
            data-depth="0.3"
            className="size-72 rounded-full blur-3xl"
            style={orb(14)}
          />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <div data-hero="copy" className="mx-auto max-w-3xl text-center">
          <p
            data-hero="eyebrow"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3.5 py-1.5 text-[13px] text-muted backdrop-blur"
          >
            <Sparkles className="size-3.5 text-accent-ink" aria-hidden />
            New: sub-items that finish themselves
          </p>
          <h1
            id="hero-title"
            className="mt-6 font-serif text-[clamp(3.4rem,11vw,8rem)] leading-[0.92] tracking-tight"
          >
            <Words text="Lists that" scope="hero" />{" "}
            <em className="text-accent-ink">
              <Words text="stay put." scope="hero" />
            </em>
          </h1>
          <p
            data-hero="sub"
            className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-muted"
          >
            Ordly is a calm place for the checklists you actually finish. Break
            tasks into sub-items, tick them off, and share a list with one link.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <span data-hero="cta" className="inline-block">
              <span data-magnetic className="inline-block">
                <LandingCta size="lg" />
              </span>
            </span>
            <span data-hero="cta" className="inline-block">
              <a
                href="#story"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToId("story");
                }}
                className={`${ctaGhost} ${ctaSize.lg}`}
              >
                See how it works
              </a>
            </span>
          </div>
        </div>

        <div className="relative mx-auto mt-16 max-w-3xl sm:mt-24">
          <Chip className="top-10 right-[calc(100%-1.25rem)]" depth="1.2">
            <Check className="size-3.5 text-ok" aria-hidden /> Saved just now
          </Chip>
          <Chip className="top-44 left-[calc(100%-1.25rem)]" depth="0.8">
            <Share2 className="size-3.5 text-accent-ink" aria-hidden /> Shared ·
            can edit
          </Chip>
          <Chip className="bottom-12 right-[calc(100%-0.75rem)]" depth="0.6">
            <span className="size-2 rounded-full bg-accent" aria-hidden /> Pack
            finished itself
          </Chip>

          <div data-hero="window">
            <div data-hero="tilt">
              <MockWindow title="Weekend trip" data-demo="window">
                <div className="px-5 pt-4 pb-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-serif text-2xl">Weekend trip</p>
                    <p data-demo="count" className="text-[13px] text-muted">
                      <b className="font-medium text-fg">4</b> of 5 tasks done
                    </p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised">
                    <div
                      data-demo="bar"
                      className="h-full origin-left rounded-full bg-accent"
                      style={{ transform: "scaleX(0.8)" }}
                    />
                  </div>
                  <div className="mt-4 space-y-0.5">
                    <MockRow id="book" label="Book train tickets" done />
                    <MockRow
                      id="pack"
                      label="Pack"
                      done
                      badge={
                        <span
                          data-demo="badge"
                          className="text-xs text-faint tabular-nums"
                        >
                          3/3
                        </span>
                      }
                    >
                      <span
                        data-demo="glow"
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-lg opacity-0"
                        style={{
                          boxShadow:
                            "0 0 0 1px var(--c-accent), 0 0 28px color-mix(in srgb, var(--c-accent) 35%, transparent)",
                        }}
                      />
                    </MockRow>
                    <MockRow id="passport" label="Passport" done indent={26} />
                    <MockRow
                      id="charger"
                      label="Phone charger"
                      done
                      indent={26}
                    />
                    <MockRow id="jacket" label="Rain jacket" done indent={26} />
                    <MockRow id="cabin" label="Reserve the cabin" />
                    <MockRow
                      id="note"
                      label="Check the weather on Thursday"
                      plain
                    />
                  </div>
                </div>
              </MockWindow>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
