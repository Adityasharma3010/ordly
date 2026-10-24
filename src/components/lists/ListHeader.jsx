import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BookmarkPlus,
  ChevronRight,
  Copy,
  FolderInput,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { Button, IconButton } from "../ui/Button";
import { Menu } from "../ui/Menu";
import { timeAgo } from "../../utils/format";
import { DueChip, PriorityChip, TagChips } from "../ui/MetaChips";
import { LIST_TYPES, listTypeOf } from "../../utils/meta";

export function ListHeader({
  list,
  canShare,
  sharingEnabled,
  onUpdate,
  onShare,
  onEdit,
  onDuplicate,
  onSaveTemplate,
  onArchive,
  onMove,
  onAddTemplate,
  onDelete,
  crumbs = [],
  onCrumb,
  done = false,
}) {
  const isOwner = list.role === "owner";
  const canEdit = list.role !== "viewer";
  const [focus, setFocus] = useState(null); // 'title' | 'description'
  const [draft, setDraft] = useState({
    title: list.title,
    description: list.description,
  });

  const titleValue = focus === "title" ? draft.title : list.title;
  const descValue =
    focus === "description" ? draft.description : list.description;

  const items = [
    {
      label: "Edit details",
      icon: Pencil,
      onClick: onEdit,
      disabled: !isOwner,
    },
    { label: "Duplicate list", icon: Copy, onClick: onDuplicate },
    {
      label: "Add items from a template…",
      icon: LayoutTemplate,
      onClick: onAddTemplate,
      disabled: !canEdit,
    },
    { label: "Save as template…", icon: BookmarkPlus, onClick: onSaveTemplate },
    {
      label: "Move to…",
      icon: FolderInput,
      onClick: onMove,
      disabled: !isOwner,
    },
    {
      label: list.archived ? "Restore from archive" : "Archive list",
      icon: list.archived ? ArchiveRestore : Archive,
      onClick: onArchive,
      disabled: !isOwner,
    },
    { divider: true },
    {
      label: "Delete list…",
      icon: Trash2,
      danger: true,
      onClick: onDelete,
      disabled: !isOwner,
    },
  ];

  return (
    <header data-anim="block" className="space-y-2">
      {crumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-0.5 text-[13px] text-muted"
        >
          {crumbs.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onCrumb(c.id)}
                className="max-w-48 cursor-pointer truncate rounded-md px-1.5 py-0.5 transition-colors hover:bg-raised hover:text-fg"
              >
                {c.icon && <span className="mr-1">{c.icon}</span>}
                {c.title}
              </button>
              <ChevronRight className="size-3.5 text-faint" aria-hidden />
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={isOwner ? onEdit : undefined}
          disabled={!isOwner}
          aria-label="Change icon and colour"
          className="mt-1 grid size-12 shrink-0 cursor-pointer place-items-center rounded-xl border border-line bg-surface text-2xl transition hover:border-line-strong disabled:cursor-default"
        >
          {list.icon || (
            <span className="size-3 rounded-full bg-accent" aria-hidden />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <input
            aria-label="List title"
            value={titleValue}
            readOnly={!isOwner}
            maxLength={200}
            onFocus={() => {
              setDraft((d) => ({ ...d, title: list.title }));
              setFocus("title");
            }}
            onChange={(e) => {
              setDraft((d) => ({ ...d, title: e.target.value }));
              if (e.target.value.trim())
                onUpdate({ title: e.target.value }, { debounce: true });
            }}
            onBlur={() => setFocus(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="w-full truncate rounded-md bg-transparent font-serif text-[34px] leading-tight tracking-tight hover:bg-raised/60 focus:bg-raised/60 focus:outline-none sm:text-4xl"
          />
          <textarea
            aria-label="List description"
            value={descValue}
            readOnly={!isOwner}
            rows={1}
            maxLength={2000}
            placeholder={isOwner ? "Add a description" : ""}
            onFocus={() => {
              setDraft((d) => ({ ...d, description: list.description }));
              setFocus("description");
            }}
            onChange={(e) => {
              setDraft((d) => ({ ...d, description: e.target.value }));
              onUpdate({ description: e.target.value }, { debounce: true });
            }}
            onBlur={() => setFocus(null)}
            className="field-sizing-content mt-0.5 w-full resize-none rounded-md bg-transparent text-sm text-muted placeholder:text-faint hover:bg-raised/60 focus:bg-raised/60 focus:outline-none"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 pt-1.5">
          {isOwner && (
            <IconButton
              label={
                list.favorite ? "Remove from favorites" : "Add to favorites"
              }
              active={list.favorite}
              onClick={() => onUpdate({ favorite: !list.favorite })}
            >
              <Star
                className={`size-[18px] ${list.favorite ? "fill-accent text-accent" : ""}`}
              />
            </IconButton>
          )}
          {canShare && (
            <Button
              size="sm"
              onClick={onShare}
              className="hidden sm:inline-flex"
            >
              <Share2 className="size-3.5" aria-hidden />
              {sharingEnabled ? "Share" : "Share…"}
            </Button>
          )}
          <Menu
            trigger={({ ref, props }) => (
              <IconButton ref={ref} label="List actions" {...props}>
                <MoreHorizontal className="size-[18px]" />
              </IconButton>
            )}
            items={[
              ...(canShare
                ? [{ label: "Share…", icon: Share2, onClick: onShare }]
                : []),
              ...items,
            ]}
          />
        </div>
      </div>

      {(listTypeOf(list) !== "checklist" ||
        list.due_date ||
        list.priority > 0 ||
        (list.tags?.length ?? 0) > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 pl-15">
          {listTypeOf(list) !== "checklist" && (
            <span className="inline-flex h-5 items-center rounded-full border border-line px-2 text-[11px] text-muted">
              {LIST_TYPES[listTypeOf(list)].label}
            </span>
          )}
          <DueChip source={list} done={done} />
          <PriorityChip priority={list.priority} />
          <TagChips tags={list.tags} />
        </div>
      )}

      <p className="pl-15 text-xs text-faint">
        {list.role === "owner"
          ? "Updated"
          : `Shared with you as ${list.role} · updated`}{" "}
        {timeAgo(list.updated_at)}
        {!canEdit && (
          <span className="ml-2 rounded bg-raised px-1.5 py-0.5 text-muted">
            View only
          </span>
        )}
      </p>
    </header>
  );
}
