import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// In-memory stand-in for Supabase. Like the real database, deleting a list also deletes the
// lists inside it, and a parent has to belong to the same owner.
const h = vi.hoisted(() => ({
  ME: { id: "me", email: "me@test.dev", name: "Me" },
  db: { lists: [], patches: [] },
}));

vi.mock("../src/services/api", () => {
  const find = (id) => h.db.lists.find((l) => l.id === id);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const inside = (id) => {
    const out = [id];
    for (let i = 0; i < out.length; i++)
      for (const l of h.db.lists)
        if (l.parent_list_id === out[i]) out.push(l.id);
    return out;
  };
  return {
    backendMode: "supabase",
    api: {
      capabilities: { auth: true, sharing: true, realtime: false },
      getUser: async () => h.ME,
      onAuthChange: () => () => {},
      signOut: async () => {},
      updateProfile: async () => {},
      subscribe: () => () => {},
      fetchWorkspace: async () =>
        clone(h.db.lists).map(({ sharedRole, ...l }) => ({
          ...l,
          role: l.owner_id === h.ME.id ? "owner" : sharedRole || "viewer",
        })),
      createList: async (l) => {
        if (!find(l.id)) {
          const { role: _r, items: _i, ...row } = l;
          h.db.lists.unshift({ ...row, owner_id: h.ME.id, items: [] });
        }
      },
      updateList: async (id, patch) => {
        h.db.patches.push({ id, patch });
        Object.assign(find(id), patch);
      },
      updateLists: async (ids, patch) => {
        for (const id of ids) Object.assign(find(id), patch);
      },
      deleteList: async (id) => {
        const gone = inside(id);
        h.db.lists = h.db.lists.filter((l) => !gone.includes(l.id));
      },
      insertItems: async (items) => {
        for (const it of items) {
          const l = find(it.list_id);
          if (l && !l.items.some((i) => i.id === it.id))
            l.items.push(clone(it));
        }
      },
      updateItem: async (id, patch) => {
        for (const l of h.db.lists) {
          const it = l.items.find((i) => i.id === id);
          if (it) Object.assign(it, patch);
        }
      },
      updateItems: async () => {},
      deleteItems: async () => {},
    },
  };
});

import App from "../src/App";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { ToastProvider } from "../src/contexts/ToastContext";
import { AuthProvider } from "../src/contexts/AuthContext";
import { SaveProvider } from "../src/contexts/SaveContext";

const item = (listId, n) => ({
  id: `${listId}-item-${n}`,
  list_id: listId,
  text: `task ${n}`,
  due_date: null,
  due_time: null,
  priority: 0,
  tags: [],
  notes: "",
  has_checkbox: true,
  completed: false,
  position: 1024 * n,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});
const stored = (id, parent = null, o = {}) => ({
  id,
  owner_id: h.ME.id,
  parent_list_id: parent,
  list_type: "checklist",
  due_date: null,
  due_time: null,
  priority: 0,
  tags: [],
  title: id,
  description: "",
  icon: "",
  color: "amber",
  favorite: false,
  archived: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  items: [item(id, 1), item(id, 2)],
  ...o,
});

const mount = (path = "/app") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SaveProvider>
              <App />
            </SaveProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );

