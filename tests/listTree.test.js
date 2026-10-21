import { describe, expect, it } from "vitest";
import {
  buildListRows,
  canMoveList,
  listAncestorIds,
  listDescendantIds,
  listSubtreeIds,
  moveTargets,
} from "../src/utils/listTree";

const L = (id, parent = null, o = {}) => ({
  id,
  title: id,
  parent_list_id: parent,
  role: "owner",
  archived: false,
  ...o,
});
// a ─ b ─ c
//   └ d
// e
const lists = [L("a"), L("b", "a"), L("c", "b"), L("d", "a"), L("e")];

describe("list tree helpers", () => {
  it("finds everything inside a list, however deep", () => {
    expect(listDescendantIds(lists, "a").sort()).toEqual(["b", "c", "d"]);
    expect(listSubtreeIds(lists, "b").sort()).toEqual(["b", "c"]);
    expect(listDescendantIds(lists, "e")).toEqual([]);
  });

  it("finds the lists above one, nearest first", () => {
    expect(listAncestorIds(lists, "c")).toEqual(["b", "a"]);
    expect(listAncestorIds(lists, "a")).toEqual([]);
    expect(listAncestorIds(lists, "missing")).toEqual([]);
  });

  it("won't move a list into itself or into something inside it", () => {
    expect(canMoveList(lists, "a", "a")).toBe(false);
    expect(canMoveList(lists, "a", "c")).toBe(false);
    expect(canMoveList(lists, "b", "a")).toBe(true);
    expect(canMoveList(lists, "c", null)).toBe(true);
    expect(canMoveList(lists, "e", "c")).toBe(true);
  });

  it("builds sidebar rows: parents first, children only when unfolded", () => {
    const ids = (rows) => rows.map((r) => `${r.depth}:${r.list.id}`);
    expect(ids(buildListRows(lists, []))).toEqual(["0:a", "0:e"]);
    expect(ids(buildListRows(lists, ["a"]))).toEqual([
      "0:a",
      "1:b",
      "1:d",
      "0:e",
    ]);
    expect(ids(buildListRows(lists, ["a", "b"]))).toEqual([
      "0:a",
      "1:b",
      "2:c",
      "1:d",
      "0:e",
    ]);
    const rows = buildListRows(lists, ["a"]);
    expect(rows[0]).toMatchObject({ hasChildren: true, expanded: true });
    expect(rows[1]).toMatchObject({ hasChildren: true, expanded: false });
    expect(rows[2]).toMatchObject({ hasChildren: false });
  });

  it("flat mode ignores nesting", () => {
    const rows = buildListRows(lists, ["a"], { flat: true });
    expect(rows.map((r) => r.list.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(rows.every((r) => r.depth === 0)).toBe(true);
  });

  it("a list whose parent isn't in the set shows at the top level", () => {
    const some = [L("x", "somebody-elses"), L("y", "x")];
    expect(buildListRows(some, []).map((r) => r.list.id)).toEqual(["x"]);
    expect(buildListRows(some, ["x"]).map((r) => r.list.id)).toEqual([
      "x",
      "y",
    ]);
  });

  it("handles very deep nesting without recursion problems", () => {
    const deep = [L("n0")];
    for (let i = 1; i < 5000; i++) deep.push(L(`n${i}`, `n${i - 1}`));
    expect(listDescendantIds(deep, "n0")).toHaveLength(4999);
    const rows = buildListRows(
      deep,
      deep.map((l) => l.id),
    );
    expect(rows).toHaveLength(5000);
    expect(rows[4999].depth).toBe(4999);
  });

  it("move targets: only your own, un-archived lists, minus the list itself and what's inside it", () => {
    const mixed = [
      ...lists,
      L("f", null, { archived: true }),
      L("g", null, { role: "editor" }),
    ];
    expect(moveTargets(mixed, "b").map((r) => r.list.id)).toEqual([
      "a",
      "d",
      "e",
    ]);
  });
});
