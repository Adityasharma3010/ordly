import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { Markdown } from "./Markdown";
import { NotesToolbar } from "./NotesToolbar";
import { usePersistentState } from "../../hooks/usePersistentState";
import {
  continueList,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
} from "../../utils/mdEdit";

// The rich editor is a big library, so it is only downloaded when someone picks it.
const RichEditor = lazy(() => import("./RichEditor"));

export const NOTES_LIMIT = 10000;

const MARKS = { bold: "**", italic: "*", strike: "~~", code: "`" };

// Editing a note. The note is always stored as Markdown text; this box offers two ways to
// write it: the Markdown text itself (with a toolbar that inserts the symbols for you), or a
// rich editor where you just see bold, lists and links. The choice is remembered.
export function NotesEditor({ value, onChange, onDone, autoFocus }) {
  const [mode, setMode] = usePersistentState("ordly.notes.mode", "markdown");
  const rich = mode === "rich";

  const switcher = (
    <div
      role="group"
      aria-label="Editor"
      className="flex rounded-md border border-line p-0.5 text-[11px]"
    >
      {[
        ["markdown", "Markdown"],
        ["rich", "Rich text"],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={mode === key}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMode(key)}
          className={`h-5 cursor-pointer rounded px-1.5 transition-colors ${mode === key ? "bg-accent/20 text-fg" : "text-muted hover:text-fg"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div
      role="group"
      aria-label="Notes editor"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDone();
        }
      }}
      className="overflow-hidden rounded-lg border border-line bg-raised focus-within:border-accent"
    >
      {rich ? (
        <Suspense
          fallback={
            <>
              <div className="flex items-center justify-end border-b border-line px-1.5 py-1">
                {switcher}
              </div>
              <p className="px-3 py-3 text-[13px] text-faint" role="status">
                Loading the rich editor…
              </p>
            </>
          }
        >
          <RichEditor
            value={value}
            onChange={onChange}
            autoFocus={autoFocus}
            extras={switcher}
          />
        </Suspense>
      ) : (
        <MarkdownPane
          value={value}
          onChange={onChange}
          autoFocus={autoFocus}
          extras={switcher}
        />
      )}
      <div className="flex items-center justify-between border-t border-line px-2 py-1">
        <span
          className={`text-[11px] tabular-nums ${value.length > NOTES_LIMIT - 500 ? "text-danger" : "text-faint"}`}
        >
          {value.length > NOTES_LIMIT - 1000
            ? `${value.length.toLocaleString()} / ${NOTES_LIMIT.toLocaleString()}`
            : "Saved as you type"}
        </span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onDone}
          className="h-6 cursor-pointer rounded-md px-2 text-xs font-medium text-accent-ink transition-colors hover:bg-line/60"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function MarkdownPane({ value, onChange, autoFocus, extras }) {
  const ref = useRef(null);
  const pending = useRef(null); // where the selection goes after the next edit
  const [preview, setPreview] = useState(false);

  useLayoutEffect(() => {
    if (autoFocus) ref.current?.focus();
    // Only when the box first opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After a toolbar edit the text changes, then the selection is put back where we wanted.
  useLayoutEffect(() => {
    const ta = ref.current;
    if (pending.current && ta) {
      ta.setSelectionRange(pending.current.start, pending.current.end);
      pending.current = null;
    }
  }, [value]);

  const edit = (fn) => {
    const ta = ref.current;
    if (!ta) return;
    const r = fn(ta.value, ta.selectionStart, ta.selectionEnd);
    if (!r || r.value.length > NOTES_LIMIT) return;
    pending.current = { start: r.start, end: r.end };
    if (r.value === ta.value) ta.setSelectionRange(r.start, r.end);
    else onChange(r.value);
  };

  const act = (id) => {
    if (MARKS[id]) edit((v, a, b) => wrapSelection(v, a, b, MARKS[id]));
    else if (id === "link") edit(insertLink);
    else edit((v, a, b) => toggleLinePrefix(v, a, b, id));
  };

  const onKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey) {
      const id = { b: "bold", i: "italic", k: "link" }[e.key.toLowerCase()];
      if (id) {
        e.preventDefault();
        act(id);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !mod) {
      const ta = e.currentTarget;
      if (ta.selectionStart === ta.selectionEnd) {
        const r = continueList(ta.value, ta.selectionStart);
        if (r && r.value.length <= NOTES_LIMIT) {
          e.preventDefault();
          pending.current = { start: r.start, end: r.end };
          onChange(r.value);
        }
      }
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-line px-1.5 py-1">
        <NotesToolbar onAction={act} disabled={preview} />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-pressed={preview}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPreview((v) => !v)}
            className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[11px] text-muted transition-colors hover:bg-line/60 hover:text-fg"
          >
            {preview ? (
              <Pencil className="size-3" aria-hidden />
            ) : (
              <Eye className="size-3" aria-hidden />
            )}
            {preview ? "Edit" : "Preview"}
          </button>
          {extras}
        </div>
      </div>
      {preview ? (
        <div className="min-h-18 px-3 py-2 text-muted">
          {value.trim() ? (
            <Markdown text={value} />
          ) : (
            <p className="text-[13px] text-faint">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          rows={4}
          maxLength={NOTES_LIMIT}
          aria-label="Item notes"
          placeholder="Add details… (Markdown works: **bold**, - lists, [links](https://…))"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="block w-full resize-y bg-transparent px-3 py-2 text-[13px] leading-relaxed text-fg placeholder:text-faint focus:outline-none"
        />
      )}
    </>
  );
}
