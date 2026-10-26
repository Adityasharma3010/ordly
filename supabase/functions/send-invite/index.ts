// Supabase Edge Function: send-invite
//
// Sends the "you've been invited to a list" email through Resend. The browser calls it with
// the signed-in person's login, like this:  supabase.functions.invoke("send-invite", {
// body: { invite_id } }). It never takes an email address or any text from the browser: it asks
// the database (invite_email_begin) who the invite is for and which list it is about, and the
// database only answers if the caller owns that list, has a confirmed email and is within the
// sending limits. So this can't be used to send mail to arbitrary people or with arbitrary text.
//
// Secrets it needs (Supabase Dashboard > Edge Functions > Secrets). SUPABASE_URL and
// SUPABASE_ANON_KEY are provided automatically; you add the other three:
//   RESEND_API_KEY   your Resend API key
//   MAIL_FROM        who the email comes from, e.g.  Ordly <invites@mail.yourdomain.com>
//   APP_URL          where Ordly lives, e.g.  https://ordly-lists.vercel.app
// Optional:
//   ALLOWED_ORIGINS  extra websites allowed to call this, comma separated (previews, etc.)
//   RESEND_API_URL   only for testing against a pretend email service; leave it unset

// ------------------------------------------------------------------ email text

// Makes text safe to put inside HTML.
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// One line, no control characters, not too long (for subjects and names).
const oneLine = (s: unknown, max: number) =>
  // deno-lint-ignore no-control-regex
  String(s ?? "")
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ")
    .trim()
    .slice(0, max);

export type InviteDetails = {
  inviter: string;
  listTitle: string;
  invitee: string;
  role: string;
  appUrl: string;
};

