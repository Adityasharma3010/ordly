import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../src/contexts/ToastContext";
import { ShareModal } from "../src/components/sharing/ShareModal";

// ---- In-memory stand-in for the sharing half of the backend ----------------------------
const h = vi.hoisted(() => ({
  db: { share: null, people: [], invites: [] },
  calls: [],
}));

vi.mock("../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me", email: "me@test.dev", name: "Me" } }),
}));

vi.mock("../src/services/api", () => {
  const log = (name, ...args) => h.calls.push([name, ...args]);
  return {
    backendMode: "supabase",
    api: {
      capabilities: { auth: true, sharing: true, realtime: false },
      listShares: async () => (h.db.share ? [{ ...h.db.share }] : []),
      collaborators: async () => h.db.people.map((p) => ({ ...p })),
      invites: async () => h.db.invites.map((i) => ({ ...i })),
      createShare: async (listId, permission, expiresAt = null) => {
        log("createShare", listId, permission, expiresAt);
        h.db.share = {
          id: "s1",
          token: "tok123",
          permission,
          expires_at: expiresAt,
        };
      },
      setSharePermission: async (id, permission) => {
        log("setSharePermission", id, permission);
        h.db.share.permission = permission;
      },
      setShareExpiry: async (id, expiresAt) => {
        log("setShareExpiry", id, expiresAt);
        h.db.share.expires_at = expiresAt;
      },
      revokeShare: async (id) => {
        log("revokeShare", id);
        h.db.share = null;
        h.db.people = h.db.people.filter((p) => !p.via_link);
      },
      inviteByEmail: async (listId, email, role) => {
        log("inviteByEmail", listId, email, role);
        const found = h.db.invites.find((i) => i.email === email);
        if (found) found.role = role;
        else
          h.db.invites.push({ id: `i${h.db.invites.length + 1}`, email, role });
      },
      removeInvite: async (id) => {
        log("removeInvite", id);
        h.db.invites = h.db.invites.filter((i) => i.id !== id);
      },
      setMemberRole: async (listId, userId, role) => {
        log("setMemberRole", listId, userId, role);
        const p = h.db.people.find((x) => x.user_id === userId);
        p.role = role;
        p.via_link = false;
      },
      removeMember: async (listId, userId) => {
        log("removeMember", listId, userId);
        h.db.people = h.db.people.filter((p) => p.user_id !== userId);
      },
    },
  };
});

const list = { id: "L1", title: "Groceries" };
const person = (over = {}) => ({
  user_id: "u1",
  display_name: "Priya",
  role: "viewer",
  via_link: false,
  ...over,
});
// The app's own dropdown (not a native <select>): click it, then click the option.
const choose = async (user, name, option) => {
  await user.click(screen.getByRole("combobox", { name }));
  await user.click(await screen.findByRole("option", { name: option }));
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
};
const onClose = vi.fn();
const called = (name) => h.calls.filter(([n]) => n === name);

const mount = async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <ShareModal open list={list} onClose={onClose} />
    </ToastProvider>,
  );
  await screen.findByText("People with access");
  // The modal moves focus to its first control ~30 ms after opening; wait for that so it
  // can't steal focus from an input in the middle of a test.
  await waitFor(() =>
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement),
  );
  return user;
};

beforeEach(() => {
  onClose.mockClear();
  h.db = { share: null, people: [], invites: [] };
  h.calls = [];
});

