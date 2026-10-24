import { CalendarDays, Flag } from "lucide-react";
import { dueState, formatDue } from "../../utils/due";
import { priorityLabel } from "../../utils/meta";

const dueTone = {
  overdue: "border-danger/50 bg-danger/10 text-danger",
  today: "border-accent/50 bg-accent/10 text-accent-ink",
  soon: "border-line-strong text-fg",
  later: "border-line text-muted",
  done: "border-line text-faint",
};
const priorityTone = {
  1: "border-line text-muted",
  2: "border-accent/40 text-accent-ink",
  3: "border-danger/50 bg-danger/10 text-danger",
};
const chip =
  "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[11px] leading-none whitespace-nowrap";

// A due date as a small pill: red when overdue, accent when due today.
export function DueChip({ source, done = false, now }) {
  const state = dueState(source, { now, done });
  if (!state) return null;
  const spoken = { overdue: "Overdue: ", done: "Was due: " }[state] ?? "Due: ";
  return (
    <span className={`${chip} ${dueTone[state]}`} data-due={state}>
      <CalendarDays className="size-3" aria-hidden />
      <span className="sr-only">{spoken}</span>
      {formatDue(source, now)}
    </span>
  );
}

export function PriorityChip({ priority }) {
  if (!priority) return null;
  return (
    <span className={`${chip} ${priorityTone[priority]}`}>
      <Flag className="size-3" aria-hidden />
      <span className="sr-only">Priority: </span>
      {priorityLabel(priority)}
    </span>
  );
}

// Tags as pills. With `onPick` they are buttons (used to filter by that tag).
export function TagChips({ tags = [], onPick }) {
  return tags.map((t) =>
    onPick ? (
      <button
        key={t}
        type="button"
        onClick={() => onPick(t)}
        title={`Show only #${t}`}
        className={`${chip} cursor-pointer border-line text-muted transition-colors hover:border-line-strong hover:text-fg`}
      >
        #{t}
      </button>
    ) : (
      <span key={t} className={`${chip} border-line text-muted`}>
        #{t}
      </span>
    ),
  );
}
