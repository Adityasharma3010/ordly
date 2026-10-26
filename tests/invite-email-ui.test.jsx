import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../src/contexts/ToastContext";
import { ShareModal } from "../src/components/sharing/ShareModal";
import { inviteErrorText, inviteMailto } from "../src/utils/invite";

// A backend that can send invite emails, and can be told to fail.
const h = vi.hoisted(() => ({
  db: { invites: [] },
  calls: [],
  extras: [], // the note / preview choice sent with each invite
  sendFails: null, // an error code to fail with, or null
}));

vi.mock("../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me", email: "me@test.dev", name: "Aditya" } }),
}));

vi.mock("../src/services/api", () => {
  const log = (name, ...args) => h.calls.push([name, ...args]);
  return {
    backendMode: "supabase",
    api: {
      capabilities: {
        auth: true,
        sharing: true,
        realtime: false,
        inviteEmail: true,
      },
      listShares: async () => [],
      collaborators: async () => [],
      invites: async () => h.db.invites.map((i) => ({ ...i })),
      inviteByEmail: async (listId, email, role, extra) => {
        log("inviteByEmail", listId, email, role);
        h.extras.push(extra);
        const id = `i${h.db.invites.length + 1}`;
        h.db.invites.push({
          id,
          email,
          role,
          emailed_at: null,
          email_count: 0,
        });
        return id;
      },
      sendInviteEmail: async (id) => {
        log("sendInviteEmail", id);
        if (h.sendFails) {
          throw Object.assign(new Error(h.sendFails), {
            code: h.sendFails,
            detail: "",
          });
        }
        const inv = h.db.invites.find((i) => i.id === id);
        inv.emailed_at = new Date().toISOString();
        inv.email_count += 1;
        return { ok: true };
      },
      removeInvite: async (id) => {
        h.db.invites = h.db.invites.filter((i) => i.id !== id);
      },
    },
  };
});

const list = { id: "L1", title: "Trip & plan #1" };
const called = (name) => h.calls.filter(([n]) => n === name);
const mount = async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <ShareModal open list={list} onClose={() => {}} />
    </ToastProvider>,
  );
  await screen.findByText("People with access");
  await waitFor(() =>
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement),
  );
  return user;
};
const addPerson = async (user, email) => {
  await user.type(screen.getByLabelText("Add people"), email);
  await user.click(screen.getByRole("button", { name: /^add$/i }));
};

beforeEach(() => {
  h.db = { invites: [] };
  h.calls = [];
  h.extras = [];
  h.sendFails = null;
});

describe("adding someone emails them", () => {
  it("saves the invite, emails it, and shows when it was sent", async () => {
    const user = await mount();
    expect(screen.getByText(/we email them a link/i)).toBeInTheDocument();
    await addPerson(user, "Pal@Example.com");
    expect(
      await screen.findByText(/invite emailed to pal@example.com/i),
    ).toBeInTheDocument();
    expect(called("inviteByEmail")).toEqual([
      ["inviteByEmail", "L1", "pal@example.com", "viewer"],
    ]);
    expect(called("sendInviteEmail")).toEqual([["sendInviteEmail", "i1"]]);
    expect(await screen.findByText(/^Emailed /)).toBeInTheDocument();
  });

  it("sends the personal note and the preview choice with the invite", async () => {
    const user = await mount();
    // the preview is on by default, and the note starts empty
    expect(
      screen.getByRole("switch", { name: /show a few items/i }),
    ).toBeChecked();
    await user.type(
      screen.getByLabelText(/personal note/i),
      "  Here you go!  ",
    );
    expect(screen.getByText("16/300")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: /show a few items/i }));
    await addPerson(user, "pal@example.com");
    await screen.findByText(/invite emailed to pal@example.com/i);
    expect(h.extras).toEqual([
      { message: "Here you go!", includePreview: false },
    ]);
    // the note box is cleared for the next person
    expect(screen.getByLabelText(/personal note/i)).toHaveValue("");
  });

  it("if email can't be sent, the invite is still saved and the other options are pointed out", async () => {
    h.sendFails = "not_deployed";
    const user = await mount();
    await addPerson(user, "pal@example.com");
    expect(await screen.findByText("pal@example.com")).toBeInTheDocument();
    const note = await screen.findByText(/wasn’t sent/i);
    expect(note).toHaveTextContent(/isn’t set up on this ordly yet/i);
    expect(note).toHaveTextContent(/email app/i);
    expect(screen.getByText("Not emailed yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /open your email app to invite pal@example.com/i,
      }),
    ).toBeInTheDocument();
  });
});

