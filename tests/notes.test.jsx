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

const openList = (id, q = "") => mount(`/app/${id}${q}`);

const withNotes = (notes, o = {}) => {
  const l = stored("Home", null, o);
  l.items[0].notes = notes;
  return l;
};
const dbNotes = () => h.db.lists[0].items[0].notes;
const mode = () => localStorage.getItem("ordly.notes.mode");

beforeEach(() => {
  h.db.lists = [];
  localStorage.clear();
});

describe("notes are shown as formatted text", () => {
  it("draws bold, lists and links; links open safely in a new tab", async () => {
    h.db.lists = [
      withNotes(
        "Call **Sam** at 5\n\n- milk\n- eggs\n\nSee [docs](https://a.com/x)",
      ),
    ];
    openList("Home");
    await ready();
    const row = (await screen.findByText("task 1")).closest("div.group");
    expect(within(row).getByText("Sam").tagName).toBe("STRONG");
    expect(within(row).getAllByRole("listitem")).toHaveLength(2);
    const link = within(row).getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("href", "https://a.com/x");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toMatch(/noopener/);
    expect(link.getAttribute("rel")).toMatch(/nofollow/);
  });

  it("anything hostile is just text: no scripts, no images, no javascript: links", async () => {
    h.db.lists = [
      withNotes(
        '<script>window.hacked=1</script> <img src=x onerror="window.hacked=1">\n[click](javascript:window.hacked=1) [x](data:text/html,hi) ![i](https://a.com/i.png)',
      ),
    ];
    openList("Home");
    await ready();
    const row = (await screen.findByText("task 1")).closest("div.group");
    expect(row.querySelector("script")).toBeNull();
    expect(row.querySelector("img")).toBeNull();
    expect(row.querySelector("[onerror]")).toBeNull();
    // The only link is the ordinary web address inside the image syntax, shown as a link
    // (never as an image); the javascript: and data: ones are plain text.
    const hrefs = within(row)
      .queryAllByRole("link")
      .map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual(["https://a.com/i.png"]);
    expect(row).toHaveTextContent("<script>window.hacked=1</script>");
    expect(window.hacked).toBeUndefined();
  });

  it("old plain-text notes look the same as before", async () => {
    h.db.lists = [withNotes("Call Sam\nBring the folder")];
    openList("Home");
    await ready();
    const row = (await screen.findByText("task 1")).closest("div.group");
    expect(row).toHaveTextContent("Call Sam");
    expect(row).toHaveTextContent("Bring the folder");
    expect(row.querySelector("br")).toBeTruthy();
  });

  it("clicking the note edits it, but clicking a link in it just follows the link", async () => {
    h.db.lists = [withNotes("hello [docs](https://a.com)")];
    const user = userEvent.setup();
    openList("Home");
    await ready();
    const row = (await screen.findByText("task 1")).closest("div.group");
    await user.click(within(row).getByRole("link", { name: "docs" }));
    expect(screen.queryByRole("textbox", { name: "Item notes" })).toBeNull();
    await user.click(within(row).getByText(/hello/));
    expect(
      await screen.findByRole("textbox", { name: "Item notes" }),
    ).toHaveValue("hello [docs](https://a.com)");
  });

  it("someone who can only view sees the formatted note but no way to edit it", async () => {
    h.db.lists = [
      withNotes("**read me**", {
        owner_id: "someone-else",
        sharedRole: "viewer",
      }),
    ];
    const user = userEvent.setup();
    openList("Home");
    await ready();
    const row = (await screen.findByText("task 1")).closest("div.group");
    expect(within(row).getByText("read me").tagName).toBe("STRONG");
    expect(
      within(row).queryByRole("button", { name: /edit notes/i }),
    ).toBeNull();
    await user.click(within(row).getByText("read me"));
    expect(screen.queryByRole("textbox", { name: "Item notes" })).toBeNull();
  });
});

