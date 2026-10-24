import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ---- In-memory stand-in for Supabase -------------------------------------------------
// Like the real fetchWorkspace(), `role` is derived on every load from owner_id + the
// current user (or the sharing row), so "refreshing" re-categorises from stored data.
const h = vi.hoisted(() => ({
  ME: { id: "me", email: "me@test.dev", name: "Me" },
  db: { lists: [] },
}));

vi.mock("../src/services/api", () => {
  const find = (id) => h.db.lists.find((l) => l.id === id);
  const clone = (v) => JSON.parse(JSON.stringify(v));
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
        Object.assign(find(id), patch, {
          updated_at: new Date().toISOString(),
        });
      },
      updateLists: async (ids, patch) => {
        for (const id of ids) Object.assign(find(id), patch);
      },
      deleteList: async (id) => {
        h.db.lists = h.db.lists.filter((l) => l.id !== id);
      },
      insertItems: async (items) => {
        for (const it of items) {
          const l = find(it.list_id);
          if (l && !l.items.some((i) => i.id === it.id))
            l.items.push(clone(it));
        }
      },
      updateItem: async (id, patch) => {
        for (const l of h.db.lists)
          for (const i of l.items) if (i.id === id) Object.assign(i, patch);
      },
      updateItems: async (ids, patch) => {
        for (const l of h.db.lists)
          for (const i of l.items)
            if (ids.includes(i.id)) Object.assign(i, patch);
      },
      deleteItems: async (ids) => {
        for (const l of h.db.lists)
          l.items = l.items.filter((i) => !ids.includes(i.id));
      },
    },
  };
});

import App from "../src/App";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { ToastProvider } from "../src/contexts/ToastContext";
import { AuthProvider } from "../src/contexts/AuthContext";
import { SaveProvider } from "../src/contexts/SaveContext";