export function buildInviteEmail(d: InviteDetails) {
  const inviter = oneLine(d.inviter, 60) || "Someone";
  const title = oneLine(d.listTitle, 100) || "a list";
  const isEditor = d.role === "editor";
  const can = isEditor ? "edit" : "view";
  const base = d.appUrl.replace(/\/+$/, "");
  const link = `${base}/login`;
  // The logo is a PNG in /public (email apps block SVG), loaded from the live site.
  const logoUrl = `${base}/email-logo.png`;
  const subject = `${inviter} invited you to “${title}” on Ordly`;
  const initial = (Array.from(inviter)[0] || "?").toUpperCase();
  const roleLabel = isEditor ? "Can edit" : "Can view";
  const roleHelp = isEditor
    ? "Add items, tick them off, and set due dates, priorities and tags."
    : "Read the list and follow its progress. Only the owner can change it.";
  const preheader = `${inviter} shared “${title}” with you. ${roleLabel}.`;

  const text = [
    `${inviter} shared the list “${title}” with you on Ordly. You will be able to ${can} it.`,
    isEditor
      ? "You can add items, tick them off, and set due dates, priorities and tags."
      : "You can read the list and follow its progress.",
    "",
    `To open it, sign in (or create an account) with this email address, ${d.invitee}:`,
    link,
    "",
    "How to join:",
    "1. Open the link above.",
    `2. Sign in, or create an account, using ${d.invitee}. It has to be this address.`,
    "3. Find the list under “Shared with me”.",
    "",
    "If you weren’t expecting this, you can ignore this email. Nothing happens unless you sign in with this address.",
    "",
    "Ordly. Lists that stay put.",
  ].join("\n");

  const serif = "Georgia,'Times New Roman',serif";
  const sans = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const step = (n: number, body: string) =>
    `<tr><td valign="top" width="30" style="padding:0 0 12px"><div class="step" style="width:24px;height:24px;line-height:24px;border-radius:12px;background:#fdf1d8;color:#8a6a1f;font:600 12px/24px ${sans};text-align:center">${n}</div></td><td valign="top" class="muted" style="padding:2px 0 12px;font:14px/1.5 ${sans};color:#4b5563">${body}</td></tr>`;

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<style>
  @media (max-width:560px){ .px{padding-left:20px!important;padding-right:20px!important} .h1{font-size:25px!important} }
  @media (prefers-color-scheme:dark){
    .page{background:#0e0f12!important} .card{background:#17181c!important;border-color:#2a2c33!important}
    .ink{color:#f2f3f5!important} .muted{color:#a4a8b3!important} .faint{color:#7d8290!important}
    .panel{background:#211d12!important;border-color:#f0b24b!important} .rule{border-color:#2a2c33!important}
    .avatar{background:#3a2f14!important;color:#f0b24b!important} .step{background:#3a2f14!important;color:#f0b24b!important}
    .pill{background:#2a2c33!important;color:#f2f3f5!important}
  }
</style></head>
<body class="page" style="margin:0;padding:0;background:#f4f5f7">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="page" style="background:#f4f5f7"><tr><td align="center" style="padding:28px 14px">
  <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" class="card" style="width:100%;max-width:520px;background:#ffffff;border:1px solid #e7e9ee;border-radius:16px">
    <tr><td class="px" style="padding:26px 32px 0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle" style="padding-right:10px"><img src="${esc(logoUrl)}" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border:0;border-radius:9px"></td>
        <td valign="middle"><span class="ink" style="font:22px/1 ${serif};color:#1b1f27;letter-spacing:-.01em">Ordly</span></td>
      </tr></table>
    </td></tr>
    <tr><td class="px" style="padding:26px 32px 0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle" style="padding-right:12px"><div class="avatar" style="width:44px;height:44px;line-height:44px;border-radius:22px;background:#fdf1d8;color:#8a6a1f;font:600 18px/44px ${sans};text-align:center">${esc(initial)}</div></td>
        <td valign="middle" class="ink" style="font:15px/1.45 ${sans};color:#1b1f27"><b>${esc(inviter)}</b> invited you to a list</td>
      </tr></table>
    </td></tr>
    <tr><td class="px" style="padding:18px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="panel" style="background:#fbf7ee;border-left:4px solid #f0b24b;border-radius:10px"><tr><td style="padding:16px 18px">
        <div class="faint" style="font:600 11px/1 ${sans};letter-spacing:.08em;color:#8a6a1f;text-transform:uppercase">Shared list</div>
        <h1 class="h1 ink" style="margin:8px 0 12px;font:400 29px/1.2 ${serif};color:#1b1f27;letter-spacing:-.01em;word-break:break-word">${esc(title)}</h1>
        <span class="pill" style="display:inline-block;background:#1b1f27;color:#ffffff;font:600 12px/1 ${sans};padding:6px 10px;border-radius:999px">${roleLabel}</span>
        <p class="muted" style="margin:10px 0 0;font:13px/1.5 ${sans};color:#4b5563">${esc(roleHelp)}</p>
      </td></tr></table>
    </td></tr>
    <tr><td class="px" style="padding:22px 32px 0">
      <p class="ink" style="margin:0 0 18px;font:15px/1.6 ${sans};color:#1b1f27">You will be able to <b>${can}</b> this list. Sign in (or create an account) with <b>${esc(d.invitee)}</b> and it will appear under “Shared with me”.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:10px;background:#f0b24b"><a href="${esc(link)}" style="display:inline-block;background:#f0b24b;color:#17130a;text-decoration:none;font:600 15px/1 ${sans};padding:14px 24px;border-radius:10px">Open Ordly</a></td></tr></table>
    </td></tr>
    <tr><td class="px" style="padding:28px 32px 0">
      <div class="ink" style="margin:0 0 12px;font:600 13px/1 ${sans};color:#1b1f27">How to join</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${step(1, "Open Ordly with the button above.")}
        ${step(2, `Sign in, or create an account, using <b>${esc(d.invitee)}</b>. It has to be this exact address.`)}
        ${step(3, "Find the list under <b>Shared with me</b> in the sidebar.")}
      </table>
    </td></tr>
    <tr><td class="px" style="padding:6px 32px 0">
      <p class="faint" style="margin:0;font:12px/1.5 ${sans};color:#6b7280;word-break:break-all">Button not working? Copy this link into your browser:<br><a href="${esc(link)}" style="color:#8a6a1f">${esc(link)}</a></p>
    </td></tr>
    <tr><td class="px" style="padding:24px 32px 26px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="rule" style="border-top:1px solid #e7e9ee;padding-top:16px">
        <p class="faint" style="margin:0 0 6px;font:12px/1.5 ${sans};color:#6b7280">If you weren’t expecting this, you can ignore this email. Nothing happens unless you sign in with this address.</p>
        <p class="faint" style="margin:0;font:12px/1.5 ${serif};color:#8a8f9c;font-style:italic">Ordly. Lists that stay put.</p>
      </td></tr></table>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  return { subject, text, html };
}

// ------------------------------------------------------------------ the request

type Env = { get(key: string): string | undefined };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// What the database says when it refuses, and what we answer.
const REFUSALS: Record<string, [number, string]> = {
  not_allowed: [403, "not_allowed"],
  unverified: [403, "unverified"],
  cooldown: [429, "cooldown"],
  too_many_for_invite: [429, "too_many_for_invite"],
  hourly_limit: [429, "hourly_limit"],
  daily_limit: [429, "daily_limit"],
};

function corsFor(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = new Set<string>([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  try {
    const app = env.get("APP_URL");
    if (app) allowed.add(new URL(app).origin);
  } catch {
    /* APP_URL isn't a web address; reported below */
  }
  for (const o of (env.get("ALLOWED_ORIGINS") || "").split(","))
    if (o.trim()) allowed.add(o.trim());
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (allowed.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export async function handle(
  req: Request,
  env: Env,
  doFetch: typeof fetch,
): Promise<Response> {
  const cors = corsFor(req, env);
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const auth = req.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(auth))
    return reply(401, { error: "not_signed_in" });

  let inviteId = "";
  try {
    const body = await req.json();
    inviteId = typeof body?.invite_id === "string" ? body.invite_id : "";
  } catch {
    /* handled just below */
  }
  if (!UUID.test(inviteId)) return reply(400, { error: "bad_request" });

  const cfg = {
    SUPABASE_URL: env.get("SUPABASE_URL"),
    SUPABASE_ANON_KEY: env.get("SUPABASE_ANON_KEY"),
    RESEND_API_KEY: env.get("RESEND_API_KEY"),
    MAIL_FROM: env.get("MAIL_FROM"),
    APP_URL: env.get("APP_URL"),
  };
  const missing = Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) return reply(503, { error: "not_configured", missing });
  if (!/^https?:\/\//i.test(cfg.APP_URL!)) {
    return reply(503, {
      error: "not_configured",
      missing: ["APP_URL (must start with https://)"],
    });
  }

  const rpc = (name: string, args: Record<string, unknown>) =>
    doFetch(`${cfg.SUPABASE_URL!.replace(/\/+$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: cfg.SUPABASE_ANON_KEY!,
        Authorization: auth, // the caller's own login: the database decides what they may do
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });

  // 1. Ask the database whether this invite may be emailed right now, and what it says.
  let details: {
    log_id: string;
    list_title: string;
    invitee: string;
    role: string;
    inviter_name: string;
  };
  try {
    const res = await rpc("invite_email_begin", { p_invite_id: inviteId });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(data?.message || "");
      if (res.status === 401 || /jwt/i.test(msg))
        return reply(401, { error: "not_signed_in" });
      for (const [key, [status, code]] of Object.entries(REFUSALS))
        if (msg.includes(key)) return reply(status, { error: code });
      return reply(502, { error: "database_error" });
    }
    details = data;
  } catch {
    return reply(502, { error: "database_error" });
  }

  // 2. Send it.
  const mail = buildInviteEmail({
    inviter: details.inviter_name,
    listTitle: details.list_title,
    invitee: details.invitee,
    role: details.role,
    appUrl: cfg.APP_URL!,
  });
  let failure: { status: number; message: string } | null = null;
  try {
    const res = await doFetch(
      env.get("RESEND_API_URL") || "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": details.log_id, // a retry of the same send never emails twice
        },
        body: JSON.stringify({
          from: cfg.MAIL_FROM,
          to: [details.invitee],
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      failure = {
        status: res.status,
        message: String(data?.message || "").slice(0, 300),
      };
    }
  } catch {
    failure = { status: 0, message: "Couldn’t reach the email service." };
  }

  // 3. If the email service said no, give the sending allowance back and say why.
  if (failure) {
    try {
      await rpc("invite_email_undo", { p_log_id: details.log_id });
    } catch {
      /* best effort */
    }
    return reply(502, {
      error: "email_failed",
      provider_status: failure.status,
      provider_message: failure.message,
    });
  }

  return reply(200, {
    ok: true,
    sent_to: details.invitee,
    sent_at: new Date().toISOString(),
  });
}

// Start serving when running inside Supabase (the Deno runtime). Skipped when this file is
// imported by the tests.
const deno = (
  globalThis as {
    Deno?: { serve: (h: (r: Request) => Promise<Response>) => void; env: Env };
  }
).Deno;
if (deno) deno.serve((req) => handle(req, deno.env, fetch));
