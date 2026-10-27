import { describe, expect, it, vi } from "vitest";
import {
  accentFor,
  buildInviteEmail,
  buildPreview,
  esc,
  handle,
} from "../supabase/functions/send-invite/index.ts";

const INVITE = "bbbbbbbb-0000-4000-8000-000000000001";
const ENV = {
  SUPABASE_URL: "https://proj.supabase.co",
  SUPABASE_ANON_KEY: "anon-key-123",
  RESEND_API_KEY: "re_secret_key",
  MAIL_FROM: "Ordly <invites@mail.example.com>",
  APP_URL: "https://ordly-lists.vercel.app",
};
const env = (o = {}) => {
  const all = { ...ENV, ...o };
  return { get: (k) => all[k] };
};
const DETAILS = {
  log_id: "log-1",
  list_title: "Trip plan",
  invitee: "pal@example.com",
  role: "editor",
  inviter_name: "Aditya",
};
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// A pretend Supabase + Resend. Records every call.
function world({
  begin = () => json(200, DETAILS),
  resend = () => json(200, { id: "msg1" }),
  lists = () => json(200, []),
  items = () => json(200, []),
} = {}) {
  const calls = [];
  const fetcher = vi.fn(async (url, init) => {
    const call = {
      url: String(url),
      init,
      body: init?.body ? JSON.parse(init.body) : null,
    };
    calls.push(call);
    if (call.url.endsWith("/rpc/invite_email_begin")) return begin(call);
    if (call.url.endsWith("/rpc/invite_email_undo")) return json(204, {});
    if (call.url.includes("/rest/v1/lists?")) return lists(call);
    if (call.url.includes("/rest/v1/list_items?")) return items(call);
    if (call.url === "https://api.resend.com/emails") return resend(call);
    throw new Error("unexpected call " + call.url);
  });
  return { calls, fetcher };
}
const request = (o = {}) =>
  new Request("https://proj.supabase.co/functions/v1/send-invite", {
    method: o.method || "POST",
    headers: {
      Origin: "https://ordly-lists.vercel.app",
      ...(o.auth === null
        ? {}
        : { Authorization: o.auth ?? "Bearer user-jwt" }),
      "Content-Type": "application/json",
      ...(o.headers || {}),
    },
    body:
      o.method === "GET" || o.method === "OPTIONS"
        ? undefined
        : (o.raw ?? JSON.stringify({ invite_id: INVITE, ...(o.body || {}) })),
  });
const run = async (req, w = world(), e = env()) => {
  const res = await handle(req, e, w.fetcher);
  const text = await res.text();
  return { res, body: text ? JSON.parse(text) : null, calls: w.calls };
};

