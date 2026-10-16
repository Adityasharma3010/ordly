import { sortByPosition } from "./position";
import { buildRows, listProgress } from "./tree";

// Only items that have a checkbox count toward progress. Plain-text items never do.
// With sub-items, the tasks at the bottom of each branch are what count: a task that has
// sub-tasks is a roll-up of them, so it is not counted twice.
export function getStats(items) {
  const { done, total } = listProgress(items);
  return {
    totalItems: items.length,
    total,
    done,
    remaining: total - done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    isComplete: total > 0 && done === total,
  };
}

export const FILTERS = ["all", "active", "completed"];
export const SORTS = ["custom", "created", "status"];

// The items in display order (see buildRows for the version with depth and folding).
export function filterAndSortItems(items, opts = {}) {
  return buildRows(items, { ...opts, collapsed: [] }).map((r) => r.item);
}

// Search across every list's title, description and item text.
export function searchWorkspace(lists, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  for (const list of lists) {
    const titleHit = list.title.toLowerCase().includes(q);
    const descHit = list.description.toLowerCase().includes(q);
    const itemHits = list.items.filter((i) => i.text.toLowerCase().includes(q));
    if (titleHit || descHit || itemHits.length) {
      results.push({
        list,
        titleHit,
        descHit,
        itemHits: sortByPosition(itemHits).slice(0, 3),
        itemHitCount: itemHits.length,
      });
    }
  }
  return results;
}

export const VIEWS = {
  all: "All lists",
  myLists: "My Lists",
  favorites: "Favorites",
  recent: "Recently updated",
  shared: "Shared with me",
  archived: "Archived",
};

export function listsForView(lists, view) {
  const active = lists.filter((l) => !l.archived);
  switch (view) {
    case "myLists":
      return active.filter((l) => l.role === "owner");
    case "favorites":
      return active.filter((l) => l.favorite);
    case "recent":
      return [...active]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 12);
    case "shared":
      return active.filter((l) => l.role !== "owner");
    case "archived":
      return lists.filter((l) => l.archived);
    default:
      return active;
  }
}
