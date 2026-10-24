import { useRef, useState } from "react";
import { CheckSquare, Plus, Square } from "lucide-react";
import { usePersistentState } from "../../hooks/usePersistentState";

// Type, press Enter, keep typing. The input never loses focus after adding.
export function ItemComposer({ onAdd, disabled, plainByDefault = false }) {
  const [text, setText] = useState("");
  const [savedBox, setSavedBox] = usePersistentState(
    "ordly.composer.checkbox",
    true,
  );
  // A Notes list starts out plain text; flipping the switch there only lasts while it is open
  // and doesn't change the choice you made for other lists.
  const [override, setOverride] = useState(null);
  const withBox = override ?? (plainByDefault ? false : savedBox);
  const setWithBox = (v) => (plainByDefault ? setOverride(v) : setSavedBox(v));
  const inputRef = useRef(null);

  const submit = () => {
    if (!text.trim()) return;
    onAdd({ text, has_checkbox: withBox });
    setText("");
    inputRef.current?.focus();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1.5 pl-3 transition-colors focus-within:border-accent/70"
    >
      <Plus className="size-4 shrink-0 text-faint" aria-hidden />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        maxLength={2000}
        aria-label="New item"
        data-composer
        placeholder={
          withBox ? "Add a task and press Enter" : "Add a note and press Enter"
        }
        className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] placeholder:text-faint focus:outline-none"
        autoComplete="off"
      />
      <button
        type="button"
        role="switch"
        aria-checked={withBox}
        onClick={() => setWithBox(!withBox)}
        title={
          withBox ? "New items have a checkbox" : "New items are plain text"
        }
        className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-muted transition-colors hover:bg-raised hover:text-fg"
      >
        {withBox ? (
          <CheckSquare className="size-4 text-accent" aria-hidden />
        ) : (
          <Square className="size-4" aria-hidden />
        )}
        <span className="hidden sm:inline">
          {withBox ? "Checkbox" : "Plain text"}
        </span>
        <span className="sr-only sm:hidden">
          {withBox ? "Checkbox on" : "Checkbox off"}
        </span>
      </button>
      <button
        type="submit"
        disabled={!text.trim() || disabled}
        className="h-8 cursor-pointer rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent transition active:scale-95 disabled:cursor-default disabled:opacity-35"
      >
        Add
      </button>
    </form>
  );
}
