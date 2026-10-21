import { useState } from "react";
import { motion } from "motion/react";
import {
  Archive,
  ArchiveRestore,
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
import { getStats, listsForView, VIEWS } from "../../utils/listStats";
import { buildListRows, listAncestorIds } from "../../utils/listTree";
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
  { key: "recent", icon: Clock },
  { key: "shared", icon: Users },
  { key: "archived", icon: Archive },
];

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
  onCreateSub,
  collapsed,
  onToggleCollapse,
  mobile,
}) {
  const visible = listsForView(lists, view);
  const activeLists = lists.filter((l) => !l.archived);
  const open = activeLists.reduce((n, l) => n + getStats(l.items).remaining, 0);
  const counts = {
    all: activeLists.length,
    myLists: activeLists.filter((l) => l.role === "owner").length,
    favorites: activeLists.filter((l) => l.favorite).length,
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

      <div
        className={`scroll-thin mt-4 min-h-0 flex-1 overflow-y-auto border-t border-line pt-3 ${slim ? "px-2" : "px-3"}`}
      >
        {!slim && (
          <h2 className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wider text-faint uppercase">
            {VIEWS[view]}
          </h2>
        )}
        {visible.length === 0 ? (
          !slim && (
            <p className="px-2.5 py-2 text-[13px] text-faint">
              {view === "all"
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
                <li key={l.id} data-anim="row" className="group relative">
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
                    {!slim && stats.remaining > 0 && (
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
                </li>
              );
            })}
          </ul>
        )}
      </div>

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
