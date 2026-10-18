import { useLayoutEffect, useRef } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { MockRow, MockWindow, ShareCard } from "./mock";
import { playStory } from "../../lib/landingMotion";

const STEPS = [
  {
    title: "Capture",
    text: "Type, press Enter, repeat. Tasks with checkboxes and plain notes sit side by side, and everything saves as you go.",
  },
  {
    title: "Nest",
    text: "Break anything into sub-items, as deep as you need. A parent finishes itself the moment everything inside it is done.",
  },
  {
    title: "Share",
    text: "Send one link as a viewer or an editor, with an optional expiry, or add people by email.",
  },
];

export function StoryPin() {
  const ref = useRef(null);
  useLayoutEffect(() => playStory(ref.current), []);

  return (
    <section
      id="story"
      ref={ref}
      aria-labelledby="story-title"
      className="relative"
    >
      {/* This block stays on screen while you scroll; the picture on the right plays along. */}
      <div
        data-s="stage"
        className="flex min-h-[100svh] items-center py-20 max-lg:pt-24 max-lg:pb-8"
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <p className="text-sm font-medium text-accent-ink">How it works</p>
            <h2
              id="story-title"
              className="mt-3 font-serif text-4xl leading-none sm:text-6xl lg:text-7xl"
            >
              Capture. <em className="text-accent-ink">Nest.</em> Share.
            </h2>
            <ol className="relative mt-6 space-y-6 lg:mt-9 lg:pl-9">
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  data-s="step"
                  data-active="true"
                  className="group relative data-[active=false]:max-lg:hidden"
                >
                  {/* The line down to the next dot: grey underneath, amber filling as you scroll.
                      The last step has none, so the line ends exactly at the last dot. */}
                  {i < STEPS.length - 1 && (
                    <>
                      <span
                        aria-hidden
                        className="absolute top-[13.5px] -left-[29px] h-[calc(100%+1.5rem)] w-px bg-line max-lg:hidden"
                      />
                      <span
                        data-s="rail"
                        aria-hidden
                        className="absolute top-[13.5px] -left-[29px] h-[calc(100%+1.5rem)] w-px origin-top bg-accent max-lg:hidden"
                      />
                    </>
                  )}
                  <span
                    aria-hidden
                    className="absolute top-1.5 -left-9 grid size-[15px] place-items-center rounded-full border border-line-strong bg-bg transition-colors group-data-[active=true]:border-accent max-lg:hidden"
                  >
                    <span className="size-1.5 rounded-full bg-faint transition-colors group-data-[active=true]:bg-accent" />
                  </span>
                  <h3 className="text-xl font-medium transition-colors group-data-[active=false]:text-faint">
                    {i + 1}. {s.title}
                  </h3>
                  <p className="mt-1 max-w-md text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>

          <div data-s="frame" className="relative mx-auto w-full max-w-[30rem]">
            <MockWindow title="Weekend trip">
              <div data-s="list" className="p-4">
                <div className="flex items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2 text-[14px]">
                  <Plus className="size-4 shrink-0 text-faint" />
                  <span
                    data-s="typed"
                    className="min-h-5 min-w-0 flex-1 truncate empty:before:text-faint empty:before:content-['Add_an_item…']"
                  />
                  <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-on-accent">
                    Add
                  </span>
                </div>
                <div data-s="progress" className="mt-3">
                  <p data-s="count" className="text-[13px] text-muted">
                    <b className="font-medium text-fg">4</b> of 5 tasks done
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised">
                    <div
                      data-s="bar"
                      className="h-full origin-left rounded-full bg-accent"
                      style={{ transform: "scaleX(0.8)" }}
                    />
                  </div>
                </div>
                <div className="relative mt-3 space-y-0.5">
                  <span
                    data-s="guide"
                    aria-hidden
                    className="absolute top-[70px] left-[19px] h-[88px] w-px bg-line-strong"
                  />
                  <MockRow id="book" label="Book train tickets" done />
                  <MockRow
                    id="pack"
                    label="Pack"
                    done
                    badge={
                      <>
                        <span
                          data-s="badge"
                          className="text-xs text-faint tabular-nums"
                        >
                          3/3
                        </span>
                        <ChevronDown
                          data-s="chev"
                          className="size-4 text-faint"
                        />
                      </>
                    }
                  />
                  <MockRow id="passport" label="Passport" done indent={26} />
                  <MockRow
                    id="charger"
                    label="Phone charger"
                    done
                    indent={26}
                  />
                  <MockRow id="jacket" label="Rain jacket" done indent={26} />
                  <MockRow id="cabin" label="Reserve the cabin" />
                </div>
              </div>
            </MockWindow>
            {/* Appears in the last third of the scroll. */}
            <div
              data-s="share"
              aria-hidden
              className="invisible absolute inset-x-0 top-0 z-10 opacity-0 sm:top-[-2.5rem]"
            >
              <ShareCard compact />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