describe("ShareModal: general access (one link, Google Docs style)", () => {
  it("starts Restricted with no link, then turning it on creates a view link", async () => {
    const user = await mount();
    const access = screen.getByRole("combobox", { name: "General access" });
    expect(access).toHaveTextContent("Restricted");
    expect(screen.queryByLabelText("Share link")).not.toBeInTheDocument();

    await choose(user, "General access", "Anyone with the link");

    expect(await screen.findByLabelText("Share link")).toHaveValue(
      `${window.location.origin}/s/tok123`,
    );
    expect(called("createShare")).toEqual([
      ["createShare", "L1", "view", null],
    ]);
    expect(
      screen.getByRole("combobox", {
        name: /what people with the link can do/i,
      }),
    ).toHaveTextContent("Viewer");
    expect(screen.getByText(/no account needed/i)).toBeInTheDocument();
  });

  it("switches the same link between Viewer and Editor without making a second link", async () => {
    h.db.share = {
      id: "s1",
      token: "tok123",
      permission: "view",
      expires_at: null,
    };
    const user = await mount();
    await choose(user, /what people with the link can do/i, "Editor");

    await waitFor(() =>
      expect(
        screen.getByText(/anyone with the link can edit/i),
      ).toBeInTheDocument(),
    );
    expect(called("setSharePermission")).toEqual([
      ["setSharePermission", "s1", "edit"],
    ]);
    expect(called("createShare")).toHaveLength(0);
    expect(screen.getByLabelText("Share link")).toHaveValue(
      `${window.location.origin}/s/tok123`,
    );
  });

  it("sets and clears link expiry", async () => {
    h.db.share = {
      id: "s1",
      token: "tok123",
      permission: "view",
      expires_at: null,
    };
    const user = await mount();
    const before = Date.now();
    await choose(user, "Link expiry", "In 7 days");

    await waitFor(() => expect(called("setShareExpiry")).toHaveLength(1));
    const sent = new Date(called("setShareExpiry")[0][2]).getTime();
    expect(sent - before).toBeGreaterThan(6.9 * 86400000);
    expect(sent - before).toBeLessThan(7.1 * 86400000);

    await choose(user, "Link expiry", "Never expires");
    await waitFor(() => expect(called("setShareExpiry")).toHaveLength(2));
    expect(called("setShareExpiry")[1]).toEqual(["setShareExpiry", "s1", null]);
  });

  it("warns when the link has expired and lets the owner renew it", async () => {
    h.db.share = {
      id: "s1",
      token: "tok123",
      permission: "edit",
      expires_at: new Date(Date.now() - 3600000).toISOString(),
    };
    const user = await mount();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /this link has expired/i,
    );

    await choose(user, "Link expiry", "In 30 days");
    await waitFor(() =>
      expect(
        screen.queryByText(/this link has expired/i),
      ).not.toBeInTheDocument(),
    );
  });

  it("turns the link off straight away when nobody joined through it", async () => {
    h.db.share = {
      id: "s1",
      token: "tok123",
      permission: "view",
      expires_at: null,
    };
    h.db.people = [person({ via_link: false })];
    const user = await mount();
    await choose(user, "General access", "Restricted");

    await waitFor(() => expect(called("revokeShare")).toHaveLength(1));
    expect(screen.queryByText(/turn off the link\?/i)).not.toBeInTheDocument();
    expect(
      await screen.findByRole("combobox", { name: "General access" }),
    ).toHaveTextContent("Restricted");
  });

  it("asks first when people joined through the link, and keeps them if you cancel", async () => {
    h.db.share = {
      id: "s1",
      token: "tok123",
      permission: "view",
      expires_at: null,
    };
    h.db.people = [person({ via_link: true })];
    const user = await mount();
    await choose(user, "General access", "Restricted");

    expect(await screen.findByText(/turn off the link\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/1 person who joined through it will lose access/i),
    ).toBeInTheDocument();
    expect(called("revokeShare")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(called("revokeShare")).toHaveLength(0);

    await choose(user, "General access", "Restricted");
    await user.click(
      await screen.findByRole("button", { name: "Turn off link" }),
    );
    await waitFor(() => expect(called("revokeShare")).toHaveLength(1));
  });

  it("replacing the link keeps its permission and expiry", async () => {
    const expires = new Date(Date.now() + 5 * 86400000).toISOString();
    h.db.share = {
      id: "s1",
      token: "tok123",
      permission: "edit",
      expires_at: expires,
    };
    const user = await mount();
    await user.click(screen.getByRole("button", { name: /replace link/i }));

    await waitFor(() => expect(called("createShare")).toHaveLength(1));
    expect(called("revokeShare")).toHaveLength(1);
    expect(called("createShare")[0]).toEqual([
      "createShare",
      "L1",
      "edit",
      expires,
    ]);
  });
});