describe("the invite email text", () => {
  it("says who invited you, to what, and how to open it", () => {
    const m = buildInviteEmail({
      inviter: "Aditya",
      listTitle: "Trip plan",
      invitee: "pal@example.com",
      role: "editor",
      appUrl: "https://ordly-lists.vercel.app/",
    });
    expect(m.subject).toBe("Aditya invited you to “Trip plan” on Ordly");
    expect(m.text).toContain("You will be able to edit it");
    expect(m.text).toContain("pal@example.com");
    expect(m.text).toContain("https://ordly-lists.vercel.app/login"); // no double slash
    expect(m.html).toContain('href="https://ordly-lists.vercel.app/login"');
    expect(
      buildInviteEmail({
        inviter: "A",
        listTitle: "T",
        invitee: "x@y.co",
        role: "viewer",
        appUrl: "https://a.b",
      }).text,
    ).toContain("view it");
  });

  it("shows the role, how to join, a copyable link and a dark-mode version", () => {
    const base = {
      inviter: "Aditya",
      listTitle: "Trip plan",
      invitee: "pal@example.com",
      appUrl: "https://ordly-lists.vercel.app",
    };
    const editor = buildInviteEmail({ ...base, role: "editor" });
    const viewer = buildInviteEmail({ ...base, role: "viewer" });
    expect(editor.html).toContain("Can edit");
    expect(viewer.html).toContain("Can view");
    expect(viewer.html).not.toContain("Can edit");
    expect(editor.html).toContain("How to join");
    expect(editor.html).toContain("Shared with me");
    expect(editor.html).toContain("Open Ordly");
    expect(editor.html).toContain(
      '<img src="https://ordly-lists.vercel.app/email-logo.gif"',
    );
    // the plain link is printed too, for when the button doesn't work
    expect(
      editor.html.match(/ordly-lists\.vercel\.app\/login/g).length,
    ).toBeGreaterThanOrEqual(3);
    expect(editor.html).toContain("prefers-color-scheme:dark");
    expect(editor.html).toContain('name="color-scheme"');
    // the avatar shows the inviter's first letter, and the hidden preview line names the list
    expect(editor.html).toContain(">A</div>");
    expect(editor.html).toContain("shared “Trip plan” with you");
    expect(editor.text).toContain("How to join:");
    expect(editor.text).toContain("Shared with me");
    expect(
      buildInviteEmail({ ...base, inviter: "  ", role: "viewer" }).html,
    ).toContain("Someone");
  });

  it("nothing a person typed can inject HTML into the email", () => {
    const evil = `<script>alert(1)</script><img src=x onerror=alert(1)>"'&`;
    const m = buildInviteEmail({
      inviter: evil,
      listTitle: evil,
      invitee: `a"><b>@x.co`,
      role: "viewer",
      appUrl: "https://a.b",
    });
    expect(m.html).not.toContain("<script");
    expect(m.html).not.toContain("<img src=x");
    // the only image is our own logo
    expect(m.html.match(/<img/g)).toHaveLength(1);
    expect(m.html).not.toContain("onerror=alert(1)>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(esc(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("names can't add lines to the subject, and are kept short", () => {
    const m = buildInviteEmail({
      inviter: "Eve\r\nBcc: boss@x.com",
      listTitle: "x".repeat(500),
      invitee: "a@b.co",
      role: "viewer",
      appUrl: "https://a.b",
    });
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.subject.length).toBeLessThan(220);
    expect(
      buildInviteEmail({
        inviter: "",
        listTitle: "",
        invitee: "a@b.co",
        role: "viewer",
        appUrl: "https://a.b",
      }).subject,
    ).toBe("Someone invited you to “a list” on Ordly");
  });
});

describe("send-invite: the happy path", () => {
  it("asks the database first, then sends exactly one email to the invited person", async () => {
    const { res, body, calls } = await run(request());
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, sent_to: "pal@example.com" });

    expect(calls.map((c) => c.url)).toEqual([
      "https://proj.supabase.co/rest/v1/rpc/invite_email_begin",
      "https://api.resend.com/emails",
    ]);
    const [begin, mail] = calls;
    expect(begin.init.headers.Authorization).toBe("Bearer user-jwt"); // the caller's own login
    expect(begin.init.headers.apikey).toBe("anon-key-123");
    expect(begin.body).toEqual({ p_invite_id: INVITE });
    expect(mail.init.headers.Authorization).toBe("Bearer re_secret_key");
    expect(mail.init.headers["Idempotency-Key"]).toBe("log-1");
    expect(mail.body.to).toEqual(["pal@example.com"]);
    expect(mail.body.from).toBe("Ordly <invites@mail.example.com>");
    expect(mail.body.subject).toContain("Trip plan");
    expect(mail.body.html).toContain("Open Ordly");
  });

  it("never reveals the email service key", async () => {
    const ok = await handle(request(), env(), world().fetcher);
    const text = await ok.text();
    expect(text).not.toContain("re_secret_key");
    expect(text).not.toContain("anon-key-123");
    const failed = await handle(
      request(),
      env(),
      world({ resend: () => json(401, { message: "API key is invalid" }) })
        .fetcher,
    );
    expect(await failed.text()).not.toContain("re_secret_key");
  });
});