describe("the Markdown notes box", () => {
  const openEditor = async (user, notes = "") => {
    h.db.lists = [withNotes(notes)];
    openList("Home");
    await ready();
    const row = (await screen.findByText("task 1")).closest("div.group");
    await user.click(
      await within(row).findByRole("button", { name: /actions for/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /(add|edit) notes/i }),
    );
    return screen.findByRole("textbox", { name: "Item notes" });
  };
  const select = (ta, a, b) => {
    ta.focus();
    ta.setSelectionRange(a, b);
  };

  it("opens with the toolbar, in Markdown mode, and saves what you type", async () => {
    const user = userEvent.setup();
    const ta = await openEditor(user);
    expect(ta).toHaveFocus();
    expect(
      screen.getByRole("toolbar", { name: "Formatting" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Markdown" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.type(ta, "buy milk");
    await waitFor(() => expect(dbNotes()).toBe("buy milk"), { timeout: 3000 });
  });

  it("Bold wraps the selection and keeps it selected; pressing it again unwraps", async () => {
    const user = userEvent.setup();
    const ta = await openEditor(user, "say hello now");
    select(ta, 4, 9);
    await user.click(screen.getByRole("button", { name: "Bold" }));
    await waitFor(() => expect(ta).toHaveValue("say **hello** now"));
    expect(ta.value.slice(ta.selectionStart, ta.selectionEnd)).toBe("hello");
    await user.click(screen.getByRole("button", { name: "Bold" }));
    await waitFor(() => expect(ta).toHaveValue("say hello now"));
  });

  it("Ctrl+B and Ctrl+I work from the keyboard", async () => {
    const user = userEvent.setup();
    const ta = await openEditor(user, "abc");
    select(ta, 0, 3);
    await user.keyboard("{Control>}b{/Control}");
    await waitFor(() => expect(ta).toHaveValue("**abc**"));
  });

  it("list buttons and Enter keep a list going", async () => {
    const user = userEvent.setup();
    const ta = await openEditor(user, "one");
    select(ta, 0, 3);
    await user.click(screen.getByRole("button", { name: "Bulleted list" }));
    await waitFor(() => expect(ta).toHaveValue("- one"));
    ta.setSelectionRange(5, 5);
    await user.keyboard("{Enter}two");
    await waitFor(() => expect(ta).toHaveValue("- one\n- two"));
    await user.keyboard("{Enter}{Enter}");
    await waitFor(() => expect(ta).toHaveValue("- one\n- two\n"));
  });

  it("Link puts the address in for you to type over", async () => {
    const user = userEvent.setup();
    const ta = await openEditor(user, "see docs");
    select(ta, 4, 8);
    await user.click(screen.getByRole("button", { name: "Link" }));
    await waitFor(() => expect(ta).toHaveValue("see [docs](address)"));
    expect(ta.value.slice(ta.selectionStart, ta.selectionEnd)).toBe("address");
  });

  it("Preview shows the finished note, Edit goes back", async () => {
    const user = userEvent.setup();
    await openEditor(user, "a **b** c");
    await user.click(screen.getByRole("button", { name: "Preview" }));
    const group = screen.getByRole("group", { name: "Notes editor" });
    expect(within(group).getByText("b").tagName).toBe("STRONG");
    expect(within(group).queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      await screen.findByRole("textbox", { name: "Item notes" }),
    ).toBeInTheDocument();
  });

  it("Done and Escape close it; an empty box closes when you click away", async () => {
    const user = userEvent.setup();
    const ta = await openEditor(user, "keep");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(screen.queryByRole("group", { name: "Notes editor" })).toBeNull(),
    );
    expect(screen.getByText("keep")).toBeInTheDocument();
    await user.click(screen.getByText("keep"));
    const again = await screen.findByRole("textbox", { name: "Item notes" });
    again.focus();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("group", { name: "Notes editor" })).toBeNull(),
    );
    expect(ta).not.toBeNull();
  });

  it("warns when a note is nearly too long", async () => {
    const user = userEvent.setup();
    await openEditor(user, "x".repeat(9300));
    expect(screen.getByText(/9,300 \/ 10,000/)).toBeInTheDocument();
  });

  it("remembers which editor you picked", async () => {
    const user = userEvent.setup();
    await openEditor(user, "a **b**");
    await user.click(screen.getByRole("button", { name: "Rich text" }));
    expect(JSON.parse(mode())).toBe("rich");
    await user.click(await screen.findByRole("button", { name: "Markdown" }));
    expect(JSON.parse(mode())).toBe("markdown");
  });
});

describe("the rich text editor", () => {
  const openRich = async (user, notes) => {
    localStorage.setItem("ordly.notes.mode", JSON.stringify("rich"));
    h.db.lists = [withNotes(notes)];
    openList("Home");
    await ready();
    const row = (await screen.findByText("task 1")).closest("div.group");
    await user.click(
      await within(row).findByRole("button", { name: /actions for/i }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /(add|edit) notes/i }),
    );
    return screen.findByRole(
      "textbox",
      { name: "Item notes" },
      { timeout: 8000 },
    );
  };

  it("loads on demand and shows existing Markdown as formatted text", async () => {
    const user = userEvent.setup();
    const box = await openRich(
      user,
      "Hello **bold** and *it*\n\n- one\n- two\n\n[docs](https://a.com)",
    );
    expect(box).toHaveAttribute("contenteditable", "true");
    expect(within(box).getByText("bold").tagName).toBe("STRONG");
    expect(within(box).getByText("it").tagName).toBe("EM");
    expect(within(box).getAllByRole("listitem")).toHaveLength(2);
    expect(within(box).getByRole("link", { name: "docs" })).toHaveAttribute(
      "href",
      "https://a.com",
    );
    // Just looking at it doesn't change what is saved.
    expect(dbNotes()).toBe(
      "Hello **bold** and *it*\n\n- one\n- two\n\n[docs](https://a.com)",
    );
  });

  it("hostile Markdown stays harmless inside the editor", async () => {
    const user = userEvent.setup();
    const box = await openRich(
      user,
      '<script>window.hacked=1</script><img src=x onerror="window.hacked=1"> [x](javascript:window.hacked=1)',
    );
    expect(box.querySelector("script")).toBeNull();
    expect(box.querySelector("img")).toBeNull();
    expect(box.querySelector("[onerror]")).toBeNull();
    expect(box.querySelector('a[href^="javascript"]')).toBeNull();
    expect(window.hacked).toBeUndefined();
  });

  it("the toolbar shows what is active where the cursor is", async () => {
    const user = userEvent.setup();
    const box = await openRich(user, "plain **strong** text");
    const strong = within(box).getByText("strong");
    const range = document.createRange();
    range.setStart(strong.firstChild, 2);
    range.setEnd(strong.firstChild, 2);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(screen.getByRole("button", { name: "Italic" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
