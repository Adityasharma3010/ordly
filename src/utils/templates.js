import { POSITION_STEP } from "./position";
import { itemsInTreeOrder } from "./tree";

// A template is { id, title, icon, color, description, items } where items is a tree:
// [{ text, notes?, has_checkbox, children: [...] }, ...].

// The biggest template we will save (as JSON), and how deep it may nest. The database
// enforces limits of its own; these keep us well inside them.
export const MAX_TEMPLATE_BYTES = 200_000;
export const MAX_TEMPLATE_DEPTH = 60;

// Turns a template's tree into the flat items a list stores, with fresh ids, each item
// pointing at its parent, in the template's order, and nothing ticked.
export function templateItems(template, listId, { uid, now }) {
  const out = [];
  const stack = [{ nodes: template.items || [], parentId: null }];
  while (stack.length) {
    const { nodes, parentId } = stack.pop();
    const made = nodes.map((n, i) => ({
      id: uid(),
      list_id: listId,
      parent_id: parentId,
      text: n.text,
      notes: n.notes ?? "",
      has_checkbox: n.has_checkbox !== false,
      completed: false,
      position: (i + 1) * POSITION_STEP,
      created_at: now,
      updated_at: now,
    }));
    out.push(...made);
    made.forEach((m, i) => {
      const kids = nodes[i].children;
      if (kids?.length) stack.push({ nodes: kids, parentId: m.id });
    });
  }
  return out;
}

// The opposite: a list's flat items become a tree (without ids, ticks or dates).
export function templateTreeFromItems(items) {
  const ordered = itemsInTreeOrder(items);
  const ids = new Set(items.map((i) => i.id));
  const nodes = new Map();
  const roots = [];
  for (const i of ordered) {
    const node = {
      text: i.text,
      notes: i.notes || "",
      has_checkbox: i.has_checkbox,
      children: [],
    };
    nodes.set(i.id, node);
    const parent =
      i.parent_id && ids.has(i.parent_id) ? nodes.get(i.parent_id) : null;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}

// How many items a template holds in total.
export function countTemplateItems(tree) {
  let n = 0;
  const stack = [...tree];
  while (stack.length) {
    const node = stack.pop();
    n += 1;
    if (node.children?.length) stack.push(...node.children);
  }
  return n;
}

// How many levels deep a template goes (a flat template is 1).
export function templateDepth(tree) {
  let deepest = 0;
  const stack = tree.map((node) => ({ node, depth: 1 }));
  while (stack.length) {
    const { node, depth } = stack.pop();
    deepest = Math.max(deepest, depth);
    for (const c of node.children || [])
      stack.push({ node: c, depth: depth + 1 });
  }
  return deepest;
}

// The size of a template once saved, or Infinity if it is too tangled to measure.
export function templateBytes(tree) {
  try {
    return JSON.stringify(tree).length;
  } catch {
    return Infinity;
  }
}
