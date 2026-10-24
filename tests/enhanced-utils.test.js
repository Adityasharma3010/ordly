import { describe, expect, it } from "vitest";
import {
  dayKey,
  dueSortKey,
  dueState,
  formatDue,
  needsAttention,
} from "../src/utils/due";
import { addTags, cleanTag, collectTags, removeTag } from "../src/utils/meta";
import { buildRows } from "../src/utils/tree";
import {
  listAttention,
  listsForView,
  listsWithTag,
  searchWorkspace,
} from "../src/utils/listStats";
import { resolveDrop, TOP_LEVEL_DROP } from "../src/utils/listTree";

// Wednesday 21 Oct 2026, 15:30 local time.
const NOW = new Date(2026, 9, 21, 15, 30);
const day = (n) => dayKey(new Date(2026, 9, 21 + n));

describe("due dates", () => {
  it("works out where a date stands", () => {
    expect(dueState({})).toBeNull();
    expect(dueState({ due_date: day(-1) }, { now: NOW })).toBe("overdue");
    expect(dueState({ due_date: day(0) }, { now: NOW })).toBe("today");
    expect(dueState({ due_date: day(1) }, { now: NOW })).toBe("soon");
    expect(dueState({ due_date: day(7) }, { now: NOW })).toBe("soon");
    expect(dueState({ due_date: day(8) }, { now: NOW })).toBe("later");
  });

  it("today only becomes overdue once its time has passed", () => {
    const at = (t) => dueState({ due_date: day(0), due_time: t }, { now: NOW });
    expect(at("15:29")).toBe("overdue");
    expect(at("15:30")).toBe("today");
    expect(at("18:00:00")).toBe("today"); // the database sends seconds
    expect(at(null)).toBe("today");
  });

  it("a finished thing is never overdue", () => {
    expect(dueState({ due_date: day(-3) }, { now: NOW, done: true })).toBe(
      "done",
    );
    expect(needsAttention("done")).toBe(false);
    expect(needsAttention("later")).toBe(false);
    expect(needsAttention("overdue")).toBe(true);
  });

  it("handles month and year ends", () => {
    const dec31 = new Date(2026, 11, 31, 9, 0);
    expect(dueState({ due_date: "2027-01-01" }, { now: dec31 })).toBe("soon");
    expect(dueState({ due_date: "2026-12-30" }, { now: dec31 })).toBe(
      "overdue",
    );
  });

  it("describes dates in plain words", () => {
    expect(formatDue({ due_date: day(0) }, NOW)).toBe("Today");
    expect(formatDue({ due_date: day(1) }, NOW)).toBe("Tomorrow");
    expect(formatDue({ due_date: day(-1) }, NOW)).toBe("Yesterday");
    expect(formatDue({ due_date: day(0), due_time: "14:30" }, NOW)).toMatch(
      /^Today, .*2:30/,
    );
    expect(formatDue({ due_date: "2027-03-04" }, NOW)).toMatch(/2027/);
    expect(formatDue({}, NOW)).toBe("");
  });

  it("sorts earliest first, no date last, no time = end of day", () => {
    const keys = [
      { due_date: day(2) },
      {},
      { due_date: day(1), due_time: "09:00" },
      { due_date: day(1) },
    ]
      .map((x) => ({ x, k: dueSortKey(x) }))
      .sort((a, b) => a.k.localeCompare(b.k))
      .map((o) => o.x);
    expect(keys[0]).toEqual({ due_date: day(1), due_time: "09:00" });
    expect(keys[1]).toEqual({ due_date: day(1) });
    expect(keys[3]).toEqual({});
  });
});

describe("tags", () => {
  it("cleans and de-duplicates (any case), several at once with commas", () => {
    expect(cleanTag("  #Urgent  ")).toBe("Urgent");
    expect(cleanTag("x".repeat(41))).toBe("");
    expect(addTags(["Home"], "home, Work ,, #errand")).toEqual([
      "Home",
      "Work",
      "errand",
    ]);
    expect(removeTag(["Home", "Work"], "home")).toEqual(["Work"]);
  });
  it("caps at 20 tags", () => {
    const many = Array.from({ length: 25 }, (_, i) => `t${i}`).join(",");
    expect(addTags([], many)).toHaveLength(20);
  });
  it("collects tags from lists and items, most used first", () => {
    const lists = [
      { tags: ["home"], items: [{ tags: ["work"] }, { tags: ["Home"] }] },
      { tags: [], items: [{ tags: ["work", "z"] }] },
    ];
    expect(collectTags(lists)).toEqual(["home", "work", "z"]);
    expect(collectTags(lists, { items: false })).toEqual(["home"]);
  });
});