let n = 0;
const stored = (title, o = {}) => ({
  id: `list-${++n}`,
  owner_id: h.ME.id,
  title,
  description: "",
  icon: "",
  color: "amber",
  favorite: false,
  archived: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: `2026-01-0${(n % 9) + 1}T00:00:00Z`,
  items: [
    {
      id: `item-${n}`,
      list_id: `list-${n}`,
      text: "a task",
      notes: "",
      has_checkbox: true,
      completed: false,
      position: 1024,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  ...o,
});
const shared = (title, role = "editor", o = {}) =>
  stored(title, { owner_id: "someone-else", sharedRole: role, ...o });

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
const navButton = (label) =>
  within(nav())
    .getAllByRole("button")
    .find((b) =>
      new RegExp(`^${label}\\s*\\d*$`).test(
        b.textContent.trim().replace(/\s+/g, " "),
      ),
    );
const count = (label) =>
  Number(navButton(label).textContent.match(/(\d+)\s*$/)?.[1] ?? NaN);
const rowTitles = () => {
  const ul = nav().querySelectorAll("ul")[1]; // 0 = view links, 1 = lists in the current view
  return ul
    ? [...ul.querySelectorAll("button[title]")].map((b) =>
        b.getAttribute("title"),
      )
    : [];
};
// Resolves once the workspace is loaded AND settled: wait until either a list is open or the
// home screen (nothing open yet) is showing.
const ready = async () => {
  await waitFor(() => {
    expect(
      screen.queryByRole("navigation", { name: "Lists" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: /loading your lists/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("List title") ||
        screen.queryByLabelText("Name for a new list"),
    ).toBeTruthy();
  });
  return nav();
};
const goTo = async (user, label) => {
  await user.click(navButton(label));
  await waitFor(() =>
    expect(navButton(label)).toHaveAttribute("aria-current", "page"),
  );
};
const openActions = async (user, item) => {
  await user.click(
    await screen.findByRole("button", { name: /list actions/i }),
  );
  await user.click(await screen.findByRole("menuitem", { name: item }));
};
const selectList = async (user, title) => {
  await user.click(within(nav()).getByTitle(title));
  await waitFor(() =>
    expect(screen.getByLabelText("List title")).toHaveValue(title),
  );
};

beforeEach(() => {
  h.db.lists = [];
  n = 0;
});

describe("My Lists navigation", () => {
  it('sits directly below "All lists" in the existing sidebar nav', async () => {
    h.db.lists = [stored("Owned A")];
    mount();
    await ready();
    const navLinks = [
      ...nav().querySelectorAll("ul")[0].querySelectorAll("button"),
    ]; // the view links
    const labels = navLinks.map((b) =>
      b.textContent.replace(/\d+\s*$/, "").trim(),
    );
    expect(labels).toEqual([
      "All lists",
      "My Lists",
      "Favorites",
      "Due soon",
      "Recently updated",
      "Shared with me",
      "Archived",
    ]);
  });

  it("owner of two lists + one shared list: My Lists 2, Shared with me 1, All lists 3", async () => {
    h.db.lists = [stored("Owned A"), stored("Owned B"), shared("Shared C")];
    const user = userEvent.setup();
    mount();
    await ready();

    expect(count("All lists")).toBe(3);
    expect(count("My Lists")).toBe(2);
    expect(count("Shared with me")).toBe(1);
    expect(count("Archived")).toBe(0);
    expect(rowTitles().sort()).toEqual(["Owned A", "Owned B", "Shared C"]);

    await goTo(user, "My Lists");
    expect(rowTitles().sort()).toEqual(["Owned A", "Owned B"]); // shared list is NOT here
    expect(
      within(nav()).getByRole("heading", { name: "My Lists" }),
    ).toBeInTheDocument();

    await goTo(user, "Shared with me");
    expect(rowTitles()).toEqual(["Shared C"]);

    await goTo(user, "All lists");
    expect(rowTitles()).toHaveLength(3);
  });

  it("a list received through sharing (viewer or editor) is in Shared with me + All lists, never My Lists", async () => {
    h.db.lists = [
      stored("Mine"),
      shared("From Bob", "viewer"),
      shared("From Eve", "editor"),
    ];
    const user = userEvent.setup();
    mount("/app?view=myLists");
    await ready();
    expect(rowTitles()).toEqual(["Mine"]);
    expect(count("My Lists")).toBe(1);
    expect(count("Shared with me")).toBe(2);
    expect(count("All lists")).toBe(3);
    await goTo(user, "Shared with me");
    expect(rowTitles().sort()).toEqual(["From Bob", "From Eve"]);
  });

  it("only lists you own get the favorite / archive / delete menu in the sidebar", async () => {
    h.db.lists = [
      stored("Mine"),
      shared("From Bob", "viewer"),
      shared("From Eve", "editor"),
    ];
    const user = userEvent.setup();
    mount("/app");
    await ready();
    const menu = (title) =>
      within(nav()).queryByRole("button", {
        name: new RegExp(`actions for “${title}”`, "i"),
      });
    expect(menu("Mine")).toBeInTheDocument();
    expect(menu("From Bob")).not.toBeInTheDocument();
    expect(menu("From Eve")).not.toBeInTheDocument();

    await user.click(menu("Mine"));
    expect(
      await screen.findByRole("menuitem", { name: /add to favorites/i }),
    ).toBeInTheDocument();
  });

  it("creating a list puts it in My Lists and All lists", async () => {
    h.db.lists = [stored("Owned A"), shared("Shared C")];
    const user = userEvent.setup();
    mount();
    await ready();
    expect([count("My Lists"), count("All lists")]).toEqual([1, 2]);

    await user.click(
      within(nav()).getByRole("button", { name: /create new list/i }),
    );
    const dialog = await screen.findByRole("dialog", { name: /new list/i });
    await user.type(within(dialog).getByLabelText(/name/i), "Brand new");
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );

    await waitFor(() => expect(count("My Lists")).toBe(2));
    expect(count("All lists")).toBe(3);
    expect(count("Shared with me")).toBe(1);
    await goTo(user, "My Lists");
    expect(rowTitles()).toContain("Brand new");
    await goTo(user, "All lists");
    expect(rowTitles()).toContain("Brand new");
  });

  it("duplicating your own list puts the copy in My Lists and All lists", async () => {
    h.db.lists = [stored("Owned A"), shared("Shared C")];
    const user = userEvent.setup();
    mount("/app?view=myLists");
    await ready();
    await selectList(user, "Owned A");
    await openActions(user, /duplicate list/i);

    await waitFor(() => expect(count("My Lists")).toBe(2));
    expect(count("All lists")).toBe(3);
    await goTo(user, "My Lists");
    expect(rowTitles()).toContain("Owned A (copy)");
    await goTo(user, "All lists");
    expect(rowTitles()).toContain("Owned A (copy)");
    expect(h.db.lists.find((l) => l.title === "Owned A (copy)").owner_id).toBe(
      h.ME.id,
    );
  });

  it("duplicating a shared list creates a list you own (My Lists), and the original stays shared", async () => {
    h.db.lists = [shared("Shared C")];
    const user = userEvent.setup();
    mount("/app?view=shared");
    await ready();
    await selectList(user, "Shared C");
    await openActions(user, /duplicate list/i);
    await waitFor(() => expect(count("My Lists")).toBe(1));
    expect(count("Shared with me")).toBe(1);
    await goTo(user, "My Lists");
    expect(rowTitles()).toEqual(["Shared C (copy)"]);
  });

  it("archiving an owned list removes it from My Lists and shows it in Archived; restoring brings it back", async () => {
    h.db.lists = [stored("Owned A"), stored("Owned B"), shared("Shared C")];
    const user = userEvent.setup();
    mount("/app?view=myLists");
    await ready();
    await selectList(user, "Owned A");
    await openActions(user, /archive list/i);

    await waitFor(() => expect(count("My Lists")).toBe(1));
    expect(count("All lists")).toBe(2);
    expect(count("Archived")).toBe(1);
    expect(count("Shared with me")).toBe(1);
    expect(rowTitles()).toEqual(["Owned B"]);

    await goTo(user, "Archived");
    expect(rowTitles()).toEqual(["Owned A"]);
    await user.click(within(nav()).getByTitle("Owned A"));
    await user.click(await screen.findByRole("button", { name: /restore/i }));

    await waitFor(() => expect(count("My Lists")).toBe(2));
    expect(count("Archived")).toBe(0);
    expect(count("All lists")).toBe(3);
    await goTo(user, "My Lists");
    expect(rowTitles().sort()).toEqual(["Owned A", "Owned B"]);
  });

  it("archived shared lists appear in Archived (not My Lists, not Shared with me)", async () => {
    h.db.lists = [
      stored("Mine"),
      shared("Old shared", "viewer", { archived: true }),
    ];
    const user = userEvent.setup();
    mount();
    await ready();
    expect([
      count("My Lists"),
      count("Shared with me"),
      count("All lists"),
      count("Archived"),
    ]).toEqual([1, 0, 1, 1]);
    await goTo(user, "Archived");
    expect(rowTitles()).toEqual(["Old shared"]);
  });

  it("refreshing the app keeps the categorisation (and the selected view)", async () => {
    h.db.lists = [stored("Owned A"), shared("Shared C")];
    const user = userEvent.setup();
    const first = mount("/app?view=myLists");
    await ready();
    await user.click(
      within(nav()).getByRole("button", { name: /create new list/i }),
    );
    const dialog = await screen.findByRole("dialog", { name: /new list/i });
    await user.type(
      within(dialog).getByLabelText(/name/i),
      "Created before refresh",
    );
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    await waitFor(() => expect(count("My Lists")).toBe(2));
    await waitFor(() =>
      expect(h.db.lists.some((l) => l.title === "Created before refresh")).toBe(
        true,
      ),
    );
    first.unmount();

    mount("/app?view=myLists");
    await ready(); // "refresh": everything is reloaded from the backend
    await waitFor(() => expect(count("My Lists")).toBe(2));
    expect(count("Shared with me")).toBe(1);
    expect(count("All lists")).toBe(3);
    expect(navButton("My Lists")).toHaveAttribute("aria-current", "page");
    expect(rowTitles().sort()).toEqual(["Created before refresh", "Owned A"]);
  });

  it("shows a clear empty state when you own no non-archived lists", async () => {
    h.db.lists = [
      shared("Only shared"),
      stored("Archived mine", { archived: true }),
    ];
    const user = userEvent.setup();
    mount("/app?view=myLists");
    await ready();
    expect(count("My Lists")).toBe(0);
    expect(
      within(nav()).getByText("You haven’t created any lists yet."),
    ).toBeInTheDocument();
    expect(rowTitles()).toEqual([]);
    await goTo(user, "Favorites");
    expect(
      within(nav()).getByText("Nothing in favorites."),
    ).toBeInTheDocument(); // other empty states unchanged
  });

  it('keeps the first-run "make your first list" screen when there are no lists at all', async () => {
    mount("/app");
    await ready();
    expect(
      await screen.findByText(/make your first list/i),
    ).toBeInTheDocument();
    expect(within(nav()).getByText("No lists yet.")).toBeInTheDocument();
    expect([
      count("All lists"),
      count("My Lists"),
      count("Shared with me"),
    ]).toEqual([0, 0, 0]);
  });
});

describe("existing sidebar behaviour is unchanged", () => {
  it("Favorites, Recently updated, selection and header search still work", async () => {
    h.db.lists = [
      stored("Old one", { updated_at: "2026-01-02T00:00:00Z" }),
      stored("Fav owned", {
        favorite: true,
        updated_at: "2026-01-05T00:00:00Z",
      }),
      shared("Shared fav", "viewer", {
        favorite: true,
        updated_at: "2026-01-09T00:00:00Z",
      }),
    ];
    const user = userEvent.setup();
    mount();
    await ready();

    expect(count("Favorites")).toBe(2);
    await goTo(user, "Favorites");
    expect(rowTitles().sort()).toEqual(["Fav owned", "Shared fav"]);

    await goTo(user, "Recently updated");
    expect(rowTitles()).toEqual(["Shared fav", "Fav owned", "Old one"]); // newest first

    await selectList(user, "Old one"); // list selection
    await user.type(
      screen.getByRole("combobox", { name: /search lists and items/i }),
      "Shared",
    );
    await user.click(
      await screen.findByRole("option", { name: /shared fav/i }),
    ); // global search
    await waitFor(() =>
      expect(screen.getByLabelText("List title")).toHaveValue("Shared fav"),
    );
  });

  it("collapsing the sidebar keeps My Lists reachable (icon + accessible name) and re-expanding restores the count", async () => {
    h.db.lists = [stored("Owned A"), shared("Shared C")];
    const user = userEvent.setup();
    mount();
    await ready();
    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    await screen.findByRole("button", { name: /expand sidebar/i });

    const mine = within(nav()).getByRole("button", { name: "My Lists" }); // label is screen-reader-only when collapsed
    expect(mine.textContent.trim()).toBe("My Lists"); // no count shown in the slim sidebar
    await user.click(mine);
    await waitFor(() => expect(mine).toHaveAttribute("aria-current", "page"));

    await user.click(screen.getByRole("button", { name: /expand sidebar/i }));
    await screen.findByRole("button", { name: /collapse sidebar/i });
    expect(count("My Lists")).toBe(1);
    expect(count("All lists")).toBe(2);
  });
});
