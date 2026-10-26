import { describe, expect, it, vi } from "vitest";
import {
  buildInviteEmail,
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
    expect(m.html).not.toContain("<img");
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
