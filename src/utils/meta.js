// Priorities and tags: the small labels lists and items can carry.

export const PRIORITIES = [
  { value: 0, label: "None" },
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
];
export const priorityLabel = (p) =>
  PRIORITIES.find((x) => x.value === p)?.label ?? "None";

export const LIST_TYPES = {
  checklist: { label: "Checklist", hint: "Tasks you tick off" },
  numbered: { label: "Numbered", hint: "Steps in order: 1, 2, 3" },
  notes: { label: "Notes", hint: "Plain text, no checkboxes" },
};
export const listTypeOf = (list) =>
  LIST_TYPES[list?.list_type] ? list.list_type : "checklist";

export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;

// "  #Urgent  " -> "Urgent". Empty or too-long input gives "".
export function cleanTag(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/^#+/, "")
    .trim()
    .replace(/\s+/g, " ");
  return t.length > MAX_TAG_LENGTH ? "" : t;
}

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

// Adds the tags typed in `raw` (separate several with commas). No duplicates (any case).
export function addTags(tags = [], raw = "") {
  const out = [...tags];
  for (const part of String(raw).split(",")) {
    const t = cleanTag(part);
    if (t && out.length < MAX_TAGS && !out.some((x) => same(x, t))) out.push(t);
  }
  return out;
}

export const removeTag = (tags = [], tag) => tags.filter((t) => !same(t, tag));
export const hasTag = (tags = [], tag) => tags.some((t) => same(t, tag));

// Every tag used by these lists (and their items), most used first, then A–Z.
export function collectTags(lists, { items = true } = {}) {
  const counts = new Map();
  const bump = (tags = []) => {
    for (const t of tags) {
      const k = t.toLowerCase();
      const cur = counts.get(k);
      if (cur) cur.n++;
      else counts.set(k, { tag: t, n: 1 });
    }
  };
  for (const l of lists) {
    bump(l.tags);
    if (items) for (const i of l.items || []) bump(i.tags);
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag))
    .map((x) => x.tag);
}
