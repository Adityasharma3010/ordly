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
import {
  addDays,
  addMonths,
  longDay,
  monthLabel,
  parseDay,
  shortDay,
} from "../src/utils/calendar";

const openList = (id, q = "") => mount(`/app/${id}${q}`);
const dialogByName = (name) => screen.findByRole("dialog", { name });
const openNewList = async (user) => {
  await user.click(
    within(nav()).getByRole("button", { name: /create new list/i }),
  );
  return dialogByName(/^new list$/i);
};
const openMore = (user, dialog) =>
  user.click(within(dialog).getByRole("button", { name: /more options/i }));

beforeEach(() => {
  h.db.lists = [];
  h.db.patches = [];
  localStorage.clear();
});

describe("the New list dialog", () => {
  it("starts simple: name, type and templates; the rest is folded away", async () => {
    h.db.lists = [stored("Other")];
    const user = userEvent.setup();
    mount();
    await ready();
    const dialog = await openNewList(user);
    expect(within(dialog).getByLabelText("Name")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /^checklist$/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(dialog).getByRole("button", { name: "Blank list" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(dialog).getByRole("button", { name: /more options/i }),
    ).toHaveAttribute("aria-expanded", "false");
    // Folded-away fields can't be reached until the section is opened.
    expect(within(dialog).getByLabelText("Description")).not.toBeVisible();
    await openMore(user, dialog);
    expect(within(dialog).getByLabelText("Description")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: /^due date/i }),
    ).toBeVisible();
  });

  it("can't make the dialog scroll sideways: its sections are allowed to shrink", async () => {
    h.db.lists = [stored("Other")];
    const user = userEvent.setup();
    mount();
    await ready();
    const dialog = await openNewList(user);
    // A <fieldset> won't shrink below its content unless told to, and the row of template
    // chips is wide, so this is what keeps it from pushing the whole dialog sideways.
    for (const name of ["Start from", "Type"]) {
      const legend = within(dialog).getByText(name, { selector: "legend" });
      expect(legend.closest("fieldset")).toHaveClass("min-w-0");
    }
  });

  it("an empty name is refused with a clear message", async () => {
    h.db.lists = [stored("Other")];
    const user = userEvent.setup();
    mount();
    await ready();
    const dialog = await openNewList(user);
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /give your list a name/i,
    );
    expect(h.db.lists).toHaveLength(1);
  });

  it("shows what is set inside More options while it is folded", async () => {
    h.db.lists = [stored("Other")];
    const user = userEvent.setup();
    mount();
    await ready();
    const dialog = await openNewList(user);
    await openMore(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "High" }));
    await user.type(within(dialog).getByLabelText("Tags"), "trip{Enter}");
    await openMore(user, dialog);
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: /more options/i }),
      ).toHaveTextContent("High priority · 1 tag"),
    );
  });

  it("picking a template fills the name and creates the list with its items", async () => {
    h.db.lists = [stored("Other")];
    const user = userEvent.setup();
    mount();
    await ready();
    const dialog = await openNewList(user);
    await user.click(
      within(dialog).getByRole("button", { name: /groceries/i }),
    );
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Groceries");
    expect(dialog).toHaveTextContent(/comes with \d+ items/i);
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    await waitFor(() => {
      const made = h.db.lists.find((l) => l.title === "Groceries");
      expect(made).toBeTruthy();
      expect(made.items.length).toBeGreaterThan(5);
      expect(made.icon).toBe("🛒");
    });
  });

  it("a name you typed wins over the template's, and Blank undoes a template", async () => {
    h.db.lists = [stored("Other")];
    const user = userEvent.setup();
    mount();
    await ready();
    const dialog = await openNewList(user);
    await user.click(
      within(dialog).getByRole("button", { name: /packing list/i }),
    );
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Packing list");
    await user.click(
      within(dialog).getByRole("button", { name: "Blank list" }),
    );
    expect(within(dialog).getByLabelText("Name")).toHaveValue("");
    await user.type(within(dialog).getByLabelText("Name"), "Goa trip");
    await user.click(
      within(dialog).getByRole("button", { name: /packing list/i }),
    );
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Goa trip");
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    await waitFor(() => {
      const made = h.db.lists.find((l) => l.title === "Goa trip");
      expect(made?.items.length).toBeGreaterThan(3);
    });
  });

  it("a template can be made a Notes list (plain-text items)", async () => {
    h.db.lists = [stored("Other")];
    const user = userEvent.setup();
    mount();
    await ready();
    const dialog = await openNewList(user);
    await user.click(
      within(dialog).getByRole("button", { name: /groceries/i }),
    );
    await user.click(within(dialog).getByRole("button", { name: /^notes$/i }));
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    await waitFor(() => {
      const made = h.db.lists.find((l) => l.title === "Groceries");
      expect(made.list_type).toBe("notes");
      expect(made.items.every((i) => i.has_checkbox === false)).toBe(true);
    });
  });

  it("the icon and colour live behind the tile", async () => {
    h.db.lists = [stored("Other")];
    const user = userEvent.setup();
    mount();
    await ready();
    const dialog = await openNewList(user);
    expect(
      within(dialog).queryByRole("button", { name: /use 🏠 icon/i }),
    ).toBeNull();
    await user.click(
      within(dialog).getByRole("button", { name: /change icon and colour/i }),
    );
    await user.click(
      await within(dialog).findByRole("button", { name: /use 🏠 icon/i }),
    );
    await user.type(within(dialog).getByLabelText("Name"), "Home stuff");
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    await waitFor(() =>
      expect(h.db.lists.find((l) => l.title === "Home stuff")?.icon).toBe("🏠"),
    );
  });

  it("Edit details has no template row and opens More options when something is set", async () => {
    h.db.lists = [stored("Steps", null, { priority: 2 })];
    const user = userEvent.setup();
    openList("Steps");
    await ready();
    await user.click(
      await screen.findByRole("button", { name: /list actions/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /edit details/i }),
    );
    const dialog = await dialogByName(/edit list details/i);
    expect(within(dialog).queryByText("Start from")).toBeNull();
    expect(
      within(dialog).getByRole("button", { name: /more options/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(dialog).getByRole("button", { name: "Medium" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

describe("the date and time pickers", () => {
  const open = async (user) => {
    h.db.lists = [stored("Other")];
    mount();
    await ready();
    const dialog = await openNewList(user);
    await openMore(user, dialog);
    return dialog;
  };
  const calendar = () => screen.findByRole("dialog", { name: "Choose a date" });
  const clock = () => screen.findByRole("dialog", { name: "Choose a time" });

  it("picks a day from the calendar and shows it on the button", async () => {
    const user = userEvent.setup();
    const dialog = await open(user);
    const trigger = within(dialog).getByRole("button", { name: /^due date/i });
    expect(trigger).toHaveTextContent("Pick a date");
    await user.click(trigger);
    const cal = await calendar();
    const target = addDays(dayKey(), 1);
    await user.click(
      within(cal).getByRole("button", { name: longDay(target) }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Choose a date" }),
      ).toBeNull(),
    );
    expect(trigger).toHaveTextContent(shortDay(target));
  });

  it("works from the keyboard: arrows move, Enter picks", async () => {
    const user = userEvent.setup();
    const dialog = await open(user);
    await user.click(
      within(dialog).getByRole("button", { name: /^due date/i }),
    );
    const cal = await calendar();
    const today = dayKey();
    await waitFor(() =>
      expect(
        within(cal).getByRole("button", { name: longDay(today) }),
      ).toHaveFocus(),
    );
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(
        within(cal).getByRole("button", { name: longDay(addDays(today, 1)) }),
      ).toHaveFocus(),
    );
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(
        within(cal).getByRole("button", { name: longDay(addDays(today, 8)) }),
      ).toHaveFocus(),
    );
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Choose a date" }),
      ).toBeNull(),
    );
    expect(
      within(dialog).getByRole("button", { name: /^due date/i }),
    ).toHaveTextContent(shortDay(addDays(today, 8)));
  });

  it("moves between months, and PageDown works too", async () => {
    const user = userEvent.setup();
    const dialog = await open(user);
    await user.click(
      within(dialog).getByRole("button", { name: /^due date/i }),
    );
    const cal = await calendar();
    const label = (k) => monthLabel(...Object.values(parseDay(k)).slice(0, 2));
    const here = dayKey();
    expect(within(cal).getByText(label(here))).toBeInTheDocument();
    await user.click(within(cal).getByRole("button", { name: "Next month" }));
    expect(
      within(cal).getByText(label(addMonths(here, 1))),
    ).toBeInTheDocument();
    await user.keyboard("{PageDown}");
    await waitFor(() =>
      expect(
        within(cal).getByText(label(addMonths(here, 2))),
      ).toBeInTheDocument(),
    );
    await user.click(
      within(cal).getByRole("button", { name: "Previous month" }),
    );
    expect(
      within(cal).getByText(label(addMonths(here, 1))),
    ).toBeInTheDocument();
  });

  it("Today and Clear buttons", async () => {
    const user = userEvent.setup();
    const dialog = await open(user);
    const trigger = within(dialog).getByRole("button", { name: /^due date/i });
    await user.click(trigger);
    await user.click(
      within(await calendar()).getByRole("button", { name: "Today" }),
    );
    await waitFor(() => expect(trigger).toHaveTextContent(shortDay(dayKey())));
    await user.click(trigger);
    await user.click(
      within(await calendar()).getByRole("button", { name: "Clear" }),
    );
    await waitFor(() => expect(trigger).toHaveTextContent("Pick a date"));
  });

  it("Escape closes only the picker, not the dialog around it", async () => {
    const user = userEvent.setup();
    const dialog = await open(user);
    await user.click(
      within(dialog).getByRole("button", { name: /^due date/i }),
    );
    await calendar();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Choose a date" }),
      ).toBeNull(),
    );
    expect(
      screen.getByRole("dialog", { name: /^new list$/i }),
    ).toBeInTheDocument();
    // …and focus went back to the button that opened it.
    expect(
      within(dialog).getByRole("button", { name: /^due date/i }),
    ).toHaveFocus();
  });

  it("the time button is off until there is a date, then picks hour, minute and AM/PM", async () => {
    const user = userEvent.setup();
    const dialog = await open(user);
    const time = within(dialog).getByRole("button", { name: /time/i });
    expect(time).toBeDisabled();
    await user.click(
      within(dialog).getByRole("button", { name: /^due date/i }),
    );
    await user.click(
      within(await calendar()).getByRole("button", { name: "Today" }),
    );
    await waitFor(() => expect(time).toBeEnabled());
    expect(time).toHaveTextContent("Add a time");
    await user.click(time);
    const clk = await clock();
    await user.click(
      within(within(clk).getByRole("listbox", { name: "Hour" })).getByRole(
        "option",
        { name: "3" },
      ),
    );
    await user.click(
      within(within(clk).getByRole("listbox", { name: "Minute" })).getByRole(
        "option",
        { name: "05" },
      ),
    );
    await user.click(
      within(within(clk).getByRole("listbox", { name: "AM or PM" })).getByRole(
        "option",
        { name: "PM" },
      ),
    );
    expect(time).toHaveTextContent("3:05 PM");
    await user.click(within(clk).getByRole("button", { name: /noon/i }));
    expect(time).toHaveTextContent("12:00 PM");
    await user.click(within(clk).getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Choose a time" }),
      ).toBeNull(),
    );
  });

  it("clearing the date also clears the time", async () => {
    const user = userEvent.setup();
    const dialog = await open(user);
    await user.click(
      within(dialog).getByRole("button", { name: /^due date/i }),
    );
    await user.click(
      within(await calendar()).getByRole("button", { name: "Today" }),
    );
    const time = within(dialog).getByRole("button", { name: /time/i });
    await waitFor(() => expect(time).toBeEnabled());
    await user.click(time);
    await user.click(
      within(await clock()).getByRole("button", { name: /evening/i }),
    );
    expect(time).toHaveTextContent("6:00 PM");
    await user.click(
      within(await clock()).getByRole("button", { name: "Done" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: /clear due date/i }),
    );
    await waitFor(() => expect(time).toBeDisabled());
    expect(time).toHaveTextContent("Add a time");
  });

  it("saves the chosen date and time on the new list", async () => {
    const user = userEvent.setup();
    const dialog = await open(user);
    await user.type(within(dialog).getByLabelText("Name"), "Deadline");
    await user.click(
      within(dialog).getByRole("button", { name: /^due date/i }),
    );
    await user.click(
      within(await calendar()).getByRole("button", { name: "Today" }),
    );
    const time = within(dialog).getByRole("button", { name: /time/i });
    await waitFor(() => expect(time).toBeEnabled());
    await user.click(time);
    await user.click(
      within(await clock()).getByRole("button", { name: /morning/i }),
    );
    await user.click(
      within(await clock()).getByRole("button", { name: "Done" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    await waitFor(() => {
      const made = h.db.lists.find((l) => l.title === "Deadline");
      expect(made.due_date).toBe(dayKey());
      expect(made.due_time).toBe("09:00");
    });
  });
});

describe("adding items from a template to an existing list", () => {
  const addFromMenu = async (user) => {
    await user.click(
      await screen.findByRole("button", { name: /list actions/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", {
        name: /add items from a template/i,
      }),
    );
    return dialogByName(/add items from a template/i);
  };

  it("appends the template's items to the end and leaves the list's own settings alone", async () => {
    h.db.lists = [stored("Trip", null, { icon: "✈️", color: "sky" })];
    const user = userEvent.setup();
    openList("Trip");
    await ready();
    const picker = await addFromMenu(user);
    expect(picker).toHaveTextContent("“Trip”");
    await user.click(
      within(picker).getByRole("button", { name: /groceries/i }),
    );
    await waitFor(() => expect(h.db.lists[0].items.length).toBeGreaterThan(5));
    const list = h.db.lists[0];
    expect(list.title).toBe("Trip");
    expect(list.icon).toBe("✈️");
    // The two original tasks stay first; everything added comes after them.
    const top = list.items
      .filter((i) => !i.parent_id)
      .sort((a, b) => a.position - b.position);
    expect(top.slice(0, 2).map((i) => i.text)).toEqual(["task 1", "task 2"]);
    expect(top.length).toBeGreaterThan(2);
    expect(new Set(list.items.map((i) => i.id)).size).toBe(list.items.length);
    expect(
      await screen.findByText(/added \d+ items from “groceries”/i),
    ).toBeInTheDocument();
  });

  it("Undo takes the added items out again", async () => {
    h.db.lists = [stored("Trip")];
    const user = userEvent.setup();
    openList("Trip");
    await ready();
    const picker = await addFromMenu(user);
    await user.click(
      within(picker).getByRole("button", { name: /groceries/i }),
    );
    await waitFor(() => expect(h.db.lists[0].items.length).toBeGreaterThan(2));
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(h.db.lists[0].items.map((i) => i.id)).toEqual([
        "Trip-item-1",
        "Trip-item-2",
      ]),
    );
  });

  it("a Notes list gets plain-text items", async () => {
    h.db.lists = [stored("Ideas", null, { list_type: "notes" })];
    const user = userEvent.setup();
    openList("Ideas");
    await ready();
    const picker = await addFromMenu(user);
    await user.click(within(picker).getByRole("button", { name: /weekend/i }));
    await waitFor(() => expect(h.db.lists[0].items.length).toBeGreaterThan(2));
    const added = h.db.lists[0].items.filter(
      (i) => !i.id.startsWith("Ideas-item"),
    );
    expect(added.every((i) => i.has_checkbox === false)).toBe(true);
  });

  it("someone who can only view the list can't use it", async () => {
    h.db.lists = [
      stored("Theirs", null, {
        owner_id: "someone-else",
        sharedRole: "viewer",
      }),
    ];
    const user = userEvent.setup();
    openList("Theirs");
    await ready();
    await user.click(
      await screen.findByRole("button", { name: /list actions/i }),
    );
    expect(
      await screen.findByRole("menuitem", {
        name: /add items from a template/i,
      }),
    ).toBeDisabled();
  });
});
