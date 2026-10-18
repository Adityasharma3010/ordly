import { useLayoutEffect, useRef } from "react";
import { GripVertical, Mail, Search } from "lucide-react";
import { MockRow, TickBox } from "./mock";
import { Words } from "./common";
import { playBento } from "../../lib/landingMotion";

const spot = {
  background:
    "radial-gradient(420px circle at var(--mx,50%) var(--my,0%), color-mix(in srgb, var(--c-accent) 13%, transparent), transparent 60%)",
};

function Card({ title, text, className = "", children }) {
  return (
    <article
      data-card
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-7 ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={spot}
      />
      <div aria-hidden className="relative mb-6 flex-1">
        {children}
      </div>
      <h3 className="relative text-lg font-medium">{title}</h3>
      <p className="relative mt-1.5 text-[15px] leading-relaxed text-muted">
        {text}
      </p>
    </article>
  );
}

const panel = "rounded-2xl border border-line bg-raised/60 p-3";
const pill =
  "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-[13px]";

export function FeatureBento() {
  const ref = useRef(null);
  useLayoutEffect(() => playBento(ref.current), []);

  return (
    <section
      id="features"
      ref={ref}
      aria-labelledby="features-title"
      className="relative pt-16 pb-28 sm:pt-20 sm:pb-36"
    >
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-sm font-medium text-accent-ink">Features</p>
        <h2
          id="features-title"
          data-bento="title"
          className="mt-3 max-w-3xl font-serif text-5xl leading-[0.98] sm:text-7xl"
        >
          <Words text="Everything a list needs." scope="bento" />{" "}
          <em className="text-muted">
            <Words text="Nothing it doesn’t." scope="bento" />
          </em>
        </h2>

        <div className="mt-16 grid gap-4 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title="Sub-items that finish themselves"
            text="Nest tasks as deep as you like. A parent ticks itself when everything inside is done, and ticking a parent ticks everything inside."
          >
            <div data-parallax="6" className={panel}>
              <MockRow
                id="a"
                label="Plan the launch"
                done
                badge={<span className="text-xs text-faint">3/3</span>}
              />
              <MockRow id="b" label="Write the announcement" done indent={26} />
              <MockRow id="c" label="Record the demo" done indent={26} />
              <MockRow id="d" label="Schedule the posts" done indent={26} />
              <MockRow
                id="e"
                label="Tidy the backlog"
                badge={<span className="text-xs text-faint">0/2</span>}
              />
              <MockRow id="f" label="Close stale tickets" indent={26} />
            </div>
          </Card>

          <Card
            title="Drag to reorder"
            text="Put things in the order that makes sense to you. Ordly remembers it."
          >
            <div
              data-parallax="8"
              data-loop="reorder"
              className={`${panel} space-y-1.5`}
            >
              {["Buy oat milk", "Call the plumber", "Renew passport"].map(
                (t) => (
                  <div
                    key={t}
                    data-r
                    className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-[14px]"
                  >
                    <GripVertical className="size-4 text-faint" />
                    <TickBox />
                    {t}
                  </div>
                ),
              )}
            </div>
          </Card>

          <Card
            title="Share with one link"
            text="Viewers need no account. Editors sign in first. Switch between the two whenever you like."
          >
            <div data-parallax="8" className={`${panel} space-y-2`}>
              <div className="flex gap-2">
                <span className={pill}>Anyone with the link</span>
                <span className={pill}>Editor</span>
              </div>
              <div className="truncate rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-muted">
                ordly-lists.vercel.app/s/c1de9bdd…
              </div>
            </div>
          </Card>

          <Card
            title="Add people by email"
            text="Name who can view or edit. They get access the moment they sign in with that address."
          >
            <div data-parallax="10" className={`${panel} space-y-2`}>
              <div className="flex items-center gap-2 text-[13px]">
                <span className="grid size-6 place-items-center rounded-full bg-surface text-muted">
                  <Mail className="size-3" />
                </span>
                <span className="flex-1 truncate">maya@studio.co</span>
                <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-muted">
                  Pending
                </span>
              </div>
              <div className="flex items-center gap-2 text-[13px]">
                <span className="grid size-6 place-items-center rounded-full bg-surface text-[11px] font-medium">
                  S
                </span>
                <span className="flex-1">Sam</span>
                <span className="text-xs text-muted">Can edit</span>
              </div>
            </div>
          </Card>

          <Card
            title="Find it fast"
            text="Search inside a list, filter to what is left, and sort by status or date."
          >
            <div
              data-parallax="8"
              data-loop="search"
              className={`${panel} space-y-2.5`}
            >
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-[14px]">
                <Search className="size-4 text-faint" />
                <span
                  data-typed
                  className="min-h-5 flex-1 empty:before:text-faint empty:before:content-['Search_this_list']"
                >
                  passport
                </span>
              </div>
              <div className="flex gap-1.5 text-[13px] text-muted">
                <span
                  data-chip
                  className="rounded-md bg-surface px-2 py-1 text-fg"
                >
                  All
                </span>
                <span data-chip className="rounded-md px-2 py-1">
                  Active
                </span>
                <span data-chip className="rounded-md px-2 py-1">
                  Completed
                </span>
              </div>
            </div>
          </Card>

          <Card
            className="lg:col-span-3"
            title="Saves as you type, shows up everywhere"
            text="There is no save button. Changes are kept as you make them, and appear on every device you are signed in on."
          >
            <div
              data-parallax="6"
              data-loop="sync"
              className="flex items-center justify-center gap-4 py-2 sm:gap-8"
            >
              <div
                data-dev="a"
                className="w-40 rounded-xl border border-line bg-raised/60 p-2.5 sm:w-52"
              >
                <MockRow id="s1" label="Passport" done />
                <MockRow id="s2" label="Phone charger" />
              </div>
              <div className="relative h-6 w-[150px] max-sm:hidden">
                <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
                <span
                  data-dot
                  className="absolute top-1/2 left-0 -mt-1 size-2 rounded-full bg-accent"
                />
              </div>
              <div
                data-dev="b"
                className="w-28 rounded-xl border border-line bg-raised/60 p-2 sm:w-32"
              >
                <MockRow id="s3" label="Passport" done />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
