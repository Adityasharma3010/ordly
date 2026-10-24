import { motion } from "motion/react";
import {
  ArrowUpDown,
  Check,
  CheckCheck,
  ListX,
  Tag,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Menu } from "../ui/Menu";
import { Button } from "../ui/Button";

const FILTER_LABELS = {
  all: "All",
  active: "Active",
  completed: "Completed",
  due: "Due soon",
};
const SORT_LABELS = {
  custom: "Custom order",
  created: "Newest first",
  status: "Status",
  due: "Due date",
  priority: "Priority",
};

export function ChecklistToolbar({
  stats,
  filter,
  setFilter,
  sort,
  setSort,
  query,
  setQuery,
  canEdit,
  onClearCompleted,
  onAll,
  dueCount = 0,
  tags = [],
  tag = null,
  setTag,
  notes = false,
}) {
  const counts = {
    all: stats.totalItems,
    active: stats.remaining,
    completed: stats.done,
    due: dueCount,
  };
  // A Notes list has nothing to tick off, so Active / Completed would always be empty.
  const filterKeys = Object.keys(FILTER_LABELS).filter(
    (k) => !notes || k === "all" || k === "due",
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Filter items"
        className="relative flex rounded-lg border border-line bg-surface p-0.5"
      >
        {filterKeys.map((key) => {
          const on = filter === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(key)}
              className={`relative h-7 cursor-pointer rounded-md px-2.5 text-[13px] transition-colors ${on ? "text-fg" : "text-muted hover:text-fg"}`}
            >
              {on && (
                <motion.span
                  layoutId="filter-pill"
                  className="absolute inset-0 rounded-md bg-raised"
                  transition={{ type: "spring", stiffness: 600, damping: 40 }}
                />
              )}
              <span className="relative">
                {FILTER_LABELS[key]}
                <span className="ml-1.5 text-faint tabular-nums">
                  {counts[key]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative min-w-40 flex-1 sm:max-w-64">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search items in this list"
          placeholder="Search this list"
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.stopPropagation();
              setQuery("");
            }
          }}
          className="h-8 w-full rounded-lg border border-line bg-surface pr-7 pl-8 text-[13px] placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none"
        />
        {query && (
          <button
            aria-label="Clear item search"
            onClick={() => setQuery("")}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded p-0.5 text-faint hover:text-fg"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {tags.length > 0 && (
          <Menu
            width="w-48"
            trigger={({ ref, props }) => (
              <Button
                ref={ref}
                size="sm"
                variant="ghost"
                aria-label={tag ? `Tag filter: #${tag}` : "Filter by tag"}
                {...props}
              >
                <Tag className="size-3.5" aria-hidden />
                {tag ? `#${tag}` : "Tags"}
              </Button>
            )}
            items={[
              ...(tag
                ? [
                    {
                      label: "Show all tags",
                      icon: X,
                      onClick: () => setTag(null),
                    },
                    { divider: true },
                  ]
                : []),
              ...tags.map((t) => ({
                label: `#${t}`,
                icon:
                  tag && t.toLowerCase() === tag.toLowerCase()
                    ? Check
                    : undefined,
                onClick: () => setTag(t),
              })),
            ]}
          />
        )}
        <Menu
          width="w-48"
          trigger={({ ref, props }) => (
            <Button ref={ref} size="sm" variant="ghost" {...props}>
              <ArrowUpDown className="size-3.5" aria-hidden />
              {SORT_LABELS[sort]}
            </Button>
          )}
          items={Object.keys(SORT_LABELS).map((key) => ({
            label: SORT_LABELS[key],
            icon: sort === key ? Check : undefined,
            onClick: () => setSort(key),
          }))}
        />
        {canEdit && (
          <Menu
            width="w-56"
            trigger={({ ref, props }) => (
              <Button ref={ref} size="sm" variant="ghost" {...props}>
                Bulk
              </Button>
            )}
            items={[
              {
                label: "Mark all complete",
                icon: CheckCheck,
                onClick: () => onAll(true),
                disabled: stats.remaining === 0,
              },
              {
                label: "Mark all incomplete",
                icon: RotateCcw,
                onClick: () => onAll(false),
                disabled: stats.done === 0,
              },
              { divider: true },
              {
                label: "Clear completed",
                icon: ListX,
                danger: true,
                onClick: onClearCompleted,
                disabled: stats.done === 0,
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
