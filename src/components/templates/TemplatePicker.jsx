import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { IconButton } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { STARTER_TEMPLATES } from "../../data/starterTemplates";
import { accentHex } from "../../utils/appearance";
import { plural } from "../../utils/format";
import { countTemplateItems } from "../../utils/templates";

function TemplateCard({ template, onPick, onDelete }) {
  const count = countTemplateItems(template.items);
  const preview = template.items
    .slice(0, 3)
    .map((i) => i.text)
    .join(" · ");
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onPick(template)}
        className="flex h-full w-full cursor-pointer flex-col gap-1.5 rounded-xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-line-strong hover:bg-raised"
      >
        <span className="flex items-center gap-2.5 pr-7">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-raised text-[17px]"
            style={{ color: accentHex(template.color) }}
          >
            {template.icon || (
              <span
                className="size-2.5 rounded-full"
                style={{ background: accentHex(template.color) }}
                aria-hidden
              />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {template.title}
          </span>
        </span>
        <span className="text-xs text-faint">{plural(count, "item")}</span>
        {preview && (
          <span className="line-clamp-2 text-[13px] text-muted">{preview}</span>
        )}
      </button>
      {onDelete && (
        <IconButton
          label={`Delete template “${template.title}”`}
          size="sm"
          onClick={() => onDelete(template)}
          className="absolute top-2 right-2 max-sm:opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
        >
          <Trash2 className="size-4" />
        </IconButton>
      )}
    </li>
  );
}

function Section({ title, templates, onPick, onDelete }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-[11px] font-medium tracking-wider text-faint uppercase">
        {title}
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {templates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            onPick={onPick}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  );
}

// Everything you can start a list from: your own saved templates, then the starters.
export function TemplatePicker({
  open,
  onClose,
  userTemplates,
  onPick,
  onDelete,
}) {
  const [deleting, setDeleting] = useState(null);
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title="Start from a template"
        description="Pick one to get a list with items already in it. You can change anything afterwards."
      >
        <div className="mt-4 max-h-[60vh] space-y-6 overflow-y-auto pr-1">
          {userTemplates.length > 0 && (
            <Section
              title="Your templates"
              templates={userTemplates}
              onPick={onPick}
              onDelete={setDeleting}
            />
          )}
          <Section
            title="Starter templates"
            templates={STARTER_TEMPLATES}
            onPick={onPick}
          />
        </div>
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        confirmLabel="Delete template"
        title={`Delete the template “${deleting?.title ?? ""}”?`}
        description="Lists you already made from it are not affected. This can’t be undone."
        onConfirm={() => onDelete?.(deleting)}
      />
    </>
  );
}
