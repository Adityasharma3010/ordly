import {
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";

export const TOOLS = [
  { id: "bold", label: "Bold", Icon: Bold, keys: "Ctrl+B" },
  { id: "italic", label: "Italic", Icon: Italic, keys: "Ctrl+I" },
  { id: "strike", label: "Strikethrough", Icon: Strikethrough },
  { id: "code", label: "Code", Icon: Code },
  { id: "link", label: "Link", Icon: Link2, keys: "Ctrl+K" },
  { id: "ul", label: "Bulleted list", Icon: List },
  { id: "ol", label: "Numbered list", Icon: ListOrdered },
  { id: "quote", label: "Quote", Icon: Quote },
];

// The row of formatting buttons, shared by the Markdown box and the rich editor. Clicking a
// button must not steal focus from the text, hence the mouse-down guard.
export function NotesToolbar({ onAction, active, disabled }) {
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5"
    >
      {TOOLS.map(({ id, label, Icon, keys }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          aria-label={label}
          aria-pressed={active ? !!active[id] : undefined}
          title={keys ? `${label} (${keys})` : label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction(id)}
          className={`grid size-7 cursor-pointer place-items-center rounded-md transition-colors disabled:cursor-default disabled:opacity-40 ${active?.[id] ? "bg-accent/20 text-fg" : "text-muted hover:bg-line/60 hover:text-fg disabled:hover:bg-transparent"}`}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
