import { sortByPosition } from "./position";
import { dueSortKey, dueState, needsAttention } from "./due";
import { hasTag } from "./meta";

// Items can sit under other items of the same list, at any depth. An item points at its
// parent with `parent_id` (null/missing = top level). Everything here works on the flat
// array the rest of the app already uses, so nothing else has to know about trees.

const parentOf = (i) => i.parent_id ?? null;

// Group items by parent, each group in position order. An item whose parent isn't in the
// list (for example mid-sync) is treated as top level so it can never disappear.
export function childrenByParent(items) {
  const ids = new Set(items.map((i) => i.id));
  const groups = new Map();
  for (const i of sortByPosition(items)) {
    const p = parentOf(i);
    const key = p !== null && ids.has(p) ? p : null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  return groups;
}

// The items directly under `parentId` (null = top level), in position order.
export function siblingsOf(items, parentId = null) {
  return childrenByParent(items).get(parentId ?? null) || [];
}

// An item's id plus the ids of everything under it, however deep.
export function subtreeIds(items, id) {
  const groups = childrenByParent(items);
  const out = [];
  const stack = [id];
  while (stack.length) {
    const x = stack.pop();
    out.push(x);
    for (const c of groups.get(x) || []) stack.push(c.id);
  }
  return out;
}

// Parents before their children (a pre-order walk, without recursion so depth is unlimited).
function preorder(groups) {
  const order = [];
  const stack = [...(groups.get(null) || [])].reverse();
  while (stack.length) {
    const n = stack.pop();
    order.push(n);
    const kids = groups.get(n.id) || [];
    for (let k = kids.length - 1; k >= 0; k--) stack.push(kids[k]);
  }
  return order;
}

// Every item, parents before their children, siblings in position order.
export function itemsInTreeOrder(items) {
  return preorder(childrenByParent(items));
}

// How one child adds to its parent's progress. A task with no sub-tasks counts as one;
// a task with sub-tasks, or a plain-text section, counts as the tasks inside it.
function contribution(child, r) {
  if (child.has_checkbox && r.total === 0)
    return { done: child.completed ? 1 : 0, total: 1 };
  return { done: r.done, total: r.total };
}

/**
 * For every item: how many of the tasks under it are done, and whether it counts as
 * completed. A task with sub-tasks is completed exactly when all of them are (its own
 * saved tick is ignored); a task without sub-tasks uses its own tick.
 * Returns Map(id -> { done, total, completed }).
 */
export function computeRollup(items) {
  const groups = childrenByParent(items);
  const order = preorder(groups);
  const out = new Map();
  for (let k = order.length - 1; k >= 0; k--) {
    const n = order[k];
    let done = 0;
    let total = 0;
    for (const c of groups.get(n.id) || []) {
      const x = contribution(c, out.get(c.id));
      done += x.done;
      total += x.total;
    }
    const completed = n.has_checkbox
      ? total > 0
        ? done === total
        : !!n.completed
      : false;
    out.set(n.id, { done, total, completed });
  }
  return out;
}

// Whole-list progress: the tasks at the bottom of each branch (parents are roll-ups, so
// they are never counted twice).
export function listProgress(items) {
  const groups = childrenByParent(items);
  const roll = computeRollup(items);
  let done = 0;
  let total = 0;
  for (const c of groups.get(null) || []) {
    const x = contribution(c, roll.get(c.id));
    done += x.done;
    total += x.total;
  }
  return { done, total };
}

/**
 * The rows to draw, in order, for a list that may contain sub-items.
 * filter/query keep every match plus the parents leading to it; sort applies among
 * siblings; `collapsed` (ids) hides what is under a folded item, except while filtering.
 */
export function buildRows(
  items,
  {
    filter = "all",
    sort = "custom",
    query = "",
    tag = null,
    collapsed = [],
    now = new Date(),
  } = {},
) {
  const q = query.trim().toLowerCase();
  const filtering = filter !== "all" || !!q || !!tag;
  const groups = childrenByParent(items);
  const roll = computeRollup(items);
  const folded = new Set(collapsed);

  const selfMatch = (i) => {
    const completed = roll.get(i.id).completed;
    if (filter === "active" && !(i.has_checkbox && !completed)) return false;
    if (filter === "completed" && !(i.has_checkbox && completed)) return false;
    if (
      filter === "due" &&
      !(!completed && needsAttention(dueState(i, { now })))
    )
      return false;
    if (tag && !hasTag(i.tags, tag)) return false;
    if (
      q &&
      !(
        i.text.toLowerCase().includes(q) ||
        (i.notes || "").toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  };

  // An item shows if it matches or anything under it does.
  const shown = new Map();
  const order = preorder(groups);
  for (let k = order.length - 1; k >= 0; k--) {
    const n = order[k];
    const kids = groups.get(n.id) || [];
    shown.set(
      n.id,
      !filtering || selfMatch(n) || kids.some((c) => shown.get(c.id)),
    );
  }

  const rank = (i) => (!i.has_checkbox ? 1 : roll.get(i.id).completed ? 2 : 0);
  const arrange = (list) => {
    if (sort === "created")
      return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === "status")
      return [...list].sort(
        (a, b) => rank(a) - rank(b) || a.position - b.position,
      );
    if (sort === "due")
      return [...list].sort(
        (a, b) =>
          dueSortKey(a).localeCompare(dueSortKey(b)) || a.position - b.position,
      );
    if (sort === "priority")
      return [...list].sort(
        (a, b) =>
          (b.priority || 0) - (a.priority || 0) || a.position - b.position,
      );
    return list; // already in position order
  };

  const place = new Map();
  for (const arr of groups.values())
    arr.forEach((it, k) => place.set(it.id, k));

  const rows = [];
  const stack = arrange(groups.get(null) || [])
    .filter((i) => shown.get(i.id))
    .map((item) => ({ item, depth: 0 }))
    .reverse();
  while (stack.length) {
    const { item, depth } = stack.pop();
    const kids = groups.get(item.id) || [];
    const canCollapse = kids.length > 0 && !filtering;
    const isCollapsed = canCollapse && folded.has(item.id);
    const r = roll.get(item.id);
    rows.push({
      item,
      depth,
      hasChildren: kids.length > 0,
      canCollapse,
      collapsed: isCollapsed,
      progress:
        r.total > 0 && kids.length > 0
          ? { done: r.done, total: r.total }
          : null,
      completed: r.completed,
      // 1-based place among its siblings in the list's own order (for Numbered lists).
      number: place.get(item.id) + 1,
      canIndent: place.get(item.id) > 0,
      canOutdent: depth > 0,
    });
    if (!isCollapsed) {
      const visibleKids = arrange(kids).filter((c) => shown.get(c.id));
      for (let k = visibleKids.length - 1; k >= 0; k--)
        stack.push({ item: visibleKids[k], depth: depth + 1 });
    }
  }
  return rows;
}
