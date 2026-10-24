import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { motion } from "motion/react";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  FolderInput,
  Layers,
  List,
  ListPlus,
  MoreHorizontal,
  Plus,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { Menu } from "../ui/Menu";
import { Logo, LogoMark } from "../ui/Logo";
import { UserMenu } from "./UserMenu";
import { accentHex } from "../../utils/appearance";
import {
  getStats,
  listAttention,
  listsForView,
  listsWithTag,
  VIEWS,
} from "../../utils/listStats";
import {
  buildListRows,
  listAncestorIds,
  resolveDrop,
  TOP_LEVEL_DROP,
} from "../../utils/listTree";
import { formatDue } from "../../utils/due";
import { collectTags, hasTag } from "../../utils/meta";
import { usePersistentState } from "../../hooks/usePersistentState";

// Sub-lists show as a tree where the list of lists is the whole picture. The other views
// (favorites, recent, shared, archived) are filters, so they stay flat.
const TREE_VIEWS = ["all", "myLists"];
const INDENT = 14; // px per level
const MAX_INDENT_LEVELS = 6;

const NAV = [
  { key: "all", icon: Layers },
  { key: "myLists", icon: List },
  { key: "favorites", icon: Star },
  { key: "dueSoon", icon: CalendarClock },
  { key: "recent", icon: Clock },
  { key: "shared", icon: Users },
  { key: "archived", icon: Archive },
];

// Rows are small and stacked, so "which row is the pointer over" is the right question.
// (Touch drags and anything the pointer test misses fall back to rectangle overlap.)
function pointerOrRect(args) {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
}

