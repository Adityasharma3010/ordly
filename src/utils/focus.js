import { computeRollup, itemsInTreeOrder } from "./tree";

// Focus mode works through the tasks at the bottom of each branch: a task that has
// sub-tasks finishes by itself when they do, so only the sub-tasks are ever "the next
// thing to do". Each entry also carries the names of the items above it (its path) so you
// can see where it belongs.
export function focusQueue(items) {
  const roll = computeRollup(items);
  const byId = new Map(items.map((i) => [i.id, i]));
  const out = [];
  for (const item of itemsInTreeOrder(items)) {
    if (!item.has_checkbox) continue;
    const r = roll.get(item.id);
    if (!r || r.total > 0 || r.completed) continue;
    const path = [];
    const seen = new Set();
    let p = item.parent_id ? byId.get(item.parent_id) : null;
    while (p && !seen.has(p.id)) {
      seen.add(p.id);
      path.unshift(p.text);
      p = p.parent_id ? byId.get(p.parent_id) : null;
    }
    out.push({ item, path });
  }
  return out;
}

// Tasks you haven't skipped come first, in list order. Skipped ones follow, in the order
// you skipped them, so "Skip" really means "later".
export function orderQueue(queue, skipped) {
  const rank = new Map(skipped.map((id, k) => [id, k]));
  const fresh = queue.filter((q) => !rank.has(q.item.id));
  const later = queue
    .filter((q) => rank.has(q.item.id))
    .sort((a, b) => rank.get(a.item.id) - rank.get(b.item.id));
  return [...fresh, ...later];
}

// Skipping an already skipped task sends it to the back again.
export const skipItem = (skipped, id) => [
  ...skipped.filter((x) => x !== id),
  id,
];

// 75 -> "1:15", 3725 -> "1:02:05"
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
