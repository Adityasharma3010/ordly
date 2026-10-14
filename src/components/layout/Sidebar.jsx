import { motion } from "motion/react";
import {
  Archive,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Layers,
  List,
  Plus,
  Star,
  Users,
} from "lucide-react";
import { Logo, LogoMark } from "../ui/Logo";
import { UserMenu } from "./UserMenu";
import { accentHex } from "../../utils/appearance";
import { getStats, listsForView, VIEWS } from "../../utils/listStats";

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

  return (
    <nav aria-label="Lists" className="flex h-full flex-col">
      <div
        className={`flex h-14 shrink-0 items-center ${slim ? "justify-center" : "justify-between px-4"}`}
      >
        {slim ? <LogoMark /> : <Logo />}
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
                : `Nothing in ${VIEWS[view].toLowerCase()}.`}
            </p>
          )
        ) : (
          <ul className="space-y-0.5">
            {visible.map((l) => {
              const stats = getStats(l.items);
              const on = l.id === activeId;
              return (
                <li key={l.id} data-anim="row">
                  <button
                    onClick={() => onSelect(l.id)}
                    aria-current={on ? "true" : undefined}
                    title={l.title}
                    className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg text-sm transition-colors ${slim ? "justify-center" : "px-2.5"} ${on ? "bg-raised text-fg" : "text-muted hover:bg-raised/70 hover:text-fg"}`}
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
                        className="text-xs text-faint tabular-nums"
                        aria-label={`${stats.remaining} tasks left`}
                      >
                        {stats.remaining}
                      </span>
                    )}
                    {slim && <span className="sr-only">{l.title}</span>}
                  </button>
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
