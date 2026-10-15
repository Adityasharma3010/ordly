import { describe, expect, it } from "vitest";
import {
  getStats,
  filterAndSortItems,
  searchWorkspace,
  listsForView,
} from "../src/utils/listStats";
import {
  positionAtEnd,
  positionBetween,
  positionForMovedItem,
} from "../src/utils/position";
import { safeNext } from "../src/pages/AuthPage";

const item = (o) => ({
  id: o.id,
  text: o.text ?? o.id,
  notes: "",
  has_checkbox: true,
  completed: false,
  position: 1,
  created_at: "2026-01-01T00:00:00Z",
  ...o,
});

describe("getStats", () => {
  it("ignores plain-text items in completion math", () => {
    const s = getStats([
      item({ id: "a", completed: true }),
      item({ id: "b" }),
      item({ id: "n", has_checkbox: false, completed: true }),
    ]);
    expect(s).toMatchObject({
      total: 2,
      done: 1,
      remaining: 1,
      percent: 50,
      totalItems: 3,
      isComplete: false,
    });
  });
  it('is not "complete" with zero checkbox items', () => {
    expect(getStats([item({ id: "n", has_checkbox: false })]).isComplete).toBe(
      false,
    );
    expect(getStats([]).percent).toBe(0);
  });
  it("removing the checkbox from a done item drops it from the totals", () => {
    const done = item({ id: "a", completed: true });
    expect(getStats([done]).isComplete).toBe(true);
    expect(getStats([{ ...done, has_checkbox: false }]).total).toBe(0);
  });
});

describe("filterAndSortItems", () => {
  const items = [
    item({ id: "a", position: 3, completed: true, created_at: "2026-01-01" }),
    item({ id: "b", position: 1, created_at: "2026-01-03" }),
    item({
      id: "n",
      position: 2,
      has_checkbox: false,
      text: "note",
      created_at: "2026-01-02",
    }),
  ];
  it("filters active/completed and never matches plain text", () => {
    expect(
      filterAndSortItems(items, { filter: "active" }).map((i) => i.id),
    ).toEqual(["b"]);
    expect(
      filterAndSortItems(items, { filter: "completed" }).map((i) => i.id),
    ).toEqual(["a"]);
  });
  it("sorts by custom order, newest, and status", () => {
    expect(
      filterAndSortItems(items, { sort: "custom" }).map((i) => i.id),
    ).toEqual(["b", "n", "a"]);
    expect(
      filterAndSortItems(items, { sort: "created" }).map((i) => i.id),
    ).toEqual(["b", "n", "a"]);
    expect(
      filterAndSortItems(items, { sort: "status" }).map((i) => i.id),
    ).toEqual(["b", "n", "a"]);
  });
  it("searches text", () => {
    expect(
      filterAndSortItems(items, { query: "NOTE" }).map((i) => i.id),
    ).toEqual(["n"]);
  });
});

describe("fractional positions", () => {
  it("appends, inserts between, and computes moved positions", () => {
    expect(positionAtEnd([])).toBe(1024);
    expect(positionAtEnd([{ position: 5 }])).toBe(1029);
    expect(positionBetween(1, 3)).toBe(2);
    expect(positionBetween(null, 4)).toBeLessThan(4);
    const ordered = [
      { id: "x", position: 10 },
      { id: "m", position: 99 },
      { id: "y", position: 20 },
    ];
    expect(positionForMovedItem(ordered, "m")).toBe(15);
  });
});

describe("workspace helpers", () => {
  const list = (o) => ({
    title: "T",
    description: "",
    items: [],
    archived: false,
    favorite: false,
    role: "owner",
    updated_at: "2026-01-01",
    ...o,
  });
  it("searches titles, descriptions and items", () => {
    const lists = [
      list({ id: "1", title: "Groceries" }),
      list({ id: "2", description: "trip to Rome" }),
      list({ id: "3", items: [item({ id: "i", text: "Buy rome tickets" })] }),
    ];
    expect(searchWorkspace(lists, "rome").map((r) => r.list.id)).toEqual([
      "2",
      "3",
    ]);
    expect(searchWorkspace(lists, "  ")).toEqual([]);
  });
  it("builds sidebar views", () => {
    const lists = [
      list({ id: "a", favorite: true }),
      list({ id: "b", archived: true }),
      list({ id: "c", role: "editor" }),
    ];
    expect(listsForView(lists, "all").map((l) => l.id)).toEqual(["a", "c"]);
    expect(listsForView(lists, "favorites").map((l) => l.id)).toEqual(["a"]);
    expect(listsForView(lists, "archived").map((l) => l.id)).toEqual(["b"]);
    expect(listsForView(lists, "shared").map((l) => l.id)).toEqual(["c"]);
  });
});

describe("safeNext", () => {
  it("only allows same-site paths", () => {
    expect(safeNext("/s/abc")).toBe("/s/abc");
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe("My Lists view", () => {
  const l = (id, o = {}) => ({
    id,
    title: id,
    description: "",
    items: [],
    archived: false,
    favorite: false,
    role: "owner",
    updated_at: "2026-01-01",
    ...o,
  });
  const lists = [
    l("owned-1"),
    l("owned-2", { favorite: true }),
    l("shared-editor", { role: "editor" }),
    l("shared-viewer", { role: "viewer", favorite: true }),
    l("owned-archived", { archived: true }),
    l("shared-archived", { role: "viewer", archived: true }),
  ];
  const ids = (view) => listsForView(lists, view).map((x) => x.id);

  it("myLists = non-archived lists the user owns, nothing else", () => {
    expect(ids("myLists")).toEqual(["owned-1", "owned-2"]);
  });
  it("all = every accessible non-archived list (owned + shared)", () => {
    expect(ids("all")).toEqual([
      "owned-1",
      "owned-2",
      "shared-editor",
      "shared-viewer",
    ]);
  });
  it("shared = non-archived lists owned by someone else", () => {
    expect(ids("shared")).toEqual(["shared-editor", "shared-viewer"]);
  });
  it("archived = archived lists, owned or shared", () => {
    expect(ids("archived")).toEqual(["owned-archived", "shared-archived"]);
  });
  it("every active list is in exactly one of myLists / shared", () => {
    const mine = new Set(ids("myLists")),
      shared = new Set(ids("shared"));
    expect([...mine].filter((x) => shared.has(x))).toEqual([]);
    expect(mine.size + shared.size).toBe(ids("all").length);
  });
  it("favorites and recent still ignore archived lists and include shared ones", () => {
    expect(ids("favorites")).toEqual(["owned-2", "shared-viewer"]);
    expect(ids("recent")).toHaveLength(4);
  });
  it("is empty when the user owns nothing", () => {
    expect(listsForView([l("s", { role: "editor" })], "myLists")).toEqual([]);
  });
});
