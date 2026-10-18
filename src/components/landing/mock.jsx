// Pretend app screens for the landing page. They are pictures, not controls, so they are
// hidden from screen readers; the surrounding text says everything that matters.
import { ChevronDown, Clock, Copy, Globe, Lock, Mail } from "lucide-react";

export function TickBox({ done = false }) {
  return (
    <span
      data-box
      className="relative grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-line-strong bg-surface"
    >
      <span
        data-fill
        className="absolute inset-0 rounded-[4px] bg-accent"
        style={{ opacity: done ? 1 : 0 }}
      />
      <svg viewBox="0 0 16 16" className="relative size-3.5">
        <path
          data-tick
          d="M3 8.5l3.2 3.2L13 4.8"
          fill="none"
          stroke="var(--c-on-accent)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
          style={{ strokeDasharray: 1, strokeDashoffset: done ? 0 : 1 }}
        />
      </svg>
    </span>
  );
}

export function MockRow({
  id,
  label,
  done = false,
  plain = false,
  indent = 0,
  badge,
  children,
}) {
  return (
    <div
      data-row={id}
      style={{ marginLeft: indent }}
      className="relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[14px]"
    >
      {plain ? (
        <span className="grid size-[18px] shrink-0 place-items-center">
          <span className="size-1.5 rounded-full bg-faint" />
        </span>
      ) : (
        <TickBox done={done} />
      )}
      <span className="min-w-0 flex-1 truncate">
        {/* The strike-through is as wide as the words, not the whole row. */}
        <span className="relative inline-block max-w-full truncate align-top">
          <span
            data-label
            className={plain ? "text-muted" : ""}
            style={done ? { opacity: 0.45 } : undefined}
          >
            {label}
          </span>
          {!plain && (
            <span
              data-strike
              className="absolute top-1/2 left-0 block h-px w-full origin-left bg-faint"
              style={{ transform: `scaleX(${done ? 1 : 0})` }}
            />
          )}
        </span>
      </span>
      {badge}
      {children}
    </div>
  );
}

export function MockWindow({ title, className = "", children, ...rest }) {
  return (
    <div
      aria-hidden
      className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-pop ${className}`}
      {...rest}
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="flex gap-1.5">
          <i className="size-2.5 rounded-full bg-line-strong" />
          <i className="size-2.5 rounded-full bg-line-strong" />
          <i className="size-2.5 rounded-full bg-line-strong" />
        </span>
        <span className="ml-2 text-[13px] text-muted">{title}</span>
      </div>
      {children}
    </div>
  );
}

const pill =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised pr-1.5 pl-2.5 text-[13px]";

// The Google Docs-style share window, in its finished state. initShare() in
// landingMotion.js rewinds it and shareSequence() plays it forward.
// `compact` drops the "Add people" form and the people list on small screens, where the
// card sits inside the pinned story and has to fit next to the text.
export function ShareCard({ className = "", compact = false }) {
  const extra = compact ? "max-sm:hidden" : "";
  return (
    <div
      aria-hidden
      data-share-card
      className={`relative rounded-2xl border border-line bg-surface p-5 text-left shadow-pop ${className}`}
    >
      <p className="font-serif text-xl">Share “Weekend trip”</p>

      <p className={`mt-4 text-[12px] font-medium text-muted ${extra}`}>
        Add people
      </p>
      <div className={`mt-1.5 flex items-center gap-2 ${extra}`}>
        <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg border border-line bg-raised px-3 text-[13px]">
          <span
            data-share="email-text"
            className="empty:before:text-faint empty:before:content-['name@example.com']"
          />
        </div>
        <span className={pill}>
          Can view <ChevronDown className="size-3.5 text-muted" />
        </span>
        <span
          data-share="add"
          className="inline-grid h-9 place-items-center rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent"
        >
          Add
        </span>
      </div>

      <p className={`mt-4 text-[12px] font-medium text-muted ${extra}`}>
        People with access
      </p>
      <ul
        className={`mt-1.5 divide-y divide-line rounded-xl border border-line text-[13px] ${extra}`}
      >
        <li className="flex items-center gap-2.5 px-3 py-2">
          <span className="grid size-6 place-items-center rounded-full bg-raised text-[11px] font-medium">
            A
          </span>
          <span className="flex-1">
            Aditya <span className="text-faint">(you)</span>
          </span>
          <span className="rounded bg-raised px-1.5 py-0.5 text-xs text-muted">
            Owner
          </span>
        </li>
        <li data-share="joined" className="flex items-center gap-2.5 px-3 py-2">
          <span className="grid size-6 place-items-center rounded-full bg-raised text-[11px] font-medium">
            S
          </span>
          <span className="flex-1">
            Sam <span className="text-xs text-faint">via link</span>
          </span>
          <span className="text-xs text-muted">Can edit</span>
        </li>
        <li
          data-share="pending"
          className="flex items-center gap-2.5 px-3 py-2"
        >
          <span className="grid size-6 place-items-center rounded-full bg-raised text-muted">
            <Mail className="size-3" />
          </span>
          <span className="flex-1 truncate">
            maya@studio.co{" "}
            <span className="ml-1 rounded bg-raised px-1.5 py-0.5 text-xs text-muted">
              Pending
            </span>
          </span>
          <span className="text-xs text-muted">Can edit</span>
        </li>
      </ul>

      <div className="relative mt-4 rounded-xl border border-line p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative grid size-5 place-items-center text-muted">
            <Lock data-share="lock" className="absolute size-4 opacity-0" />
            <Globe data-share="globe" className="absolute size-4" />
          </span>
          <p className="text-[13px] font-medium">General access</p>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span data-share="access" className={pill}>
            <span data-share="access-label">Anyone with the link</span>
            <ChevronDown className="size-3.5 text-muted" />
          </span>
          <span data-share="role" className={pill}>
            <span data-share="role-label">Editor</span>
            <ChevronDown className="size-3.5 text-muted" />
          </span>
          <span data-share="expiry" className={pill}>
            <Clock className="size-3.5 text-muted" />
            <span data-share="expiry-label">In 7 days</span>
            <ChevronDown className="size-3.5 text-muted" />
          </span>
        </div>
        <div data-share="link-row" className="mt-2.5 flex items-center gap-2">
          <span className="h-9 min-w-0 flex-1 truncate rounded-lg border border-line bg-raised px-3 text-[13px] leading-9 text-muted">
            ordly-lists.vercel.app/s/c1de9bdd6e3e…
          </span>
          <span
            data-share="copy"
            className="relative inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-[13px]"
          >
            <Copy className="size-3.5" />
            <span data-share="copy-label">Copy</span>
            <span
              data-share="ring"
              className="pointer-events-none absolute -inset-1 rounded-xl border-2 border-accent opacity-0"
            />
          </span>
        </div>

        <div
          data-share="menu"
          className="invisible absolute top-[4.4rem] left-3.5 z-10 w-52 rounded-xl border border-line bg-surface p-1 opacity-0 shadow-pop"
        >
          <div className="rounded-lg px-2.5 py-2 text-[13px]">Restricted</div>
          <div className="relative rounded-lg px-2.5 py-2 text-[13px]">
            <span
              data-share="option-hot"
              className="absolute inset-0 rounded-lg bg-raised"
            />
            <span className="relative">Anyone with the link</span>
          </div>
        </div>
      </div>
    </div>
  );
}