describe("ShareModal: dropdowns", () => {
  it("opens on click, marks the current choice, and Escape closes only the dropdown, not the dialog", async () => {
    const user = await mount();
    await user.click(screen.getByRole("combobox", { name: "General access" }));
    expect(screen.getByRole("option", { name: "Restricted" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("option", { name: "Anyone with the link" }),
    ).toHaveAttribute("aria-selected", "false");

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(called("createShare")).toHaveLength(0);

    await user.keyboard("{Escape}"); // dropdown is closed now, so this one closes the dialog
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("can be driven entirely from the keyboard", async () => {
    const user = await mount();
    screen.getByRole("combobox", { name: "General access" }).focus();
    await user.keyboard("{ArrowDown}"); // opens
    await user.keyboard("{ArrowDown}"); // highlights "Anyone with the link"
    await user.keyboard("{Enter}");

    expect(await screen.findByLabelText("Share link")).toBeInTheDocument();
    expect(called("createShare")).toEqual([
      ["createShare", "L1", "view", null],
    ]);
  });

  it("does nothing when you pick the option that is already selected", async () => {
    h.db.share = {
      id: "s1",
      token: "tok123",
      permission: "view",
      expires_at: null,
    };
    const user = await mount();
    await choose(user, /what people with the link can do/i, "Viewer");
    expect(called("setSharePermission")).toHaveLength(0);
  });
});

describe("ShareModal: people and email invites", () => {
  it("adds a person by email (trimmed, lower-cased) with the chosen role, and shows them as Pending", async () => {
    const user = await mount();
    await user.type(screen.getByLabelText("Add people"), "  Bob@Example.COM ");
    await choose(user, /role for the new person/i, "Can edit");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(await screen.findByText("bob@example.com")).toBeInTheDocument();
    expect(await screen.findByText(/no email was sent/i)).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(called("inviteByEmail")).toEqual([
      ["inviteByEmail", "L1", "bob@example.com", "editor"],
    ]);
    expect(screen.getByLabelText("Add people")).toHaveValue("");
    expect(
      screen.getByRole("combobox", { name: "Access for bob@example.com" }),
    ).toHaveTextContent("Can edit");
  });

  it("rejects a malformed email and your own email without calling the backend", async () => {
    const user = await mount();
    await user.type(screen.getByLabelText("Add people"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/valid email/i);

    await user.clear(screen.getByLabelText("Add people"));
    await user.type(screen.getByLabelText("Add people"), "ME@test.dev");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/your own email/i);
    expect(called("inviteByEmail")).toHaveLength(0);
  });

  it("is honest that no email is sent", async () => {
    await mount();
    expect(screen.getByText(/doesn’t send emails/i)).toBeInTheDocument();
  });

  it("changes a pending invite role and removes an invite", async () => {
    h.db.invites = [{ id: "i1", email: "zed@x.com", role: "viewer" }];
    const user = await mount();
    await choose(user, "Access for zed@x.com", "Can edit");
    await waitFor(() =>
      expect(called("inviteByEmail")).toEqual([
        ["inviteByEmail", "L1", "zed@x.com", "editor"],
      ]),
    );

    await user.click(
      await screen.findByRole("button", {
        name: /remove invite for zed@x.com/i,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("zed@x.com")).not.toBeInTheDocument(),
    );
    expect(called("removeInvite")).toEqual([["removeInvite", "i1"]]);
  });

  it("shows the owner, changes a member role, and removes a member", async () => {
    h.db.people = [person({ via_link: true })];
    const user = await mount();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("via link")).toBeInTheDocument();

    await choose(user, "Access for Priya", "Can edit");
    await waitFor(() =>
      expect(called("setMemberRole")).toEqual([
        ["setMemberRole", "L1", "u1", "editor"],
      ]),
    );
    await waitFor(() =>
      expect(screen.queryByText("via link")).not.toBeInTheDocument(),
    );

    await user.click(
      await screen.findByRole("button", { name: /remove priya/i }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Priya")).not.toBeInTheDocument(),
    );
    expect(called("removeMember")).toEqual([["removeMember", "L1", "u1"]]);
  });

  it("labels the list Private until something is shared", async () => {
    const user = await mount();
    expect(screen.getByText("Private")).toBeInTheDocument();
    await choose(user, "General access", "Anyone with the link");
    expect(await screen.findByText("Shared")).toBeInTheDocument();
  });
});
