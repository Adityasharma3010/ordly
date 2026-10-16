import { describe, expect, it } from "vitest";
import {
  buildRows,
  childrenByParent,
  computeRollup,
  listProgress,
  siblingsOf,
  subtreeIds,
} from "../src/utils/tree";
import { getStats, filterAndSortItems } from "../src/utils/listStats";

let n = 0;
const mk = (id, parent = null, o = {}) => ({
  id,
  parent_id: parent,
  text: o.text ?? id,
  notes: o.notes ?? "",
  has_checkbox: o.box ?? true,
  completed: o.done ?? false,
  position: o.pos ?? ++n,
  created_at: o.created ?? `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`,
});
const ids = (rows) => rows.map((r) => r.item.id);

describe("tree basics", () => {
  it("groups by parent in position order and keeps orphans visible at the top", () => {
    const items = [
      mk("b", null, { pos: 2 }),
      mk("a", null, { pos: 1 }),
      mk("a2", "a", { pos: 2 }),
      mk("a1", "a", { pos: 1 }),
      mk("lost", "missing-parent", { pos: 3 }),
    ];
    const g = childrenByParent(items);
    expect(g.get(null).map((i) => i.id)).toEqual(["a", "b", "lost"]);
    expect(g.get("a").map((i) => i.id)).toEqual(["a1", "a2"]);
    expect(siblingsOf(items, "a").map((i) => i.id)).toEqual(["a1", "a2"]);
    expect(siblingsOf(items).map((i) => i.id)).toEqual(["a", "b", "lost"]);
  });

  it("subtreeIds returns the item and everything under it, at any depth", () => {
    const items = [mk("a"), mk("b", "a"), mk("c", "b"), mk("d", "c"), mk("x")];
    expect(subtreeIds(items, "a").sort()).toEqual(["a", "b", "c", "d"]);
    expect(subtreeIds(items, "c").sort()).toEqual(["c", "d"]);
    expect(subtreeIds(items, "x")).toEqual(["x"]);
  });
});

describe("computeRollup: parents complete when their children are", () => {
  it("a task without sub-tasks uses its own tick", () => {
    const r = computeRollup([mk("a", null, { done: true }), mk("b")]);
    expect(r.get("a")).toEqual({ done: 0, total: 0, completed: true });
    expect(r.get("b").completed).toBe(false);
  });

  it("a task with sub-tasks is complete exactly when all of them are, ignoring its own saved tick", () => {
    const some = computeRollup([
      mk("p", null, { done: true }), // stale tick
      mk("c1", "p", { done: true }),
      mk("c2", "p"),
    ]);
    expect(some.get("p")).toEqual({ done: 1, total: 2, completed: false });

    const all = computeRollup([
      mk("p", null, { done: false }),
      mk("c1", "p", { done: true }),
      mk("c2", "p", { done: true }),
    ]);
    expect(all.get("p")).toEqual({ done: 2, total: 2, completed: true });
  });

  it("works through several levels and only counts the tasks at the bottom", () => {
    const items = [
      mk("A"),
      mk("B", "A"),
      mk("c1", "B", { done: true }),
      mk("c2", "B"),
      mk("d", "A", { done: true }),
    ];
    const r = computeRollup(items);
    expect(r.get("B")).toEqual({ done: 1, total: 2, completed: false });
    expect(r.get("A")).toEqual({ done: 2, total: 3, completed: false });
    const done = computeRollup(items.map((i) => ({ ...i, completed: true })));
    expect(done.get("A").completed).toBe(true);
    expect(done.get("B").completed).toBe(true);
  });

  it("a plain-text section has no tick of its own but still rolls up what is inside", () => {
    const r = computeRollup([
      mk("h", null, { box: false }),
      mk("a", "h", { done: true }),
      mk("b", "h"),
    ]);
    expect(r.get("h")).toEqual({ done: 1, total: 2, completed: false });
  });

  it("a task whose sub-items are all plain text keeps its own tick", () => {
    const r = computeRollup([
      mk("p", null, { done: true }),
      mk("note", "p", { box: false }),
    ]);
    expect(r.get("p")).toEqual({ done: 0, total: 0, completed: true });
  });
});