describe("pending invites", () => {
  const seed = (over = {}) => {
    h.db.invites = [
      {
        id: "i1",
        email: "zed@x.com",
        role: "editor",
        emailed_at: null,
        email_count: 0,
        ...over,
      },
    ];
  };

  it("offers to email an invite that hasn't been emailed, and says what happened", async () => {
    seed();
    const user = await mount();
    expect(screen.getByText("Not emailed yet")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Email invite to zed@x.com" }),
    );
    expect(
      await screen.findByText(/invite emailed to zed@x.com/i),
    ).toBeInTheDocument();
    expect(called("sendInviteEmail")).toEqual([["sendInviteEmail", "i1"]]);
    expect(
      await screen.findByRole("button", { name: "Email again to zed@x.com" }),
    ).toBeInTheDocument();
  });

  it("an invite that was emailed shows when, and can be sent again", async () => {
    seed({
      emailed_at: new Date(Date.now() - 3 * 3600e3).toISOString(),
      email_count: 1,
    });
    const user = await mount();
    expect(screen.getByText(/^Emailed .*ago/)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Email again to zed@x.com" }),
    );
    await waitFor(() => expect(called("sendInviteEmail")).toHaveLength(1));
  });

  it.each([
    ["cooldown", /try again in a minute/i],
    ["too_many_for_invite", /already been emailed 5 times/i],
    ["hourly_limit", /this hour/i],
    ["daily_limit", /tomorrow/i],
    ["unverified", /confirm your own email/i],
    ["email_failed", /couldn’t send it/i],
  ])("explains a refusal (%s) in plain words", async (code, words) => {
    seed();
    h.sendFails = code;
    const user = await mount();
    await user.click(
      screen.getByRole("button", { name: "Email invite to zed@x.com" }),
    );
    expect(await screen.findByText(words)).toBeInTheDocument();
    expect(screen.getByText("Not emailed yet")).toBeInTheDocument();
  });

  it("the email-app button is a real mailto link with the message ready", async () => {
    seed();
    await mount();
    const link = screen.getByRole("link", {
      name: /open your email app to invite zed@x.com/i,
    });
    const href = link.getAttribute("href");
    expect(href.startsWith("mailto:zed@x.com?")).toBe(true);
    const params = new URL(href).searchParams;
    expect(params.get("subject")).toBe(
      "Join my list “Trip & plan #1” on Ordly",
    );
    const body = params.get("body");
    expect(body).toContain("“Trip & plan #1”"); // & and # didn't break the link
    expect(body).toContain(
      "you’ll be able to edit it".replace("you’ll", "You’ll"),
    );
    expect(body).toContain(`${window.location.origin}/login`);
    expect(body).toContain("zed@x.com");
    expect(body.trim().endsWith("Aditya")).toBe(true);
    expect(href).not.toContain("+"); // email apps show a "+" literally
  });

  it("removing an invite still works", async () => {
    seed();
    const user = await mount();
    await user.click(
      screen.getByRole("button", { name: /remove invite for zed@x.com/i }),
    );
    await waitFor(() =>
      expect(screen.queryByText("zed@x.com")).not.toBeInTheDocument(),
    );
  });
});

describe("invite helpers", () => {
  it("builds a mailto that survives awkward titles and names", () => {
    const m = inviteMailto({
      email: "a.b+tag@x.co",
      listTitle: 'Q&A "plans"\r\nBcc: boss@x.com #1 100%',
      role: "viewer",
      inviterName: "Eve\nBcc: x",
      appUrl: "https://ordly-lists.vercel.app/",
    });
    const url = new URL(m.href);
    expect(url.pathname).toBe("a.b%2Btag@x.co");
    expect(decodeURIComponent(url.pathname)).toBe("a.b+tag@x.co");
    expect(url.searchParams.get("subject")).not.toMatch(/[\r\n]/);
    expect(url.searchParams.get("body")).toContain(
      "https://ordly-lists.vercel.app/login",
    );
    expect(url.searchParams.get("body")).toContain("view it");
    expect(m.href).not.toMatch(/\r|\n| /);
  });

  it("every failure has a sentence", () => {
    for (const code of [
      "not_deployed",
      "unreachable",
      "not_configured",
      "cooldown",
      "too_many_for_invite",
      "hourly_limit",
      "daily_limit",
      "unverified",
      "not_signed_in",
      "not_allowed",
      "email_failed",
      "whatever",
    ]) {
      const text = inviteErrorText({ code });
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain(
        code === "whatever" ? "undefined" : "undefined",
      );
    }
    expect(
      inviteErrorText({
        code: "not_configured",
        detail: "RESEND_API_KEY, MAIL_FROM",
      }),
    ).toContain("RESEND_API_KEY, MAIL_FROM");
    expect(
      inviteErrorText({
        code: "email_failed",
        detail: "The domain is not verified.",
      }),
    ).toContain("The domain is not verified.");
    expect(inviteErrorText(undefined)).toBe("The email couldn’t be sent.");
  });
});