describe("send-invite: who may call it", () => {
  it("refuses without a login, before touching anything", async () => {
    for (const auth of [null, "", "Basic abc", "Bearer"]) {
      const { res, body, calls } = await run(request({ auth }));
      expect(res.status).toBe(401);
      expect(body.error).toBe("not_signed_in");
      expect(calls).toHaveLength(0);
    }
  });

  it("takes only an invite id: nothing else from the browser is used", async () => {
    const { calls } = await run(
      request({
        body: {
          to: "victim@x.com",
          subject: "hi",
          html: "<b>x</b>",
          from: "ceo@bank.com",
          list_title: "Evil",
        },
      }),
    );
    const mail = calls.find((c) => c.url.endsWith("/emails")).body;
    expect(mail.to).toEqual(["pal@example.com"]);
    expect(mail.from).toBe("Ordly <invites@mail.example.com>");
    expect(mail.subject).not.toContain("Evil");
  });

  it("rejects a missing, malformed or hostile invite id", async () => {
    for (const body of [
      { invite_id: "" },
      { invite_id: "123" },
      { invite_id: `${INVITE}' or 1=1` },
      { invite_id: 5 },
      { invite_id: null },
    ]) {
      const { res, calls } = await run(request({ raw: JSON.stringify(body) }));
      expect(res.status).toBe(400);
      expect(calls).toHaveLength(0);
    }
    expect((await run(request({ raw: "not json" }))).res.status).toBe(400);
    expect((await run(request({ raw: "" }))).res.status).toBe(400);
  });

  it("only answers POST (and the browser's OPTIONS check)", async () => {
    expect((await run(request({ method: "GET" }))).res.status).toBe(405);
    expect((await run(request({ method: "PUT" }))).res.status).toBe(405);
    const options = await run(request({ method: "OPTIONS", auth: null }));
    expect(options.res.status).toBe(204);
    expect(options.res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://ordly-lists.vercel.app",
    );
    expect(options.res.headers.get("Access-Control-Allow-Headers")).toContain(
      "authorization",
    );
  });
});

describe("send-invite: websites allowed to call it", () => {
  const originOf = async (origin, e) =>
    (
      await run(request({ headers: { Origin: origin } }), world(), e)
    ).res.headers.get("Access-Control-Allow-Origin");
  it("your own site and local development, nobody else", async () => {
    expect(await originOf("https://ordly-lists.vercel.app")).toBe(
      "https://ordly-lists.vercel.app",
    );
    expect(await originOf("http://localhost:5173")).toBe(
      "http://localhost:5173",
    );
    expect(await originOf("https://evil.example")).toBeNull();
    expect(
      await originOf("https://ordly-lists.vercel.app.evil.example"),
    ).toBeNull();
  });
  it("extra sites can be allowed with ALLOWED_ORIGINS", async () => {
    expect(
      await originOf(
        "https://preview-1.vercel.app",
        env({
          ALLOWED_ORIGINS: "https://preview-1.vercel.app, https://other.app",
        }),
      ),
    ).toBe("https://preview-1.vercel.app");
  });
});