describe("list progress", () => {
  it("is unchanged for flat lists", () => {
    const items = [
      mk("a", null, { done: true }),
      mk("b"),
      mk("c", null, { box: false }),
    ];
    expect(getStats(items)).toMatchObject({
      totalItems: 3,
      total: 2,
      done: 1,
      remaining: 1,
      percent: 50,
      isComplete: false,
    });
  });

  it("counts the tasks at the bottom of each branch once, not the parents too", () => {
    const items = [
      mk("trip"),
      mk("passport", "trip", { done: true }),
      mk("charger", "trip"),
      mk("solo", null, { done: true }),
    ];
    expect(listProgress(items)).toEqual({ done: 2, total: 3 });
    const s = getStats(items);
    expect(s.totalItems).toBe(4);
    expect(s.total).toBe(3);
    expect(s.percent).toBe(67);
    const finished = getStats(items.map((i) => ({ ...i, completed: true })));
    expect(finished.isComplete).toBe(true);
  });
});

describe("buildRows", () => {
  const items = [
    mk("a", null, { pos: 1 }),
    mk("a1", "a", { pos: 1, done: true }),
    mk("a2", "a", { pos: 2 }),
    mk("a2x", "a2", { pos: 1, text: "deep one" }),
    mk("b", null, { pos: 2, done: true }),
  ];

  it("lists parents before their children with the right depth, progress and indent flags", () => {
    const rows = buildRows(items);
    expect(ids(rows)).toEqual(["a", "a1", "a2", "a2x", "b"]);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 2, 0]);
    expect(rows[0].progress).toEqual({ done: 1, total: 2 });
    expect(rows[1].progress).toBeNull(); // a task with no sub-tasks shows no count
    expect(rows[0].completed).toBe(false);
    expect(rows.map((r) => r.canIndent)).toEqual([
      false, // first at its level
      false,
      true,
      false,
      true,
    ]);
    expect(rows.map((r) => r.canOutdent)).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it("folding hides what is underneath, but not while filtering or searching", () => {
    expect(ids(buildRows(items, { collapsed: ["a"] }))).toEqual(["a", "b"]);
    const [first] = buildRows(items, { collapsed: ["a"] });
    expect(first.collapsed).toBe(true);
    expect(first.canCollapse).toBe(true);

    const searching = buildRows(items, { collapsed: ["a"], query: "deep" });
    expect(ids(searching)).toEqual(["a", "a2", "a2x"]);
    expect(searching.every((r) => !r.collapsed && !r.canCollapse)).toBe(true);
  });

  it("the Active filter keeps the parents of what is left and drops finished siblings", () => {
    expect(ids(buildRows(items, { filter: "active" }))).toEqual([
      "a",
      "a2",
      "a2x",
    ]);
  });

  it("the Completed filter shows finished tasks and the parents that lead to them", () => {
    expect(ids(buildRows(items, { filter: "completed" }))).toEqual([
      "a",
      "a1",
      "b",
    ]);
  });

  it("sorting applies among siblings and keeps children under their parent", () => {
    const rows = buildRows(items, { sort: "status" });
    // top level: a (active) before b (done); under a: a2 (active) before a1 (done)
    expect(ids(rows)).toEqual(["a", "a2", "a2x", "a1", "b"]);
  });

  it("filterAndSortItems still returns plain items in display order", () => {
    expect(
      filterAndSortItems(items, { filter: "active" }).map((i) => i.id),
    ).toEqual(["a", "a2", "a2x"]);
  });

  it("has no depth limit", () => {
    const deep = Array.from({ length: 5000 }, (_, k) =>
      mk(`n${k}`, k === 0 ? null : `n${k - 1}`, { pos: 1 }),
    );
    const rows = buildRows(deep);
    expect(rows).toHaveLength(5000);
    expect(rows.at(-1).depth).toBe(4999);
    expect(subtreeIds(deep, "n0")).toHaveLength(5000);
    expect(getStats(deep).total).toBe(1); // only the bottom task counts
  });
});
