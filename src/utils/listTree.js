// Lists can sit inside other lists of the same owner (sub-lists), at any depth. A list
// points at its parent with `parent_list_id` (null/missing = top level). Like utils/tree.js
// for items, everything here works on the flat array of lists the app already uses, and
// nothing is recursive, so depth is unlimited.

const parentOf = (l) => l.parent_list_id ?? null;

// Group lists by parent, keeping the order they came in. A list whose parent isn't in
// `lists` (for example a list shared with you whose parent is someone else's, or a parent
// that is archived while you look at the active lists) is treated as top level, so a
// list can never disappear because of where it sits.
export function listsByParent(lists) {
  const ids = new Set(lists.map((l) => l.id));
  const groups = new Map();
  for (const l of lists) {
    const p = parentOf(l);
    const key = p !== null && p !== l.id && ids.has(p) ? p : null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  return groups;
}

// The ids of everything inside `id`, however deep (not including `id` itself).
export function listDescendantIds(lists, id) {
  const groups = listsByParent(lists);
  const out = [];
  const seen = new Set([id]);
  const stack = [id];
  while (stack.length) {
    const x = stack.pop();
    for (const c of groups.get(x) || []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c.id);
      stack.push(c.id);
    }
  }
  return out;
}

// `id` plus everything inside it.
export function listSubtreeIds(lists, id) {
  return [id, ...listDescendantIds(lists, id)];
}

// The ids of the lists above `id` (nearest parent first).
export function listAncestorIds(lists, id) {
  const byId = new Map(lists.map((l) => [l.id, l]));
  const out = [];
  const seen = new Set([id]);
  let p = parentOf(byId.get(id) || {});
  while (p && byId.has(p) && !seen.has(p)) {
    out.push(p);
    seen.add(p);
    p = parentOf(byId.get(p));
  }
  return out;
}

// Can `id` be moved inside `parentId` (null = top level)? Not into itself, and not into one
// of its own sub-lists. (The database enforces this too; this keeps the UI from offering it.)
export function canMoveList(lists, id, parentId) {
  if (parentId == null) return true;
  if (parentId === id) return false;
  return !listDescendantIds(lists, id).includes(parentId);
}

// The rows to draw in the sidebar: parents before their children, each group in the order
// given. Children of a list that is not in `expanded` are left out. Each row says how deep
// it is and whether it has anything inside it.
export function buildListRows(lists, expanded = [], { flat = false } = {}) {
  if (flat)
    return lists.map((list) => ({
      list,
      depth: 0,
      hasChildren: false,
      expanded: false,
    }));
  const open = new Set(expanded);
  const groups = listsByParent(lists);
  const rows = [];
  const stack = [...(groups.get(null) || [])]
    .reverse()
    .map((list) => ({ list, depth: 0 }));
  while (stack.length) {
    const { list, depth } = stack.pop();
    const kids = groups.get(list.id) || [];
    const isOpen = open.has(list.id);
    rows.push({ list, depth, hasChildren: kids.length > 0, expanded: isOpen });
    if (isOpen)
      for (let k = kids.length - 1; k >= 0; k--)
        stack.push({ list: kids[k], depth: depth + 1 });
  }
  return rows;
}

// The lists you could move `id` into, as an indented pick-list: your own lists that are not
// archived, minus `id` and everything inside it. Always fully expanded.
export function moveTargets(lists, id) {
  const blocked = new Set(listSubtreeIds(lists, id));
  const pool = lists.filter(
    (l) => l.role === "owner" && !l.archived && !blocked.has(l.id),
  );
  const all = pool.map((l) => l.id);
  return buildListRows(pool, all);
}
