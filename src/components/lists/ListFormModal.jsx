import { useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ListChecks,
  ListOrdered,
  Pipette,
  StickyNote,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Collapse } from "../ui/Collapse";
import { Textarea } from "../ui/Field";
import { ColorField } from "../ui/ColorField";
import { MetaFields } from "../ui/MetaFields";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { STARTER_TEMPLATES } from "../../data/starterTemplates";
import {
  ACCENT_KEYS,
  ACCENTS,
  accentHex,
  EMOJI_CHOICES,
} from "../../utils/appearance";
import { isHex, readableOn } from "../../utils/color";
import { formatDue } from "../../utils/due";
import { plural } from "../../utils/format";
import { LIST_TYPES, listTypeOf, priorityLabel } from "../../utils/meta";
import { countTemplateItems } from "../../utils/templates";

const TYPE_ICONS = {
  checklist: ListChecks,
  numbered: ListOrdered,
  notes: StickyNote,
};

// Used for both "New list" and "Edit details". The modal only mounts its body while
// open, so the form state starts fresh from `list` every time it opens.
export function ListFormModal({
  open,
  onClose,
  onSubmit,
  list,
  parentTitle,
  suggestions = [],
}) {
  const titleRef = useRef(null);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        list
          ? "Edit list details"
          : parentTitle
            ? `New sub-list in “${parentTitle}”`
            : "New list"
      }
      initialFocus={titleRef}
    >
      <ListForm
        list={list}
        onClose={onClose}
        onSubmit={onSubmit}
        titleRef={titleRef}
        suggestions={suggestions}
      />
    </Modal>
  );
}