const nav = () => screen.getByRole("navigation", { name: "Lists" });
const rowTitles = () => {
  const ul = nav().querySelectorAll("ul")[1];
  return ul
    ? [...ul.querySelectorAll("button[title]")].map((b) =>
        b.getAttribute("title"),
      )
    : [];
};
const ready = async () => {
  await waitFor(() => {
    expect(
      screen.queryByRole("status", { name: /loading your lists/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("List title") ||
        screen.queryByLabelText("Name for a new list"),
    ).toBeTruthy();
  });
};
beforeEach(() => {
  h.db.lists = [];
  localStorage.clear();
});

import { dayKey } from "../src/utils/due";
const day = (n) => dayKey(new Date(Date.now() + n * 864e5));

const itemRowMenu = async (user, text, name) => {
  await user.click(
    await screen.findByRole("button", { name: `Actions for “${text}”` }),
  );
  await user.click(await screen.findByRole("menuitem", { name }));
};
const openList = (id, q = "") => mount(`/app/${id}${q}`);

beforeEach(() => {
  h.db.lists = [];
  h.db.patches = [];
  localStorage.clear();
});

describe("due dates, priority and tags on items", () => {
  it("sets all three from the item menu and shows them on the row", async () => {
    h.db.lists = [stored("Home")];
    const user = userEvent.setup();
    openList("Home");
    await ready();
    await itemRowMenu(user, "task 1", /due date, priority/i);
    const panel = (
      await screen.findByRole("button", { name: /due date/i })
    ).closest("div.rounded-lg");
    await user.click(within(panel).getByRole("button", { name: /due date/i }));
    const cal = await screen.findByRole("dialog", { name: "Choose a date" });
    await user.click(within(cal).getByRole("button", { name: "Today" }));
    await user.click(within(panel).getByRole("button", { name: "High" }));
    await user.type(
      within(panel).getByLabelText("Tags"),
      "urgent, Home{Enter}",
    );
    await waitFor(() => {
      const it = h.db.lists[0].items.find((i) => i.id === "Home-item-1");
      expect(it.due_date).toBe(day(0));
      expect(it.priority).toBe(3);
      expect(it.tags).toEqual(["urgent", "Home"]);
    });
    await user.click(within(panel).getByRole("button", { name: "Done" }));
    const row = screen.getByText("task 1").closest("div.group");
    expect(row.querySelector('[data-due="today"]')).toBeTruthy();
    expect(within(row).getByText("High")).toBeInTheDocument();
    expect(within(row).getByText("#urgent")).toBeInTheDocument();
  });

  it("a past due date shows as overdue", async () => {
    h.db.lists = [stored("Home")];
    h.db.lists[0].items[0].due_date = day(-3);
    openList("Home");
    await ready();
    const row = (await screen.findByText("task 1")).closest("div.group");
    expect(row.querySelector('[data-due="overdue"]')).toBeTruthy();
  });

  it("a finished item isn't shown as overdue", async () => {
    h.db.lists = [stored("Home")];
    h.db.lists[0].items[0].due_date = day(-3);
    h.db.lists[0].items[0].completed = true;
    openList("Home");
    await ready();
    const row = (await screen.findByText("task 1")).closest("div.group");
    expect(row.querySelector('[data-due="done"]')).toBeTruthy();
    expect(row.querySelector('[data-due="overdue"]')).toBeNull();
  });

  it("clearing the due date removes the time too", async () => {
    h.db.lists = [stored("Home")];
    Object.assign(h.db.lists[0].items[0], {
      due_date: day(2),
      due_time: "09:00:00",
    });
    const user = userEvent.setup();
    openList("Home");
    await ready();
    await itemRowMenu(user, "task 1", /due date, priority/i);
    await user.click(
      await screen.findByRole("button", { name: /clear due date/i }),
    );
    await waitFor(() => {
      const it = h.db.lists[0].items[0];
      expect(it.due_date).toBeNull();
      expect(it.due_time).toBeNull();
    });
  });

  it("Due soon filter, due-date sort and tag filter work inside a list", async () => {
    h.db.lists = [stored("Home")];
    const [a, b] = h.db.lists[0].items;
    Object.assign(a, { due_date: day(4), tags: ["home"] });
    Object.assign(b, { due_date: day(-1), priority: 3 });
    h.db.lists[0].items.push({ ...item("Home", 3), tags: ["work"] });
    const user = userEvent.setup();
    openList("Home");
    await ready();
    const names = () =>
      [
        ...document.querySelectorAll('ul[aria-label="Checklist items"] > li p'),
      ].map((p) => p.textContent.trim().slice(0, 6));
    const expectNames = (want) => waitFor(() => expect(names()).toEqual(want));
    await expectNames(["task 1", "task 2", "task 3"]);
    const filters = within(screen.getByRole("group", { name: "Filter items" }));
    await user.click(filters.getByRole("button", { name: /due soon/i }));
    await expectNames(["task 1", "task 2"]);
    await user.click(filters.getByRole("button", { name: /^all/i }));
    await user.click(screen.getByRole("button", { name: /custom order/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Due date" }));
    await expectNames(["task 2", "task 1", "task 3"]);
    await user.click(screen.getByRole("button", { name: /filter by tag/i }));
    await user.click(await screen.findByRole("menuitem", { name: "#work" }));
    await expectNames(["task 3"]);
    await user.click(
      screen.getByRole("button", { name: /tag filter: #work/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /show all tags/i }),
    );
    await waitFor(() => expect(names()).toHaveLength(3));
  });
});

describe("list types", () => {
  const create = async (user, name, type) => {
    await user.click(
      within(nav()).getByRole("button", { name: /create new list/i }),
    );
    const dialog = await screen.findByRole("dialog", { name: /^new list$/i });
    await user.type(within(dialog).getByLabelText(/name/i), name);
    await user.click(
      within(dialog).getByRole("button", { name: new RegExp(type, "i") }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    await screen.findByLabelText("List title");
  };

  it("a Notes list adds plain-text items and hides progress", async () => {
    h.db.lists = [stored("Other")];
    const user = userEvent.setup();
    mount();
    await ready();
    await create(user, "Ideas", "notes");
    expect(h.db.lists.find((l) => l.title === "Ideas").list_type).toBe("notes");
    expect(screen.queryByRole("region", { name: "Progress" })).toBeNull();
    await user.type(screen.getByLabelText("New item"), "first idea{Enter}");
    await waitFor(() =>
      expect(
        h.db.lists.find((l) => l.title === "Ideas").items[0].has_checkbox,
      ).toBe(false),
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    // Active / Completed make no sense without checkboxes.
    expect(screen.queryByRole("button", { name: /^active/i })).toBeNull();
  });

  it("a Checklist keeps checkboxes and progress", async () => {
    h.db.lists = [stored("Other")];
    const user = userEvent.setup();
    mount();
    await ready();
    await create(user, "Chores", "checklist");
    expect(
      screen.getByRole("region", { name: "Progress" }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("New item"), "dishes{Enter}");
    await waitFor(() =>
      expect(
        h.db.lists.find((l) => l.title === "Chores").items[0].has_checkbox,
      ).toBe(true),
    );
  });

  it("a Numbered list shows 1. 2. 3.", async () => {
    h.db.lists = [stored("Steps", null, { list_type: "numbered" })];
    openList("Steps");
    await ready();
    const list = await screen.findByRole("list", { name: "Checklist items" });
    expect(within(list).getByLabelText("Number 1")).toHaveTextContent("1.");
    expect(within(list).getByLabelText("Number 2")).toHaveTextContent("2.");
  });

  it("the type can be changed later, and only what changed is saved", async () => {
    h.db.lists = [stored("Steps")];
    const user = userEvent.setup();
    openList("Steps");
    await ready();
    await user.click(
      await screen.findByRole("button", { name: /list actions/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /edit details/i }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: /edit list details/i,
    });
    await user.click(within(dialog).getByRole("button", { name: /numbered/i }));
    await user.click(
      within(dialog).getByRole("button", { name: /more options/i }),
    );
    await user.type(within(dialog).getByLabelText("Tags"), "how-to{Enter}");
    await user.click(within(dialog).getByRole("button", { name: "Medium" }));
    await user.click(
      within(dialog).getByRole("button", { name: /save changes/i }),
    );
    await waitFor(() => expect(h.db.patches).toHaveLength(1));
    expect(h.db.patches[0].patch).toEqual({
      list_type: "numbered",
      priority: 2,
      tags: ["how-to"],
    });
    expect(await screen.findByText("Numbered")).toBeInTheDocument();
  });
});

describe("Due soon view and tags in the sidebar", () => {
  it("Due soon lists lists with something due in a week, most urgent first, with a count", async () => {
    h.db.lists = [
      stored("Far", null, { due_date: day(30) }),
      stored("Soon", null, { due_date: day(3) }),
      stored("Late"),
      stored("Plain"),
    ];
    Object.assign(h.db.lists[2].items[0], { due_date: day(-1) });
    const user = userEvent.setup();
    mount();
    await ready();
    const btn = within(nav()).getByRole("button", { name: /^due soon/i });
    expect(btn).toHaveTextContent("2");
    await user.click(btn);
    await waitFor(() => expect(rowTitles()).toEqual(["Late", "Soon"]));
    expect(within(nav()).getByText("Overdue")).toBeInTheDocument();
  });

  it("clicking a tag shows only lists with it (on the list or an item)", async () => {
    h.db.lists = [
      stored("A", null, { tags: ["trip"] }),
      stored("B"),
      stored("C"),
    ];
    h.db.lists[2].items[0].tags = ["Trip"];
    const user = userEvent.setup();
    mount();
    await ready();
    const group = within(nav()).getByRole("group", {
      name: /filter lists by tag/i,
    });
    await user.click(within(group).getByRole("button", { name: "#trip" }));
    await waitFor(() => expect(rowTitles()).toEqual(["A", "C"]));
    await user.click(within(group).getByRole("button", { name: "#trip" }));
    await waitFor(() => expect(rowTitles()).toEqual(["A", "B", "C"]));
  });

  it("no tags anywhere means no tag strip", async () => {
    h.db.lists = [stored("A")];
    mount();
    await ready();
    expect(
      within(nav()).queryByRole("group", { name: /filter lists by tag/i }),
    ).toBeNull();
  });
});

describe("breadcrumb", () => {
  it("shows where a sub-list lives and jumps to a parent", async () => {
    h.db.lists = [
      stored("Home"),
      stored("Kitchen", "Home"),
      stored("Pantry", "Kitchen"),
    ];
    const user = userEvent.setup();
    openList("Pantry");
    await ready();
    const crumbs = await screen.findByRole("navigation", {
      name: "Breadcrumb",
    });
    expect(
      [...crumbs.querySelectorAll("button")].map((b) => b.textContent.trim()),
    ).toEqual(["Home", "Kitchen"]);
    await user.click(within(crumbs).getByRole("button", { name: "Kitchen" }));
    await waitFor(() =>
      expect(screen.getByLabelText("List title")).toHaveValue("Kitchen"),
    );
    expect(
      within(
        screen.getByRole("navigation", { name: "Breadcrumb" }),
      ).getAllByRole("button"),
    ).toHaveLength(1);
  });

  it("a top-level list has no breadcrumb", async () => {
    h.db.lists = [stored("Home")];
    openList("Home");
    await ready();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
  });
});
