import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckSquare,
  ChevronRight,
  CalendarClock,
  CornerDownRight,
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  ListPlus,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Square,
  Trash2,
} from "lucide-react";
import { Checkbox } from "../ui/Checkbox";
import { Menu } from "../ui/Menu";
import { IconButton } from "../ui/Button";
import { DueChip, PriorityChip, TagChips } from "../ui/MetaChips";
import { MetaFields } from "../ui/MetaFields";
import { Markdown } from "../notes/Markdown";
import { NotesEditor } from "../notes/NotesEditor";

// How far each level of sub-items is pushed in, and where the pushing stops so a very
// deep branch can't walk off the screen.
const INDENT_PX = 24;
const MAX_INDENT_LEVELS = 8;

export function ItemRow({
  row,
  nested,
  canEdit,
  dragEnabled,
  listType = "checklist",
  suggestions = [],
  onTagPick,
  onPatch,
  onToggle,
  onDelete,
  onAddChild,
  onIndent,
  onOutdent,
  onToggleCollapse,
}) {
  const { item } = row;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: !dragEnabled,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [showNotes, setShowNotes] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [childText, setChildText] = useState("");
  const inputRef = useRef(null);
  const childRef = useRef(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);
  useEffect(() => {
    if (addingChild) childRef.current?.focus();
  }, [addingChild]);

  const startEdit = () => {
    if (!canEdit) return;
    setDraft(item.text);
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (!next) return setDraft(item.text); // empty edits are ignored; use Delete to remove
    if (next !== item.text) onPatch({ text: next });
  };
  const cancel = () => {
    setEditing(false);
    setDraft(item.text);
  };

  const done = item.has_checkbox && row.completed;
  const hasNotes = !!item.notes;
  const indent = Math.min(row.depth, MAX_INDENT_LEVELS) * INDENT_PX;

  const submitChild = () => {
    if (!childText.trim()) return;
    onAddChild({ text: childText, has_checkbox: listType !== "notes" });
    setChildText("");
    childRef.current?.focus();
  };

  const menuItems = [
    { label: "Edit text", icon: Pencil, onClick: startEdit },
    {
      label: hasNotes ? "Edit notes" : "Add notes",
      icon: NotebookPen,
      onClick: () => setShowNotes(true),
    },
    {
      label: "Due date, priority & tags…",
      icon: CalendarClock,
      onClick: () => setShowMeta(true),
    },
    {
      label: item.has_checkbox ? "Make plain text" : "Add checkbox",
      icon: item.has_checkbox ? Square : CheckSquare,
      onClick: () => onPatch({ has_checkbox: !item.has_checkbox }),
    },
    {
      label: "Add sub-item",
      icon: ListPlus,
      onClick: () => setAddingChild(true),
    },
    row.canIndent && {
      label: "Indent (make sub-item of the one above)",
      icon: IndentIncrease,
      onClick: onIndent,
    },
    row.canOutdent && {
      label: "Outdent (move up a level)",
      icon: IndentDecrease,
      onClick: onOutdent,
    },
    { divider: true },
    {
      label: row.hasChildren ? "Delete item and sub-items" : "Delete item",
      icon: Trash2,
      danger: true,
      onClick: onDelete,
    },
  ].filter(Boolean);

  return (
    <motion.li
      ref={setNodeRef}
      layout={dragEnabled ? false : "position"}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        overflow: "clip",
        overflowClipMargin: 6,
        zIndex: isDragging ? 20 : undefined,
        position: "relative",
      }}
      className="list-none"
    >
      <div
        data-anim="item"
        style={{ marginLeft: indent }}
        className={`group flex items-start gap-2 rounded-xl border px-2 py-2 transition-colors ${
          isDragging
            ? "border-accent bg-surface shadow-pop"
            : editing
              ? "border-accent/60 bg-surface"
              : "border-transparent hover:border-line hover:bg-surface/60"
        }`}
      >
        {canEdit && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...(dragEnabled ? listeners : {})}
            disabled={!dragEnabled}
            aria-label={`Reorder “${item.text}”`}
            title={
              dragEnabled
                ? "Drag to reorder (or focus and press Space, then arrow keys)"
                : "Switch sort to Custom order to reorder"
            }
            className={`mt-0.5 grid size-6 shrink-0 touch-none place-items-center rounded-md text-faint transition ${
              dragEnabled
                ? "cursor-grab hover:text-fg active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                : "cursor-default opacity-0"
            }`}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}

        {nested && (
          <div className="mt-px grid h-6 w-5 shrink-0 place-items-center">
            {row.canCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-expanded={!row.collapsed}
                aria-label={`${row.collapsed ? "Expand" : "Collapse"} “${item.text}”`}
                className="grid size-5 cursor-pointer place-items-center rounded text-faint transition-colors hover:text-fg"
              >
                <ChevronRight
                  className={`size-4 transition-transform ${row.collapsed ? "" : "rotate-90"}`}
                  aria-hidden
                />
              </button>
            )}
          </div>
        )}

        {listType === "numbered" && (
          <span
            className="mt-px h-6 min-w-5 shrink-0 text-right text-[15px] leading-6 text-faint tabular-nums"
            aria-label={`Number ${row.number}`}
          >
            {row.number}.
          </span>
        )}

        <div className="mt-px grid h-6 shrink-0 place-items-center">
          {item.has_checkbox ? (
            <Checkbox
              checked={row.completed}
              disabled={!canEdit}
              onChange={onToggle}
              label={`${row.completed ? "Mark incomplete" : "Mark complete"}: ${item.text}`}
            />
          ) : (
            <span className="size-1.5 rounded-full bg-faint" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              maxLength={2000}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") {
                  e.stopPropagation();
                  cancel();
                }
                // Tab / Shift+Tab indent and outdent, like in most outliners.
                if (e.key === "Tab") {
                  const go = e.shiftKey
                    ? row.canOutdent && onOutdent
                    : row.canIndent && onIndent;
                  if (go) {
                    e.preventDefault();
                    commit();
                    go();
                  }
                }
              }}
              aria-label="Edit item text"
              className="w-full bg-transparent py-0.5 text-[15px] focus:outline-none"
            />
          ) : (
            <p
              onClick={startEdit}
              className={`py-0.5 text-[15px] leading-6 break-words transition-[opacity,color] duration-200 ${canEdit ? "cursor-text" : ""} ${
                done
                  ? "text-faint line-through decoration-faint/70 opacity-80"
                  : "text-fg"
              } ${item.has_checkbox ? "" : "text-muted"}`}
            >
              {item.text}
              {row.progress && (
                <span
                  className="ml-2 align-middle text-xs font-normal text-faint no-underline tabular-nums"
                  title={`${row.progress.done} of ${row.progress.total} done`}
                >
                  {row.progress.done}/{row.progress.total}
                  <span className="sr-only">
                    {" "}
                    ({row.progress.done} of {row.progress.total} tasks inside
                    are done)
                  </span>
                </span>
              )}
              {done && <span className="sr-only"> (completed)</span>}
            </p>
          )}

          {(item.due_date || item.priority > 0 || item.tags?.length > 0) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <DueChip source={item} done={done} />
              <PriorityChip priority={item.priority} />
              <TagChips tags={item.tags} onPick={onTagPick} />
            </div>
          )}

          {showMeta && canEdit && (
            <div className="mt-2 rounded-lg border border-line bg-surface p-3">
              <MetaFields
                value={item}
                onChange={(patch) => onPatch(patch)}
                suggestions={suggestions}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowMeta(false)}
                  className="h-7 cursor-pointer rounded-lg border border-line px-3 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {(showNotes || hasNotes) && (
            <div className="mt-1">
              {showNotes && canEdit ? (
                <div
                  onBlur={(e) => {
                    // Leaving the box with nothing written closes it again.
                    if (
                      !e.currentTarget.contains(e.relatedTarget) &&
                      !item.notes
                    )
                      setShowNotes(false);
                  }}
                >
                  <NotesEditor
                    value={item.notes}
                    autoFocus
                    onChange={(notes) => onPatch({ notes }, { debounce: true })}
                    onDone={() => setShowNotes(false)}
                  />
                </div>
              ) : (
                <div className="group/notes relative">
                  <div
                    onClick={(e) => {
                      // Clicking the text starts editing, clicking a link in it just opens it.
                      if (canEdit && !e.target.closest("a")) setShowNotes(true);
                    }}
                    className={`text-faint ${canEdit ? "cursor-text hover:text-muted" : ""}`}
                  >
                    <Markdown text={item.notes} />
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setShowNotes(true)}
                      className="mt-1 h-6 cursor-pointer rounded-md px-1.5 text-[11px] text-faint transition-colors hover:bg-line/60 hover:text-fg focus-visible:opacity-100 sm:opacity-0 sm:group-focus-within/notes:opacity-100 sm:group-hover/notes:opacity-100"
                    >
                      Edit notes
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-center sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <Menu
              width="w-52"
              trigger={({ ref, props }) => (
                <IconButton
                  ref={ref}
                  size="sm"
                  label={`Actions for “${item.text}”`}
                  {...props}
                >
                  <MoreHorizontal className="size-4" />
                </IconButton>
              )}
              items={menuItems}
            />
          </div>
        )}
      </div>

      {addingChild && canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitChild();
          }}
          style={{
            marginLeft:
              Math.min(row.depth + 1, MAX_INDENT_LEVELS) * INDENT_PX + 32,
          }}
          className="mt-1 mb-1 flex items-center gap-2 rounded-xl border border-line bg-surface p-1 pl-3 focus-within:border-accent/70"
        >
          <CornerDownRight
            className="size-3.5 shrink-0 text-faint"
            aria-hidden
          />
          <input
            ref={childRef}
            value={childText}
            onChange={(e) => setChildText(e.target.value)}
            maxLength={2000}
            autoComplete="off"
            aria-label={`New sub-item under “${item.text}”`}
            placeholder="Add a sub-item and press Enter"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setChildText("");
                setAddingChild(false);
              }
            }}
            onBlur={() => {
              if (!childText.trim()) setAddingChild(false);
            }}
            className="min-w-0 flex-1 bg-transparent py-1 text-sm placeholder:text-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={!childText.trim()}
            className="h-7 cursor-pointer rounded-lg bg-accent px-2.5 text-xs font-medium text-on-accent transition active:scale-95 disabled:cursor-default disabled:opacity-35"
          >
            Add
          </button>
        </form>
      )}
    </motion.li>
  );
}