describe("send-invite: when the database says no", () => {
  const refuse = (message, status = 400) =>
    world({ begin: () => json(status, { code: "P0001", message }) });
  it.each([
    ["not_allowed", 403, "not_allowed"],
    ["unverified", 403, "unverified"],
    ["cooldown", 429, "cooldown"],
    ["too_many_for_invite", 429, "too_many_for_invite"],
    ["hourly_limit", 429, "hourly_limit"],
    ["daily_limit", 429, "daily_limit"],
  ])("%s -> %i", async (message, status, code) => {
    const w = refuse(message);
    const { res, body, calls } = await run(request(), w);
    expect(res.status).toBe(status);
    expect(body.error).toBe(code);
    expect(calls.some((c) => c.url.includes("resend"))).toBe(false); // nothing was sent
  });

  it("an expired login asks to sign in again", async () => {
    const { res, body } = await run(
      request(),
      world({ begin: () => json(401, { message: "JWT expired" }) }),
    );
    expect(res.status).toBe(401);
    expect(body.error).toBe("not_signed_in");
  });

  it("anything unexpected from the database is a plain error, with no details leaked", async () => {
    const { res, body } = await run(
      request(),
      world({
        begin: () =>
          json(500, { message: "relation secret_table does not exist" }),
      }),
    );
    expect(res.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain("secret_table");
  });

  it("a database that can't be reached", async () => {
    const w = world();
    w.fetcher.mockRejectedValueOnce(new Error("network down"));
    const { res, body } = await run(request(), w);
    expect(res.status).toBe(502);
    expect(body.error).toBe("database_error");
  });
});

describe("send-invite: when the email service fails", () => {
  it("gives the allowance back and explains", async () => {
    const w = world({
      resend: () =>
        json(403, { message: "The mail.example.com domain is not verified." }),
    });
    const { res, body, calls } = await run(request(), w);
    expect(res.status).toBe(502);
    expect(body).toEqual({
      error: "email_failed",
      provider_status: 403,
      provider_message: "The mail.example.com domain is not verified.",
    });
    const undo = calls.find((c) => c.url.endsWith("/rpc/invite_email_undo"));
    expect(undo.body).toEqual({ p_log_id: "log-1" });
    expect(undo.init.headers.Authorization).toBe("Bearer user-jwt");
  });

  it("also when the email service can't be reached", async () => {
    const w = world({
      resend: () => {
        throw new Error("timeout");
      },
    });
    const { res, body, calls } = await run(request(), w);
    expect(res.status).toBe(502);
    expect(body.error).toBe("email_failed");
    expect(calls.some((c) => c.url.endsWith("/rpc/invite_email_undo"))).toBe(
      true,
    );
  });
});

describe("send-invite: setup problems are reported clearly", () => {
  it("names the missing settings (never their values)", async () => {
    const { res, body, calls } = await run(
      request(),
      world(),
      env({ RESEND_API_KEY: "", MAIL_FROM: undefined }),
    );
    expect(res.status).toBe(503);
    expect(body).toEqual({
      error: "not_configured",
      missing: ["RESEND_API_KEY", "MAIL_FROM"],
    });
    expect(calls).toHaveLength(0);
  });
  it("APP_URL must be a web address", async () => {
    const { res, body } = await run(
      request(),
      world(),
      env({ APP_URL: "ordly-lists.vercel.app" }),
    );
    expect(res.status).toBe(503);
    expect(body.missing[0]).toContain("APP_URL");
  });
});

const LIST_ID = "cccccccc-0000-4000-8000-000000000001";
const row = (id, text, extra = {}) => ({
  id,
  text,
  parent_id: null,
  has_checkbox: true,
  completed: false,
  position: Number(id.replace(/\D/g, "")) || 0,
  ...extra,
});

describe("the list preview", () => {
  it("shows the first items and counts progress the way the app does", () => {
    const p = buildPreview(
      [
        row("a1", "Plan trip"),
        row("b2", "Book flights", { parent_id: "a1", completed: true }),
        row("c3", "Pack bag", { parent_id: "a1" }),
        row("d4", "Water plants", { completed: true }),
        row("e5", "Heading", { has_checkbox: false }),
      ],
      3,
    );
    // the parent counts through its sub-tasks (1 of 2), plus "Water plants" (1 of 1)
    expect([p.done, p.total]).toEqual([2, 3]);
    expect(p.items.map((i) => i.text)).toEqual([
      "Plan trip",
      "Water plants",
      "Heading",
    ]);
    expect(p.items.map((i) => i.done)).toEqual([false, true, false]);
    expect(p.items[2].box).toBe(false);
    expect(p.more).toBe(0);
    expect(buildPreview([row("a1", "x"), row("b2", "y")], 1).more).toBe(1);
  });

  it("a parent is done exactly when all its sub-tasks are", () => {
    const p = buildPreview([
      row("a1", "Parent", { completed: true }), // its own tick is ignored
      row("b2", "Child", { parent_id: "a1" }),
    ]);
    expect(p.items[0].done).toBe(false);
    expect([p.done, p.total]).toEqual([0, 1]);
  });

  it("an item whose parent is missing still shows (never disappears)", () => {
    expect(
      buildPreview([row("a1", "Lost", { parent_id: "zzz" })]).items,
    ).toHaveLength(1);
  });
});

describe("the list colour", () => {
  it("uses the list's preset or custom colour, and amber for anything else", () => {
    expect(accentFor("sky")).toBe("#6db6f1");
    expect(accentFor("#ABCDEF")).toBe("#abcdef");
    expect(accentFor("system")).toBe("#f0b24b");
    expect(accentFor("red;background:url(x)")).toBe("#f0b24b");
    expect(accentFor(null)).toBe("#f0b24b");
  });
});

describe("the richer invite email", () => {
  const base = {
    inviter: "Aditya",
    listTitle: "Groceries",
    invitee: "pal@example.com",
    role: "viewer",
    appUrl: "https://ordly-lists.vercel.app",
  };
  const preview = {
    items: [
      { text: "Milk", box: true, done: true },
      { text: "Eggs", box: true, done: false },
      { text: "Aisle notes", box: false, done: false },
    ],
    more: 2,
    done: 1,
    total: 4,
  };

  it("uses the list's icon and colour, the note, the items and the progress", () => {
    const m = buildInviteEmail({
      ...base,
      icon: "🛒",
      color: "sky",
      message: "Here you go!\nSee you soon",
      preview,
    });
    expect(m.html).toContain("🛒");
    expect(m.html).toContain("#6db6f1");
    expect(m.html).not.toContain("#f0b24b"); // the default amber isn't used
    expect(m.html).toContain("Here you go!<br>See you soon");
    expect(m.html).toContain("A look inside");
    expect(m.html).toContain("Milk");
    expect(m.html).toContain("line-through");
    expect(m.html).toContain("+ 2 more items");
    expect(m.html).toContain("<b>1</b> of 4 done");
    expect(m.html).toContain('width="25%"');
    expect(m.text).toContain("“Here you go!\nSee you soon”");
    expect(m.text).toContain("[x] Milk");
    expect(m.text).toContain("[ ] Eggs");
    expect(m.text).toContain("- Aisle notes");
    expect(m.text).toContain("1 of 4 done");
  });

  it("without any of it, it is the plain amber email", () => {
    const m = buildInviteEmail(base);
    expect(m.html).not.toContain("A look inside");
    expect(m.html).not.toContain("quote");
    expect(m.html).toContain("#f0b24b");
  });

  it("the button's text stays readable on dark and light colours", () => {
    expect(buildInviteEmail({ ...base, color: "#101010" }).html).toContain(
      "background:#101010;color:#ffffff",
    );
    expect(buildInviteEmail({ ...base, color: "#f0f0a0" }).html).toContain(
      "background:#f0f0a0;color:#17130a",
    );
  });

  it("nothing in the note, the items or the icon can inject HTML", () => {
    const evil = `<script>alert(1)</script><img src=x onerror=alert(1)>"'&`;
    const m = buildInviteEmail({
      ...base,
      icon: evil,
      message: evil,
      color: evil,
      preview: { ...preview, items: [{ text: evil, box: true, done: false }] },
    });
    expect(m.html).not.toContain("<script");
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).not.toContain("onerror=alert(1)>");
    expect(m.html.match(/<img/g)).toHaveLength(1); // only the logo
    expect(m.html).toContain("&lt;script&gt;");
  });

  it("the note is capped, and odd characters are dropped", () => {
    const m = buildInviteEmail({
      ...base,
      message: "a\u0000b\u202Ec" + "x".repeat(400),
    });
    expect(m.html).toContain("abc");
    expect(m.html).not.toContain("x".repeat(301));
    expect(m.html).not.toContain("\u0000");
  });
});

