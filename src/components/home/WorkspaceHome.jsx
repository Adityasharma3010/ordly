import { useRef, useState } from "react";
import { ArrowUp, Plus, Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { STARTER_TEMPLATES } from "../../data/starterTemplates";
import { accentHex } from "../../utils/appearance";
import { timeAgo } from "../../utils/format";
import { getStats } from "../../utils/listStats";

// How many template chips fit under the name box (your own saved templates come first).
const CHIPS = 6;

const greeting = () => {
  const h = new Date().getHours();
  return h < 5
    ? "Burning the midnight oil"
    : h < 12
      ? "Good morning"
      : h < 18
        ? "Good afternoon"
        : "Good evening";
};

/**
 * What you see at /app before opening a list: name a new list and go, or jump back into
 * a recent one. With no lists yet it doubles as the first-run screen.
 */
export function WorkspaceHome({
  lists,
  templates = [],
  userName,
  onCreate,
  onTemplate,
  onAllTemplates,
  onCustomize,
  onSample,
  onOpen,
}) {
  const [title, setTitle] = useState("");
  const inputRef = useRef(null);
  const recent = lists
    .filter((l) => !l.archived)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 6);
  const first = lists.length === 0;
  const chips = [...templates.slice(0, 3), ...STARTER_TEMPLATES].slice(
    0,
    CHIPS,
  );
  const firstName = (userName || "").split(" ")[0];

  const submit = (e) => {
    e.preventDefault();
    if (title.trim()) onCreate(title.trim());
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-6 pt-16 pb-20 sm:pt-24">
      <div className="text-center">
        <Sparkles className="mx-auto mb-4 size-7 text-accent" aria-hidden />
        <h1 className="font-serif text-4xl sm:text-5xl">
          {first
            ? "Make your first list"
            : `${greeting()}${firstName ? `, ${firstName}` : ""}`}
        </h1>
        <p className="mt-2 text-muted">
          {first
            ? "Lists can mix checkbox tasks with plain notes, and be shared with a link."
            : "What are you planning today?"}
        </p>
      </div>

      <form
        onSubmit={submit}
        className="mt-8 flex items-center gap-2 rounded-2xl border border-line bg-surface p-2 pl-4 shadow-sm transition-colors focus-within:border-accent/70"
      >
        <Plus className="size-5 shrink-0 text-faint" aria-hidden />
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          autoComplete="off"
          aria-label="Name for a new list"
          placeholder="Name a new list, like “Groceries”"
          className="min-w-0 flex-1 bg-transparent py-2 text-base placeholder:text-faint focus:outline-none"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          aria-label="Create list"
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-accent text-on-accent transition active:scale-95 enabled:hover:brightness-110 disabled:cursor-default disabled:opacity-35"
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
      </form>

      <p className="mt-6 text-center text-[11px] font-medium tracking-wider text-faint uppercase">
        Or start from a template
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {chips.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTemplate(t, title.trim())}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[13px] text-muted transition-colors hover:border-line-strong hover:bg-raised hover:text-fg"
          >
            <span aria-hidden>{t.icon}</span>
            {t.title}
          </button>
        ))}
        <button
          type="button"
          onClick={onAllTemplates}
          className="cursor-pointer rounded-full px-3 py-1 text-[13px] text-faint transition-colors hover:text-fg"
        >
          All templates…
        </button>
        <button
          type="button"
          onClick={onCustomize}
          className="cursor-pointer rounded-full px-3 py-1 text-[13px] text-faint transition-colors hover:text-fg"
        >
          More options…
        </button>
      </div>

      {first && (
        <div className="mt-6 flex justify-center">
          <Button size="lg" onClick={onSample}>
            Start with a sample
          </Button>
        </div>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="mt-14">
          <h2
            id="recent-heading"
            className="mb-3 text-[11px] font-medium tracking-wider text-faint uppercase"
          >
            Jump back in
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {recent.map((l) => {
              const s = getStats(l.items);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(l.id)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-raised"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg bg-raised text-[17px]"
                      style={{ color: accentHex(l.color) }}
                    >
                      {l.icon || (
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: accentHex(l.color) }}
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {l.title}
                      </span>
                      <span className="block truncate text-xs text-faint">
                        {s.total > 0 ? `${s.done} of ${s.total} done · ` : ""}
                        {timeAgo(l.updated_at)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
