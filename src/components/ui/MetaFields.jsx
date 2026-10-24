import { useId, useState } from "react";
import { X } from "lucide-react";
import { addTags, PRIORITIES, removeTag, MAX_TAGS } from "../../utils/meta";
import { cleanTime } from "../../utils/due";
import { DatePicker } from "./DatePicker";
import { TimePicker } from "./TimePicker";

/**
 * Due date (+ optional time), priority and tags: the same fields for a list and for an item.
 * `value` is { due_date, due_time, priority, tags }; `onChange` gets just what changed.
 * `suggestions` are tags already used elsewhere, offered as you type.
 */
export function MetaFields({ value, onChange, suggestions = [] }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const tags = value.tags || [];

  const commitTag = (raw = draft) => {
    const next = addTags(tags, raw);
    if (next.length !== tags.length) onChange({ tags: next });
    setDraft("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span
            id={`${id}-date`}
            className="mb-1.5 block text-[13px] font-medium text-muted"
          >
            Due date
          </span>
          <DatePicker
            labelledBy={`${id}-date`}
            value={value.due_date || null}
            onChange={(d) =>
              onChange(d ? { due_date: d } : { due_date: null, due_time: null })
            }
          />
        </div>
        <div>
          <span
            id={`${id}-time`}
            className="mb-1.5 block text-[13px] font-medium text-muted"
          >
            Time (optional)
          </span>
          <TimePicker
            labelledBy={`${id}-time`}
            value={cleanTime(value.due_time)}
            disabled={!value.due_date}
            onChange={(t) => onChange({ due_time: t })}
          />
        </div>
        {value.due_date && (
          <button
            type="button"
            onClick={() => onChange({ due_date: null, due_time: null })}
            className="mb-1 h-7 cursor-pointer rounded-md px-2 text-[13px] text-muted transition-colors hover:bg-raised hover:text-fg"
          >
            Clear due date
          </button>
        )}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-muted">
          Priority
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={(value.priority || 0) === p.value}
              onClick={() => onChange({ priority: p.value })}
              className={`h-8 cursor-pointer rounded-lg border px-3 text-[13px] transition-colors ${(value.priority || 0) === p.value ? "border-accent bg-accent/15 text-fg" : "border-line bg-raised text-muted hover:border-line-strong hover:text-fg"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor={`${id}-tag`}
          className="mb-1.5 block text-[13px] font-medium text-muted"
        >
          Tags
        </label>
        <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-raised p-1.5 focus-within:border-accent">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex h-6 items-center gap-1 rounded-full border border-line pr-1 pl-2.5 text-xs text-fg"
            >
              #{t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                onClick={() => onChange({ tags: removeTag(tags, t) })}
                className="grid size-4 cursor-pointer place-items-center rounded-full text-faint hover:text-fg"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <input
            id={`${id}-tag`}
            list={`${id}-suggest`}
            value={draft}
            disabled={tags.length >= MAX_TAGS}
            onChange={(e) => {
              const v = e.target.value;
              // A comma finishes the tag, so "home, urgent" makes two.
              if (v.includes(",")) commitTag(v);
              else setDraft(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // don't submit the form around this field
                commitTag();
              }
              if (e.key === "Backspace" && !draft && tags.length)
                onChange({ tags: tags.slice(0, -1) });
            }}
            onBlur={() => draft && commitTag()}
            maxLength={40}
            autoComplete="off"
            placeholder={tags.length ? "" : "Type a tag and press Enter"}
            className="min-w-24 flex-1 bg-transparent px-1.5 text-sm placeholder:text-faint focus:outline-none"
          />
          <datalist id={`${id}-suggest`}>
            {suggestions
              .filter((t) => !tags.includes(t))
              .slice(0, 12)
              .map((t) => (
                <option key={t} value={t} />
              ))}
          </datalist>
        </div>
      </div>
    </div>
  );
}
