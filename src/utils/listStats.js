import { sortByPosition } from "./position";
import { buildRows, computeRollup, listProgress } from "./tree";
import { dueSortKey, dueState, needsAttention } from "./due";
import { hasTag } from "./meta";

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

export const FILTERS = ["all", "active", "completed", "due"];
export const SORTS = ["custom", "created", "status", "due", "priority"];

// The most pressing due date inside a list that is overdue, due today or due in the next 7
// days: the list's own, or an unfinished item's. null when nothing needs attention.
export function listAttention(list, now = new Date()) {
  const roll = computeRollup(list.items);
  let best = null;
  const consider = (src, done) => {
    const state = dueState(src, { now, done });
    if (!needsAttention(state)) return;
    const key = dueSortKey(src);
    if (!best || key < best.key)
      best = { key, state, due_date: src.due_date, due_time: src.due_time };
  };
  consider(list, getStats(list.items).isComplete);
  for (const it of list.items) consider(it, roll.get(it.id).completed);
  return best;
}

// Lists that have `tag` on the list itself or on any of its items.
export const listsWithTag = (lists, tag) =>
  tag
    ? lists.filter(
        (l) => hasTag(l.tags, tag) || l.items.some((i) => hasTag(i.tags, tag)),
      )
    : lists;

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
    const tagHit = (list.tags || []).some((t) => t.toLowerCase().includes(q));
    const itemHits = list.items.filter(
      (i) =>
        i.text.toLowerCase().includes(q) ||
        (i.tags || []).some((t) => t.toLowerCase().includes(q)),
    );
    if (titleHit || descHit || tagHit || itemHits.length) {
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
  dueSoon: "Due soon",
  recent: "Recently updated",
  shared: "Shared with me",
  archived: "Archived",
};

export function listsForView(lists, view, now = new Date()) {
  const active = lists.filter((l) => !l.archived);
  switch (view) {
    case "dueSoon":
      return active
        .map((l) => ({ l, a: listAttention(l, now) }))
        .filter((x) => x.a)
        .sort((x, y) => x.a.key.localeCompare(y.a.key))
        .map((x) => x.l);
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