describe("send-invite: what the email shows about the list", () => {
  const withList = (o = {}) =>
    world({
      begin: () =>
        json(200, {
          ...DETAILS,
          list_id: LIST_ID,
          message: "Hello there",
          include_preview: true,
          ...o.details,
        }),
      lists: () => json(200, [{ icon: "✈️", color: "violet" }]),
      items: () =>
        json(200, [
          row("a1", "Book flights", { completed: true }),
          row("b2", "Pack bag"),
        ]),
      ...o.world,
    });

  it("reads the list with the caller's own login and puts it in the email", async () => {
    const w = withList();
    const { res, calls } = await run(request(), w);
    expect(res.status).toBe(200);
    const reads = calls.filter((c) => c.url.includes("/rest/v1/l"));
    expect(reads).toHaveLength(2);
    for (const c of reads) {
      expect(c.init.headers.Authorization).toBe("Bearer user-jwt");
      expect(c.init.headers.apikey).toBe("anon-key-123");
      expect(c.url).toContain(LIST_ID);
    }
    const mail = calls.find(
      (c) => c.url === "https://api.resend.com/emails",
    ).body;
    expect(mail.html).toContain("✈️");
    expect(mail.html).toContain("#a996f6");
    expect(mail.html).toContain("Hello there");
    expect(mail.html).toContain("Book flights");
    expect(mail.html).toContain("<b>1</b> of 2 done");
  });

  it("leaves the items out when the sender turned the preview off", async () => {
    const { res, calls } = await run(
      request(),
      withList({ details: { include_preview: false } }),
    );
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.url.includes("/rest/v1/list_items"))).toBe(
      false,
    );
    const mail = calls.find(
      (c) => c.url === "https://api.resend.com/emails",
    ).body;
    expect(mail.html).not.toContain("A look inside");
    expect(mail.html).toContain("✈️"); // the icon and colour still show
  });

  it("still sends the invite if the list can't be read", async () => {
    const { res, calls } = await run(
      request(),
      withList({
        world: {
          lists: () => json(500, { message: "boom" }),
          items: () => {
            throw new Error("network down");
          },
        },
      }),
    );
    expect(res.status).toBe(200);
    const mail = calls.find(
      (c) => c.url === "https://api.resend.com/emails",
    ).body;
    expect(mail.html).toContain("Hello there");
    expect(mail.html).not.toContain("A look inside");
    expect(mail.html).toContain("#f0b24b");
  });

  it("never builds a database address from a list id that isn't a uuid", async () => {
    const { res, calls } = await run(
      request(),
      withList({ details: { list_id: "x&select=*" } }),
    );
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.url.includes("/rest/v1/l"))).toBe(false);
  });
});