const item = (id, o = {}) => ({
  id,
  text: id,
  notes: "",
  has_checkbox: true,
  completed: false,
  position: 1,
  parent_id: null,
  created_at: "2026-01-01T00:00:00Z",
  tags: [],
  priority: 0,
  ...o,
});

describe("item filters and sorts", () => {
  const items = [
    item("a", { position: 1, due_date: day(5), priority: 1, tags: ["home"] }),
    item("b", { position: 2, due_date: day(-2), priority: 3 }),
    item("c", { position: 3, priority: 2, tags: ["Work"] }),
    item("d", { position: 4, due_date: day(1), completed: true }),
  ];
  const ids = (o) => buildRows(items, { now: NOW, ...o }).map((r) => r.item.id);

  it("Due soon: unfinished items that are overdue, today or within a week", () => {
    expect(ids({ filter: "due" })).toEqual(["a", "b"]);
  });
  it("sorts by due date, and by priority (high first)", () => {
    expect(ids({ sort: "due" })).toEqual(["b", "d", "a", "c"]);
    expect(ids({ sort: "priority" })).toEqual(["b", "c", "a", "d"]);
  });
  it("filters by tag, ignoring case", () => {
    expect(ids({ tag: "work" })).toEqual(["c"]);
    expect(ids({ tag: "HOME" })).toEqual(["a"]);
  });
  it("numbers items by their place among siblings", () => {
    const rows = buildRows(
      [
        item("p", { position: 1 }),
        item("q", { position: 2 }),
        item("q1", { position: 1, parent_id: "q" }),
        item("q2", { position: 2, parent_id: "q" }),
      ],
      {},
    );
    expect(rows.map((r) => `${r.item.id}:${r.number}`)).toEqual([
      "p:1",
      "q:2",
      "q1:1",
      "q2:2",
    ]);
  });
});

describe("lists: Due soon view, tags, search", () => {
  const L = (id, o = {}) => ({
    id,
    title: id,
    description: "",
    archived: false,
    role: "owner",
    updated_at: "2026-01-01",
    tags: [],
    items: [],
    ...o,
  });
  const lists = [
    L("own-date", { due_date: day(3) }),
    L("item-late", { items: [item("x", { due_date: day(-1) })] }),
    L("far", { due_date: day(30) }),
    L("done-item", {
      items: [item("y", { due_date: day(-1), completed: true })],
    }),
    L("finished", {
      due_date: day(-5),
      items: [item("z", { completed: true })],
    }),
    L("archived", { due_date: day(1), archived: true }),
    L("tagged", { tags: ["trip"] }),
    L("item-tagged", { items: [item("t", { tags: ["Trip"] })] }),
  ];
  it("Due soon: lists with their own due date or an unfinished item due soon", () => {
    expect(listsForView(lists, "dueSoon", NOW).map((l) => l.id)).toEqual([
      "item-late",
      "own-date",
    ]);
  });
  it("says which date is the pressing one", () => {
    expect(listAttention(lists[1], NOW)).toMatchObject({
      state: "overdue",
      due_date: day(-1),
    });
    expect(listAttention(lists[2], NOW)).toBeNull();
  });
  it("filters lists by a tag on the list or on an item", () => {
    expect(listsWithTag(lists, "trip").map((l) => l.id)).toEqual([
      "tagged",
      "item-tagged",
    ]);
    expect(listsWithTag(lists, null)).toHaveLength(lists.length);
  });
  it("search also finds tags", () => {
    expect(searchWorkspace(lists, "trip").map((r) => r.list.id)).toEqual([
      "tagged",
      "item-tagged",
    ]);
  });
});

describe("drag-to-nest decisions", () => {
  const L = (id, parent = null, o = {}) => ({
    id,
    parent_list_id: parent,
    role: "owner",
    archived: false,
    ...o,
  });
  const lists = [L("a"), L("b", "a"), L("c"), L("s", null, { role: "editor" })];
  it("moves a list into another, or out to the top level", () => {
    expect(resolveDrop(lists, "c", "a")).toEqual({ parentId: "a" });
    expect(resolveDrop(lists, "b", TOP_LEVEL_DROP)).toEqual({ parentId: null });
  });
  it("ignores drops that would do nothing or break the tree", () => {
    expect(resolveDrop(lists, "a", "a")).toBeNull();
    expect(resolveDrop(lists, "a", "b")).toBeNull(); // into its own child
    expect(resolveDrop(lists, "b", "a")).toBeNull(); // already there
    expect(resolveDrop(lists, "c", TOP_LEVEL_DROP)).toBeNull(); // already top level
  });
  it("only your own lists can be moved or moved into", () => {
    expect(resolveDrop(lists, "s", "a")).toBeNull();
    expect(resolveDrop(lists, "c", "s")).toBeNull();
    expect(
      resolveDrop([...lists, L("z", null, { archived: true })], "c", "z"),
    ).toBeNull();
  });
});
