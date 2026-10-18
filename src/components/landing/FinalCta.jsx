import { useLayoutEffect, useRef } from "react";
import { LandingCta, Words } from "./common";
import { playFinal } from "../../lib/landingMotion";

export function FinalCta() {
  const ref = useRef(null);
  useLayoutEffect(() => playFinal(ref.current), []);
  return (
    <section
      id="start"
      ref={ref}
      aria-labelledby="final-title"
      className="relative isolate overflow-clip py-32 text-center sm:py-44"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div data-speed="0.25" className="absolute top-0 left-[10%]">
          <div
            className="size-[26rem] rounded-full blur-3xl"
            style={{
              background:
                "color-mix(in srgb, var(--c-accent) 20%, transparent)",
            }}
          />
        </div>
        <div data-speed="-0.15" className="absolute right-[8%] bottom-0">
          <div
            className="size-[24rem] rounded-full blur-3xl"
            style={{
              background: "color-mix(in srgb, #6c7dff 18%, transparent)",
            }}
          />
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-6">
        <h2
          id="final-title"
          data-final="title"
          className="font-serif text-[clamp(3.2rem,10vw,8rem)] leading-[0.95] tracking-tight"
        >
          <Words text="Start a list" scope="final" /> <br />
          <em className="text-accent-ink">
            <Words text="that stays put." scope="final" />
          </em>
        </h2>
        <p
          data-final="rest"
          className="mx-auto mt-8 max-w-md text-lg text-muted"
        >
          Name it, fill it, share it. It is all there next time you open it.
        </p>
        <div data-final="rest" className="mt-10 flex justify-center">
          <span data-magnetic className="inline-block">
            <LandingCta size="lg" />
          </span>
        </div>
      </div>
    </section>
  );
}