function ListForm({ list, onClose, onSubmit, titleRef, suggestions }) {
  const editing = !!list;
  const ws = useWorkspace();
  const [title, setTitle] = useState(list?.title ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [icon, setIcon] = useState(list?.icon ?? "");
  const [color, setColor] = useState(list?.color ?? "amber");
  const [listType, setListType] = useState(listTypeOf(list));
  const [meta, setMeta] = useState({
    due_date: list?.due_date ?? null,
    due_time: list?.due_time ?? null,
    priority: list?.priority ?? 0,
    tags: list?.tags ?? [],
  });
  const [template, setTemplate] = useState(null);
  const [lookOpen, setLookOpen] = useState(false);
  const isCustom = isHex(color);
  const [customOpen, setCustomOpen] = useState(false);
  const hasExtras =
    !!list &&
    (!!list.description ||
      !!list.due_date ||
      list.priority > 0 ||
      (list.tags?.length ?? 0) > 0);
  const [moreOpen, setMoreOpen] = useState(hasExtras);
  const [error, setError] = useState("");
  // What you typed yourself is never overwritten when you pick a template.
  const touched = useRef({ title: false, look: false, description: false });

  const templates = [...(ws.templates || []), ...STARTER_TEMPLATES];

  const pickTemplate = (t) => {
    setTemplate(t);
    const mine = touched.current;
    if (!mine.title) setTitle(t?.title ?? "");
    if (!mine.look) {
      setIcon(t?.icon ?? "");
      setColor(t?.color ?? "amber");
    }
    if (!mine.description) setDescription(t?.description ?? "");
    setError("");
  };

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give your list a name.");
      titleRef.current?.focus();
      return;
    }
    onSubmit(
      {
        title: title.trim(),
        description: description.trim(),
        icon,
        color,
        list_type: listType,
        ...meta,
      },
      template,
    );
    onClose();
  };

  // What is set inside "More options", shown while it is folded away.
  const summary = [
    description.trim() && "Description",
    meta.due_date && `Due ${formatDue(meta)}`,
    meta.priority > 0 && `${priorityLabel(meta.priority)} priority`,
    meta.tags.length > 0 && plural(meta.tags.length, "tag"),
  ].filter(Boolean);

  return (
    <form onSubmit={submit} className="mt-1 space-y-5">
      <div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Change icon and colour"
            aria-expanded={lookOpen}
            aria-controls="list-look"
            onClick={() => setLookOpen((v) => !v)}
            className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-xl border bg-raised text-2xl transition-colors hover:border-line-strong"
            style={{
              borderColor: lookOpen ? accentHex(color) : undefined,
              color: accentHex(color),
            }}
          >
            {icon || (
              <span
                className="size-3.5 rounded-full"
                style={{ background: accentHex(color) }}
                aria-hidden
              />
            )}
          </button>
          <input
            ref={titleRef}
            aria-label="Name"
            aria-invalid={!!error}
            value={title}
            maxLength={200}
            placeholder="Name your list"
            onChange={(e) => {
              touched.current.title = true;
              setTitle(e.target.value);
              setError("");
            }}
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-raised px-4 font-serif text-xl text-fg placeholder:text-faint focus:border-accent focus:outline-none aria-[invalid=true]:border-danger"
          />
        </div>
        {error && (
          <p role="alert" className="mt-1.5 text-[13px] text-danger">
            {error}
          </p>
        )}

        <Collapse open={lookOpen} id="list-look">
          <div className="space-y-3 pt-3">
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={`Use ${e} icon`}
                  aria-pressed={icon === e}
                  onClick={() => {
                    touched.current.look = true;
                    setIcon(icon === e ? "" : e);
                  }}
                  className={`grid size-9 cursor-pointer place-items-center rounded-lg border text-lg transition-colors ${icon === e ? "border-accent bg-accent/15" : "border-line bg-raised hover:border-line-strong"}`}
                >
                  {e}
                </button>
              ))}
              <input
                aria-label="Or type your own emoji"
                value={icon}
                onChange={(e) => {
                  touched.current.look = true;
                  setIcon([...e.target.value].slice(0, 2).join(""));
                }}
                placeholder="…or type one"
                className="h-9 w-32 rounded-lg border border-line bg-raised px-3 text-sm placeholder:text-faint focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-label={`${k} accent`}
                  aria-pressed={color === k}
                  onClick={() => {
                    touched.current.look = true;
                    setColor(k);
                    setCustomOpen(false);
                  }}
                  className="grid size-8 cursor-pointer place-items-center rounded-full"
                  style={{
                    background: accentHex(k),
                    boxShadow:
                      color === k
                        ? `0 0 0 2px var(--c-surface), 0 0 0 4px ${accentHex(k)}`
                        : "none",
                  }}
                >
                  {color === k && (
                    <Check className="size-4 text-black/70" aria-hidden />
                  )}
                </button>
              ))}
              <button
                type="button"
                aria-label="Custom colour"
                aria-pressed={isCustom}
                aria-expanded={customOpen}
                aria-controls="list-custom-colour"
                title="Pick any colour"
                onClick={() => {
                  touched.current.look = true;
                  if (!isCustom) setColor(accentHex(color));
                  setCustomOpen((v) => !v);
                }}
                className="grid size-8 cursor-pointer place-items-center rounded-full"
                style={{
                  background: isCustom
                    ? color
                    : "conic-gradient(#f66, #fd5, #6e6, #5df, #86f, #f6c, #f66)",
                  boxShadow: isCustom
                    ? `0 0 0 2px var(--c-surface), 0 0 0 4px ${color}`
                    : "none",
                }}
              >
                {isCustom ? (
                  <Check
                    className="size-4"
                    style={{ color: readableOn(color) }}
                    aria-hidden
                  />
                ) : (
                  <Pipette className="size-4 text-black/60" aria-hidden />
                )}
              </button>
            </div>
            <Collapse open={customOpen} id="list-custom-colour">
              <div className="pt-1">
                {customOpen && (
                  <ColorField
                    value={isCustom ? color : accentHex(color)}
                    onChange={(hex) => {
                      touched.current.look = true;
                      setColor(hex);
                    }}
                    presets={Object.values(ACCENTS)}
                  />
                )}
              </div>
            </Collapse>
          </div>
        </Collapse>
      </div>

      {!editing && (
        <fieldset className="min-w-0">
          <legend className="mb-2 text-[13px] font-medium text-muted">
            Start from
          </legend>
          <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1.5">
            {[null, ...templates].map((t) => {
              const on = (template?.id ?? null) === (t?.id ?? null);
              return (
                <button
                  key={t?.id ?? "blank"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickTemplate(t)}
                  className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[13px] whitespace-nowrap transition-colors ${on ? "border-accent bg-accent/15 text-fg" : "border-line bg-raised text-muted hover:border-line-strong hover:text-fg"}`}
                >
                  {t ? (
                    <>
                      <span aria-hidden>{t.icon}</span>
                      {t.title}
                    </>
                  ) : (
                    "Blank list"
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-muted" aria-live="polite">
            {template
              ? `Comes with ${plural(countTemplateItems(template.items), "item")}. You can change anything afterwards.`
              : "Start empty, or pick a ready-made list."}
          </p>
        </fieldset>
      )}

      <fieldset className="min-w-0">
        <legend className="mb-2 text-[13px] font-medium text-muted">
          Type
        </legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-raised p-1">
          {Object.entries(LIST_TYPES).map(([key, t]) => {
            const Icon = TYPE_ICONS[key];
            const on = listType === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => setListType(key)}
                className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[13px] transition-colors ${on ? "bg-surface font-medium text-fg shadow-sm ring-1 ring-accent/60" : "text-muted hover:text-fg"}`}
              >
                <Icon className="size-4" aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted" aria-live="polite">
          {LIST_TYPES[listType].hint}
        </p>
      </fieldset>

      <div>
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="list-more"
          onClick={() => setMoreOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg py-1 text-left text-[13px] font-medium text-muted transition-colors hover:text-fg"
        >
          More options
          {!moreOpen && summary.length > 0 && (
            <span className="min-w-0 flex-1 truncate text-xs font-normal text-accent-ink">
              {summary.join(" · ")}
            </span>
          )}
          <ChevronDown
            className={`ml-auto size-4 shrink-0 transition-transform ${moreOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        <Collapse open={moreOpen} id="list-more">
          <div className="space-y-4 pt-3">
            <Textarea
              label="Description"
              rows={2}
              maxLength={2000}
              value={description}
              placeholder="What is this list for?"
              onChange={(e) => {
                touched.current.description = true;
                setDescription(e.target.value);
              }}
            />
            <MetaFields
              value={meta}
              onChange={(patch) => setMeta((m) => ({ ...m, ...patch }))}
              suggestions={suggestions}
            />
          </div>
        </Collapse>
      </div>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          {editing ? "Save changes" : "Create list"}
        </Button>
      </div>
    </form>
  );
}
