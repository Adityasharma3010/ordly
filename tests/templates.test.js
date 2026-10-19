import { describe, expect, it } from "vitest";
import { STARTER_TEMPLATES } from "../src/data/starterTemplates";
import { ACCENT_KEYS } from "../src/utils/appearance";
import {
  countTemplateItems,
  templateBytes,
  templateDepth,
  templateItems,
  templateTreeFromItems,
} from "../src/utils/templates";

let n = 0;
const uid = () => `id-${++n}`;
const now = "2026-10-18T10:00:00.000Z";
const build = (template) => templateItems(template, "list-1", { uid, now });

// The shape of a tree without anything that is allowed to differ.
const shape = (nodes) =>
  nodes.map((x) => ({
    text: x.text,
    notes: x.notes ?? "",
    has_checkbox: x.has_checkbox,
    children: shape(x.children || []),
  }));

describe("starter templates", () => {
  it("are well formed: unique, valid colours, text everywhere, tasks and notes", () => {
    const ids = STARTER_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const titles = STARTER_TEMPLATES.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(6);

    for (const t of STARTER_TEMPLATES) {
      expect(ACCENT_KEYS, t.title).toContain(t.color);
      expect(t.icon.length).toBeGreaterThan(0);
      expect(t.icon.length).toBeLessThanOrEqual(16); // the lists table allows 16
      expect(t.title.length).toBeLessThanOrEqual(200);
      expect(t.description.length).toBeLessThanOrEqual(2000);
      expect(t.items.length).toBeGreaterThan(0);
      const stack = [...t.items];
      while (stack.length) {
        const item = stack.pop();
        expect(item.text.trim().length, t.title).toBeGreaterThan(0);
        expect(typeof item.has_checkbox).toBe("boolean");
        expect(Array.isArray(item.children)).toBe(true);
        stack.push(...item.children);
      }
    }
  });

  it("nest sub-items and include a few plain-text notes", () => {
    const groceries = STARTER_TEMPLATES.find((t) => t.title === "Groceries");
    expect(templateDepth(groceries.items)).toBe(2);
    const flat = build(groceries);
    expect(flat.some((i) => i.parent_id)).toBe(true);
    expect(flat.some((i) => !i.has_checkbox)).toBe(true);
  });
});

describe("templateItems (template -> list items)", () => {
  const tree = {
    items: [
      {
        text: "Pack",
        has_checkbox: true,
        notes: "Light!",
        children: [
          { text: "Passport", has_checkbox: true, children: [] },
          {
            text: "Charger",
            has_checkbox: true,
            children: [{ text: "USB-C", has_checkbox: true, children: [] }],
          },
        ],
      },
      { text: "Remember the weather", has_checkbox: false, children: [] },
    ],
  };

  it("makes one fresh item per node, with parents, order, notes and nothing ticked", () => {
    const items = build(tree);
    expect(items).toHaveLength(5);
    expect(new Set(items.map((i) => i.id)).size).toBe(5);
    expect(
      items.every((i) => i.list_id === "list-1" && i.completed === false),
    ).toBe(true);
    expect(
      items.every((i) => i.created_at === now && i.updated_at === now),
    ).toBe(true);

    const by = Object.fromEntries(items.map((i) => [i.text, i]));
    expect(by.Pack.parent_id).toBeNull();
    expect(by.Pack.notes).toBe("Light!");
    expect(by.Passport.parent_id).toBe(by.Pack.id);
    expect(by.Charger.parent_id).toBe(by.Pack.id);
    expect(by["USB-C"].parent_id).toBe(by.Charger.id);
    expect(by["Remember the weather"].has_checkbox).toBe(false);
    expect(by.Passport.notes).toBe(""); // missing notes become empty text
    // siblings are in the template's order
    expect(by.Pack.position).toBeLessThan(by["Remember the weather"].position);
    expect(by.Passport.position).toBeLessThan(by.Charger.position);
  });

  it("gives parents before their children, so they can be saved in one batch", () => {
    const items = build(tree);
    const seen = new Set();
    for (const i of items) {
      if (i.parent_id) expect(seen.has(i.parent_id)).toBe(true);
      seen.add(i.id);
    }
  });

  it("gives every use fresh ids, so two lists from one template never share items", () => {
    const a = build(tree).map((i) => i.id);
    const b = build(tree).map((i) => i.id);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });

  it("copes with an empty template", () => {
    expect(build({ items: [] })).toEqual([]);
  });
});

describe("templateTreeFromItems (list items -> template)", () => {
  it("round-trips: a template turned into a list and back is the same tree", () => {
    for (const t of STARTER_TEMPLATES) {
      expect(shape(templateTreeFromItems(build(t)))).toEqual(shape(t.items));
    }
  });

  it("keeps order by position and drops ids, ticks and dates", () => {
    const item = (id, parent, position, extra = {}) => ({
      id,
      list_id: "L",
      parent_id: parent,
      text: id,
      notes: "",
      has_checkbox: true,
      completed: true,
      position,
      created_at: "x",
      updated_at: "y",
      ...extra,
    });
    const tree = templateTreeFromItems([
      item("b", null, 2),
      item("a", null, 1),
      item("a2", "a", 2),
      item("a1", "a", 1, { notes: "note" }),
    ]);
    expect(tree.map((x) => x.text)).toEqual(["a", "b"]);
    expect(tree[0].children.map((x) => x.text)).toEqual(["a1", "a2"]);
    expect(tree[0].children[0]).toEqual({
      text: "a1",
      notes: "note",
      has_checkbox: true,
      children: [],
    });
    expect(JSON.stringify(tree)).not.toMatch(
      /completed|created_at|"id"|list_id/,
    );
  });

  it("treats an item whose parent is missing as top level", () => {
    const tree = templateTreeFromItems([
      {
        id: "x",
        list_id: "L",
        parent_id: "ghost",
        text: "lost",
        notes: "",
        has_checkbox: true,
        position: 1,
        created_at: "t",
      },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].text).toBe("lost");
  });
});

describe("measuring a template", () => {
  const chain = (depth) => {
    let node = { text: "leaf", has_checkbox: true, children: [] };
    for (let k = 1; k < depth; k++)
      node = { text: `n${k}`, has_checkbox: true, children: [node] };
    return [node];
  };

  it("counts items and depth without recursion, so very deep lists are safe", () => {
    const tree = chain(5000);
    expect(templateDepth(tree)).toBe(5000);
    expect(countTemplateItems(tree)).toBe(5000);
    expect(countTemplateItems([])).toBe(0);
    expect(templateDepth([])).toBe(0);
  });

  it("reports size, and Infinity when a tree is too tangled to measure", () => {
    expect(
      templateBytes([{ text: "a", has_checkbox: true, children: [] }]),
    ).toBeGreaterThan(10);
    expect(templateBytes(chain(200_000))).toBe(Infinity);
  });
});