export function Sidebar({
  lists,
  view,
  onView,
  activeId,
  onSelect,
  onCreate,
  onHome,
  onToggleFavorite,
  onArchive,
  onDelete,
  onMove,
  onMoveTo,
  onCreateSub,
  tag,
  onTag,
  collapsed,
  onToggleCollapse,
  mobile,
}) {
  const now = new Date();
  const visible = listsWithTag(listsForView(lists, view, now), tag);
  const activeLists = lists.filter((l) => !l.archived);
  const tags = collectTags(activeLists);
  const open = activeLists.reduce((n, l) => n + getStats(l.items).remaining, 0);
  const counts = {
    all: activeLists.length,
    myLists: activeLists.filter((l) => l.role === "owner").length,
    favorites: activeLists.filter((l) => l.favorite).length,
    dueSoon: activeLists.filter((l) => listAttention(l, now)).length,
    shared: activeLists.filter((l) => l.role !== "owner").length,
    archived: lists.filter((l) => l.archived).length,
  };
  const slim = collapsed && !mobile;

  // Which parents are unfolded (remembered on this device). Opening a list unfolds the
  // lists above it once, so you can always see where it lives; you can fold them again.
  const [unfolded, setUnfolded] = usePersistentState("ordly.sidebar.open", []);
  const above = listAncestorIds(lists, activeId);
  const aboveKey = `${activeId}|${above.join(",")}`;
  const [seenKey, setSeenKey] = useState(null);
  if (aboveKey !== seenKey) {
    setSeenKey(aboveKey);
    const add = above.filter((id) => !unfolded.includes(id));
    if (add.length) setUnfolded((o) => [...new Set([...o, ...add])]);
  }
  const toggleOpen = (id) =>
    setUnfolded((o) =>
      o.includes(id) ? o.filter((x) => x !== id) : [...o, id],
    );

  const rows = buildListRows(visible, unfolded, {
    flat: slim || !TREE_VIEWS.includes(view),
  });
  const treeShown = rows.some((r) => r.hasChildren);

  // Drag a list onto another list to put it inside, or onto the strip that appears at the top
  // to take it back out. "Move to…" in the row menu does the same without dragging.
  const dndOn = !slim && TREE_VIEWS.includes(view);
  const [dragId, setDragId] = useState(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );
  const dragged = dragId ? lists.find((l) => l.id === dragId) : null;
  const endDrag = ({ active, over }) => {
    setDragId(null);
    if (!over) return;
    const drop = resolveDrop(lists, active.id, over.id);
    if (!drop) return;
    if (drop.parentId) setUnfolded((o) => [...new Set([...o, drop.parentId])]);
    onMoveTo(
      lists.find((l) => l.id === active.id),
      drop.parentId,
    );
  };

  return (
    <nav aria-label="Lists" className="flex h-full flex-col">
      <div
        className={`flex h-14 shrink-0 items-center ${slim ? "justify-center" : "justify-between px-4"}`}
      >
        <button
          type="button"
          onClick={onHome}
          aria-label="Ordly home"
          title="Home"
          className="cursor-pointer rounded-lg transition-opacity hover:opacity-80"
        >
          {slim ? <LogoMark /> : <Logo />}
        </button>
        {!mobile && !slim && (
          <button
            aria-label="Collapse sidebar"
            onClick={onToggleCollapse}
            className="cursor-pointer rounded-lg p-1.5 text-faint transition hover:bg-raised hover:text-fg"
          >
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>

      <div className={slim ? "px-2" : "px-3"}>
        <button
          onClick={onCreate}
          aria-label="Create new list"
          className={`flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-on-accent shadow-sm transition hover:brightness-110 active:scale-[0.97]`}
        >
          <Plus className="size-4" aria-hidden />
          {!slim && "New list"}
        </button>
      </div>

      <ul className={`mt-4 space-y-0.5 ${slim ? "px-2" : "px-3"}`}>
        {NAV.map(({ key, icon: Icon }) => {
          const on = view === key;
          return (
            <li key={key} data-anim="nav">
              <button
                onClick={() => onView(key)}
                aria-current={on ? "page" : undefined}
                title={VIEWS[key]}
                className={`relative flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg text-sm transition-colors ${slim ? "justify-center" : "px-2.5"} ${on ? "text-fg" : "text-muted hover:bg-raised/70 hover:text-fg"}`}
              >
                {on && (
                  <motion.span
                    layoutId={`nav-pill-${mobile ? "m" : "d"}`}
                    className="absolute inset-0 rounded-lg bg-raised"
                    transition={{ type: "spring", stiffness: 600, damping: 42 }}
                  />
                )}
                <Icon className="relative size-4 shrink-0" aria-hidden />
                {!slim && (
                  <span className="relative flex-1 text-left">
                    {VIEWS[key]}
                  </span>
                )}
                {!slim && counts[key] != null && (
                  <span className="relative text-xs text-faint tabular-nums">
                    {counts[key]}
                  </span>
                )}
                {slim && <span className="sr-only">{VIEWS[key]}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {!slim && open > 0 && (
        <p className="mt-3 px-5 text-xs text-faint">
          {open} open {open === 1 ? "task" : "tasks"} across your lists
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={pointerOrRect}
        onDragStart={({ active }) => setDragId(active.id)}
        onDragCancel={() => setDragId(null)}
        onDragEnd={endDrag}
      >
        <div
          className={`scroll-thin mt-4 min-h-0 flex-1 overflow-y-auto border-t border-line pt-3 ${slim ? "px-2" : "px-3"}`}
        >
          {dndOn && dragged && dragged.parent_list_id && <TopLevelZone />}
          {!slim && tags.length > 0 && (
            <div
              role="group"
              aria-label="Filter lists by tag"
              className="mb-3 flex flex-wrap gap-1 px-1"
            >
              {tags.slice(0, 12).map((t) => {
                const on = !!tag && hasTag([t], tag);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onTag(on ? null : t)}
                    className={`h-6 max-w-full cursor-pointer truncate rounded-full border px-2 text-xs transition-colors ${on ? "border-accent bg-accent/15 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg"}`}
                  >
                    #{t}
                  </button>
                );
              })}
            </div>
          )}
          {!slim && (
            <h2 className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wider text-faint uppercase">
              {VIEWS[view]}
              {tag && <span className="normal-case"> · #{tag}</span>}
            </h2>
          )}
          {visible.length === 0 ? (
            !slim && (
              <p className="px-2.5 py-2 text-[13px] text-faint">
                {tag
                  ? `No lists tagged #${tag} here.`
                  : view === "all"
                    ? "No lists yet."
                    : view === "myLists"
                      ? "You haven’t created any lists yet."
                      : `Nothing in ${VIEWS[view].toLowerCase()}.`}
              </p>
            )
          ) : (
            <ul className="space-y-0.5">
              {rows.map(({ list: l, depth, hasChildren, expanded }) => {
                const stats = getStats(l.items);
                const on = l.id === activeId;
                const isOwner = l.role === "owner";
                const indent = Math.min(depth, MAX_INDENT_LEVELS) * INDENT;
                return (
                  <DndRow
                    key={l.id}
                    id={l.id}
                    enabled={dndOn && isOwner && !l.archived}
                    canDrop={(activeId) => !!resolveDrop(lists, activeId, l.id)}
                    data-anim="row"
                    className="group relative"
                  >
                    {!slim && hasChildren && (
                      <button
                        type="button"
                        onClick={() => toggleOpen(l.id)}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Collapse" : "Expand"} “${l.title}”`}
                        style={{ left: 2 + indent }}
                        className="absolute top-1/2 z-10 grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded text-faint transition-colors hover:bg-line/60 hover:text-fg"
                      >
                        <ChevronRight
                          className={`size-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
                          aria-hidden
                        />
                      </button>
                    )}
                    <button
                      onClick={() => onSelect(l.id)}
                      aria-current={on ? "true" : undefined}
                      title={l.title}
                      style={
                        !slim && treeShown
                          ? { paddingLeft: 22 + indent }
                          : undefined
                      }
                      className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg text-sm transition-colors ${slim ? "justify-center" : treeShown ? "pr-2.5" : "px-2.5"} ${on ? "bg-raised text-fg" : "text-muted hover:bg-raised/70 hover:text-fg"}`}
                    >
                      <span
                        className="grid size-5 shrink-0 place-items-center text-[15px]"
                        style={{ color: accentHex(l.color) }}
                      >
                        {l.icon || (
                          <span
                            className="size-2 rounded-full"
                            style={{ background: accentHex(l.color) }}
                            aria-hidden
                          />
                        )}
                      </span>
                      {!slim && (
                        <span className="flex-1 truncate text-left">
                          {l.title}
                        </span>
                      )}
                      {!slim && view === "dueSoon" && (
                        <DueLabel list={l} now={now} />
                      )}
                      {!slim && view !== "dueSoon" && stats.remaining > 0 && (
                        <span
                          className={`text-xs text-faint tabular-nums ${isOwner ? "group-has-[:focus-visible]:invisible group-hover:invisible" : ""}`}
                          aria-label={`${stats.remaining} tasks left`}
                        >
                          {stats.remaining}
                        </span>
                      )}
                      {slim && <span className="sr-only">{l.title}</span>}
                    </button>
                    {/* Favorite / archive / delete without opening the list first. */}
                    {!slim && isOwner && (
                      <div className="absolute top-1/2 right-1 -translate-y-1/2">
                        <Menu
                          width="w-52"
                          items={[
                            {
                              label: l.favorite
                                ? "Remove from favorites"
                                : "Add to favorites",
                              icon: Star,
                              onClick: () => onToggleFavorite(l),
                            },
                            ...(l.archived
                              ? []
                              : [
                                  {
                                    label: "New sub-list…",
                                    icon: ListPlus,
                                    onClick: () => onCreateSub(l),
                                  },
                                ]),
                            {
                              label: "Move to…",
                              icon: FolderInput,
                              onClick: () => onMove(l),
                            },
                            {
                              label: l.archived
                                ? "Restore from archive"
                                : "Archive list",
                              icon: l.archived ? ArchiveRestore : Archive,
                              onClick: () => onArchive(l),
                            },
                            { divider: true },
                            {
                              label: "Delete list…",
                              icon: Trash2,
                              danger: true,
                              onClick: () => onDelete(l),
                            },
                          ]}
                          trigger={({ ref, props }) => (
                            <button
                              ref={ref}
                              {...props}
                              aria-label={`Actions for “${l.title}”`}
                              className={`grid size-7 cursor-pointer place-items-center rounded-md text-faint transition-colors hover:bg-line/60 hover:text-fg aria-expanded:opacity-100 ${mobile ? "" : "opacity-0 group-has-[:focus-visible]:opacity-100 group-hover:opacity-100"}`}
                            >
                              <MoreHorizontal className="size-4" aria-hidden />
                            </button>
                          )}
                        />
                      </div>
                    )}
                  </DndRow>
                );
              })}
            </ul>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragged && (
            <div className="rounded-lg border border-line-strong bg-raised px-3 py-1.5 text-sm text-fg shadow-pop">
              {dragged.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className={`shrink-0 border-t border-line ${slim ? "p-2" : "p-3"}`}>
        {slim && (
          <button
            aria-label="Expand sidebar"
            onClick={onToggleCollapse}
            className="mb-1 flex h-8 w-full cursor-pointer items-center justify-center rounded-lg text-faint transition hover:bg-raised hover:text-fg"
          >
            <ChevronsRight className="size-4" />
          </button>
        )}
        <UserMenu variant="row" collapsed={slim} side="top" align="left" />
      </div>
    </nav>
  );
}

// A sidebar row that can be picked up (your own lists) and dropped onto (your own lists).
function DndRow({ id, enabled, canDrop, children, className, ...rest }) {
  const { active } = useDndContext();
  const drag = useDraggable({ id, disabled: !enabled });
  const drop = useDroppable({ id, disabled: !enabled });
  const ref = (node) => {
    drag.setNodeRef(node);
    drop.setNodeRef(node);
  };
  const target =
    drop.isOver && active && active.id !== id && canDrop(active.id);
  return (
    <li
      ref={ref}
      {...rest}
      {...(enabled ? drag.listeners : {})}
      className={`${className} rounded-lg ${drag.isDragging ? "opacity-40" : ""} ${target ? "bg-accent/15 ring-1 ring-accent" : ""}`}
    >
      {children}
    </li>
  );
}

// Shown only while a sub-list is being dragged: drop here to take it out of its parent.
function TopLevelZone() {
  const { setNodeRef, isOver } = useDroppable({ id: TOP_LEVEL_DROP });
  return (
    <div
      ref={setNodeRef}
      className={`mb-3 grid h-9 place-items-center rounded-lg border border-dashed text-xs transition-colors ${isOver ? "border-accent bg-accent/15 text-fg" : "border-line-strong text-muted"}`}
    >
      Drop here to move to the top level
    </div>
  );
}

// In the Due soon view: how urgent the list is, in place of the task count.
function DueLabel({ list, now }) {
  const a = listAttention(list, now);
  if (!a) return null;
  const late = a.state === "overdue";
  return (
    <span
      className={`text-xs tabular-nums ${late ? "font-medium text-danger" : "text-muted"}`}
    >
      {late ? "Overdue" : formatDue(a, now)}
    </span>
  );
}