describe("the direct link to the list", () => {
  const base = {
    inviter: "Aditya",
    listTitle: "Groceries",
    invitee: "pal@example.com",
    role: "viewer",
    appUrl: "https://ordly-lists.vercel.app/",
  };

  it("the button opens the list itself, and the plain link and text do too", () => {
    const m = buildInviteEmail({ ...base, listId: LIST_ID });
    const url = `https://ordly-lists.vercel.app/app/${LIST_ID}`;
    expect(m.html.match(new RegExp(url, "g")).length).toBeGreaterThanOrEqual(2);
    expect(m.html).not.toContain("/login");
    expect(m.html).toContain("Open the list");
    expect(m.html).toContain("straight to it");
    expect(m.text).toContain(url);
    expect(m.text).not.toContain("/login");
  });

  it("falls back to the login page without a proper list id", () => {
    for (const listId of [
      undefined,
      null,
      "",
      "not-a-uuid",
      `${LIST_ID}/../x`,
    ]) {
      const m = buildInviteEmail({ ...base, listId });
      expect(m.html).toContain("https://ordly-lists.vercel.app/login");
      expect(m.html).not.toContain("/app/");
      expect(m.html).toContain("Open Ordly");
    }
  });

  it("the button has a hover colour, lighter in dark mode", () => {
    const m = buildInviteEmail({ ...base, color: "#6db6f1" });
    expect(m.html).toContain('class="btn"');
    expect(m.html).toMatch(/a\.btn:hover\{background:#[0-9a-f]{6}!important/);
    expect((m.html.match(/a\.btn:hover/g) || []).length).toBe(2);
  });

  it("the sent email carries the list's address", async () => {
    const w = world({
      begin: () => json(200, { ...DETAILS, list_id: LIST_ID }),
    });
    const { res, calls } = await run(request(), w);
    expect(res.status).toBe(200);
    const mail = calls.find(
      (c) => c.url === "https://api.resend.com/emails",
    ).body;
    expect(mail.html).toContain(`/app/${LIST_ID}`);
    expect(mail.text).toContain(`/app/${LIST_ID}`);
  });
});
