import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// In-memory stand-in for Supabase. Like the real database, deleting a list also deletes the
// lists inside it, and a parent has to belong to the same owner.
const h = vi.hoisted(() => ({
  ME: { id: "me", email: "me@test.dev", name: "Me" },
  db: { lists: [] },
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
      updateItem: async () => {},
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
const toggle = (user, title, verb) =>
  user.click(
    within(nav()).getByRole("button", {
      name: new RegExp(`${verb} “${title}”`),
    }),
  );
const rowMenu = async (user, title, item) => {
  await user.click(
    within(nav()).getByRole("button", {
      name: new RegExp(`actions for “${title}”`, "i"),
    }),
  );
  await user.click(await screen.findByRole("menuitem", { name: item }));
};

beforeEach(() => {
  h.db.lists = [];
  localStorage.clear();
});

describe("sub-lists in the sidebar", () => {
  it("shows lists inside lists as a fold-out tree", async () => {
    h.db.lists = [
      stored("Home"),
      stored("Kitchen", "Home"),
      stored("Pantry", "Kitchen"),
      stored("Work"),
    ];
    const user = userEvent.setup();
    mount();
    await ready();
    expect(rowTitles()).toEqual(["Home", "Work"]);

    await toggle(user, "Home", "Expand");
    expect(rowTitles()).toEqual(["Home", "Kitchen", "Work"]);
    expect(
      within(nav()).getByRole("button", { name: /collapse “home”/i }),
    ).toHaveAttribute("aria-expanded", "true");

    await toggle(user, "Kitchen", "Expand");
    expect(rowTitles()).toEqual(["Home", "Kitchen", "Pantry", "Work"]);

    await toggle(user, "Home", "Collapse");
    expect(rowTitles()).toEqual(["Home", "Work"]);
  });

  it("opening a deep list unfolds the lists above it", async () => {
    h.db.lists = [
      stored("Home"),
      stored("Kitchen", "Home"),
      stored("Pantry", "Kitchen"),
    ];
    mount("/app/Pantry");
    await ready();
    await waitFor(() =>
      expect(rowTitles()).toEqual(["Home", "Kitchen", "Pantry"]),
    );
  });

  it("without sub-lists the sidebar looks exactly as before (no fold buttons)", async () => {
    h.db.lists = [stored("A"), stored("B")];
    mount();
    await ready();
    expect(within(nav()).queryByRole("button", { name: /expand/i })).toBeNull();
  });

  it("filter views stay flat: a sub-list shows on its own in Favorites", async () => {
    h.db.lists = [
      stored("Home"),
      stored("Kitchen", "Home", { favorite: true }),
    ];
    mount("/app?view=favorites");
    await ready();
    expect(rowTitles()).toEqual(["Kitchen"]);
  });

  it("a list shared with you whose parent you can't see sits at the top level", async () => {
    h.db.lists = [
      stored("Theirs", "hidden-parent", {
        owner_id: "someone-else",
        sharedRole: "editor",
      }),
    ];
    mount();
    await ready();
    expect(rowTitles()).toEqual(["Theirs"]);
  });
});

describe("creating and moving sub-lists", () => {
  it("New sub-list… creates a list inside the chosen list", async () => {
    h.db.lists = [stored("Home")];
    const user = userEvent.setup();
    mount();
    await ready();
    await rowMenu(user, "Home", /new sub-list/i);
    const dialog = await screen.findByRole("dialog", {
      name: /new sub-list in “home”/i,
    });
    await user.type(within(dialog).getByLabelText(/name/i), "Garage");
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    await waitFor(() =>
      expect(h.db.lists.find((l) => l.title === "Garage")?.parent_list_id).toBe(
        "Home",
      ),
    );
    // The new list is open, so the tree has unfolded to show it.
    await waitFor(() => expect(rowTitles()).toEqual(["Home", "Garage"]));
  });

  it("a normal New list after a sub-list is top level again", async () => {
    h.db.lists = [stored("Home")];
    const user = userEvent.setup();
    mount();
    await ready();
    await rowMenu(user, "Home", /new sub-list/i);
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /cancel/i,
      }),
    );
    await user.click(
      within(nav()).getByRole("button", { name: /create new list/i }),
    );
    const dialog = await screen.findByRole("dialog", { name: /^new list$/i });
    await user.type(within(dialog).getByLabelText(/name/i), "Plain");
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    await waitFor(() =>
      expect(h.db.lists.find((l) => l.title === "Plain")).toBeTruthy(),
    );
    expect(
      h.db.lists.find((l) => l.title === "Plain").parent_list_id ?? null,
    ).toBeNull();
  });

  it("Move to… puts a list inside another, and back to the top level", async () => {
    h.db.lists = [stored("Home"), stored("Loose")];
    const user = userEvent.setup();
    mount();
    await ready();
    await rowMenu(user, "Loose", /move to/i);
    const dialog = await screen.findByRole("dialog", { name: /move “loose”/i });
    // Not offered: the list itself.
    expect(within(dialog).queryByRole("button", { name: "Loose" })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Home" }));
    await waitFor(() =>
      expect(h.db.lists.find((l) => l.id === "Loose").parent_list_id).toBe(
        "Home",
      ),
    );
    await waitFor(() => expect(rowTitles()).toEqual(["Home"]));

    await toggle(user, "Home", "Expand");
    await rowMenu(user, "Loose", /move to/i);
    await user.click(await screen.findByRole("button", { name: /top level/i }));
    await waitFor(() =>
      expect(
        h.db.lists.find((l) => l.id === "Loose").parent_list_id,
      ).toBeNull(),
    );
  });

  it("can't offer a list's own sub-lists as a place to move it", async () => {
    h.db.lists = [stored("Home"), stored("Kitchen", "Home"), stored("Other")];
    const user = userEvent.setup();
    mount();
    await ready();
    await rowMenu(user, "Home", /move to/i);
    const dialog = await screen.findByRole("dialog", { name: /move “home”/i });
    const names = within(dialog)
      .getAllByRole("button")
      .map((b) => b.textContent.trim());
    expect(names).toContain("Other");
    expect(names).not.toContain("Kitchen");
    expect(names).not.toContain("Home");
  });

  it("duplicating a sub-list puts the copy next to it", async () => {
    h.db.lists = [stored("Home"), stored("Kitchen", "Home")];
    const user = userEvent.setup();
    mount("/app/Kitchen");
    await ready();
    await user.click(
      await screen.findByRole("button", { name: /list actions/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /duplicate list/i }),
    );
    await waitFor(() =>
      expect(
        h.db.lists.find((l) => l.title === "Kitchen (copy)")?.parent_list_id,
      ).toBe("Home"),
    );
  });
});

describe("archiving and deleting lists that have sub-lists", () => {
  const tree = () => [
    stored("Home"),
    stored("Kitchen", "Home"),
    stored("Pantry", "Kitchen"),
    stored("Work"),
  ];

  it("archiving a parent asks first, names the count, and takes the sub-lists along", async () => {
    h.db.lists = tree();
    const user = userEvent.setup();
    mount();
    await ready();
    await rowMenu(user, "Home", /archive list/i);
    const dialog = await screen.findByRole("dialog", {
      name: /archive “home”/i,
    });
    expect(dialog).toHaveTextContent("2 sub-lists");
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(
        h.db.lists
          .filter((l) => l.archived)
          .map((l) => l.id)
          .sort(),
      ).toEqual(["Home", "Kitchen", "Pantry"]),
    );
    expect(rowTitles()).toEqual(["Work"]);
  });

  it("Undo brings every list back as it was", async () => {
    h.db.lists = [
      ...tree().slice(0, 3),
      stored("Work", null, { archived: true }),
    ];
    const user = userEvent.setup();
    mount();
    await ready();
    await rowMenu(user, "Home", /archive list/i);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(h.db.lists.find((l) => l.id === "Pantry").archived).toBe(true),
    );
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(h.db.lists.filter((l) => l.archived).map((l) => l.id)).toEqual([
        "Work",
      ]),
    );
  });

  it("archiving a list with no sub-lists doesn't ask", async () => {
    h.db.lists = tree();
    const user = userEvent.setup();
    mount();
    await ready();
    await rowMenu(user, "Work", /archive list/i);
    await waitFor(() =>
      expect(h.db.lists.find((l) => l.id === "Work").archived).toBe(true),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("restoring a parent from Archived restores its sub-lists too", async () => {
    h.db.lists = [
      stored("Home", null, { archived: true }),
      stored("Kitchen", "Home", { archived: true }),
    ];
    const user = userEvent.setup();
    mount("/app/Home?view=archived");
    await ready();
    await user.click(await screen.findByRole("button", { name: /restore/i }));
    await waitFor(() =>
      expect(h.db.lists.every((l) => !l.archived)).toBe(true),
    );
  });

  it("deleting a parent names what goes with it, and removes it all", async () => {
    h.db.lists = tree();
    const user = userEvent.setup();
    mount("/app/Pantry");
    await ready();
    await rowMenu(user, "Home", /delete list/i);
    const dialog = await screen.findByRole("dialog", {
      name: /delete “home”/i,
    });
    expect(dialog).toHaveTextContent("2 sub-lists");
    expect(dialog).toHaveTextContent("6 items"); // 3 lists x 2 items
    await user.click(
      within(dialog).getByRole("button", { name: /delete list/i }),
    );
    await waitFor(() => expect(h.db.lists.map((l) => l.id)).toEqual(["Work"]));
    expect(rowTitles()).toEqual(["Work"]);
    // We were looking at a list inside the deleted one, so we're back at the home screen.
    await waitFor(() =>
      expect(screen.queryByLabelText("List title")).toBeNull(),
    );
  });

  it("deleting a plain list keeps the old wording", async () => {
    h.db.lists = tree();
    const user = userEvent.setup();
    mount();
    await ready();
    await rowMenu(user, "Work", /delete list/i);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(
      "permanently deletes the list and its 2 items",
    );
    expect(dialog).not.toHaveTextContent("sub-list");
  });
});
