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

// A few items from the list, shown in the email: what to draw, plus how far along the list is.
export type PreviewItem = { text: string; box: boolean; done: boolean };
export type Preview = {
  items: PreviewItem[];
  more: number;
  done: number;
  total: number;
};

export type InviteDetails = {
  inviter: string;
  listTitle: string;
  invitee: string;
  role: string;
  appUrl: string;
  listId?: string | null; // when given, the button opens this list directly
  message?: string | null; // the inviter's personal note
  icon?: string | null; // the list's emoji
  color?: string | null; // the list's colour (a preset name or #rrggbb)
  preview?: Preview | null;
};

// The same colours the app offers for a list (src/utils/appearance.js).
const ACCENTS: Record<string, string> = {
  amber: "#f0b24b",
  coral: "#f0806c",
  sage: "#7fcba5",
  sky: "#6db6f1",
  violet: "#a996f6",
  rose: "#ef8fb7",
  stone: "#a4acbd",
};
export function accentFor(color: unknown): string {
  const c = String(color ?? "")
    .trim()
    .toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  return ACCENTS[c] || ACCENTS.amber;
}
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) =>
  "#" +
  c
    .map((x) =>
      Math.max(0, Math.min(255, Math.round(x)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
// `t` of the way from colour a to colour b
const mix = (a: string, b: string, t: number) => {
  const A = rgb(a);
  const B = rgb(b);
  return toHex(A.map((x, i) => x + (B[i] - x) * t));
};
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// Dark or white text, whichever reads better on a button of this colour.
const inkOn = (hex: string) =>
  contrast(hex, "#17130a") >= contrast(hex, "#ffffff") ? "#17130a" : "#ffffff";

// A note keeps its line breaks but nothing else odd (no control characters).
function cleanNote(s: unknown): string {
  return Array.from(String(s ?? "").replace(/\r\n?/g, "\n"))
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      if (c === 10) return true;
      if (c < 32 || c === 127 || c === 0x2028 || c === 0x2029) return false;
      // invisible text-direction switches, which can make text read as something else
      if (c === 0x200e || c === 0x200f) return false;
      return !((c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069));
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 300);
}

type ItemRow = {
  id: string;
  text: string;
  parent_id: string | null;
  has_checkbox: boolean;
  completed: boolean;
  position: number;
};

// Works out the first few top-level items and the list's progress, the same way the app
// does: a task with sub-tasks is done when they all are; only the tasks at the bottom of
// each branch are counted.
export function buildPreview(rows: ItemRow[], max = 5): Preview {
  const ids = new Set(rows.map((r) => r.id));
  const groups = new Map<string | null, ItemRow[]>();
  for (const r of [...rows].sort((a, b) => a.position - b.position)) {
    const key = r.parent_id && ids.has(r.parent_id) ? r.parent_id : null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const order: ItemRow[] = [];
  const stack = [...(groups.get(null) || [])].reverse();
  while (stack.length) {
    const n = stack.pop()!;
    order.push(n);
    const kids = groups.get(n.id) || [];
    for (let k = kids.length - 1; k >= 0; k--) stack.push(kids[k]);
  }
  const roll = new Map<
    string,
    { done: number; total: number; completed: boolean }
  >();
  const share = (c: ItemRow) => {
    const r = roll.get(c.id)!;
    return c.has_checkbox && r.total === 0
      ? { done: c.completed ? 1 : 0, total: 1 }
      : { done: r.done, total: r.total };
  };
  for (let k = order.length - 1; k >= 0; k--) {
    const n = order[k];
    let done = 0;
    let total = 0;
    for (const c of groups.get(n.id) || []) {
      const x = share(c);
      done += x.done;
      total += x.total;
    }
    roll.set(n.id, {
      done,
      total,
      completed: n.has_checkbox
        ? total > 0
          ? done === total
          : !!n.completed
        : false,
    });
  }
  const top = groups.get(null) || [];
  let done = 0;
  let total = 0;
  for (const c of top) {
    const x = share(c);
    done += x.done;
    total += x.total;
  }
  return {
    items: top.slice(0, max).map((r) => ({
      text: oneLine(r.text, 80) || "(untitled)",
      box: !!r.has_checkbox,
      done: roll.get(r.id)!.completed,
    })),
    more: Math.max(0, top.length - max),
    done,
    total,
  };
}

export function buildInviteEmail(d: InviteDetails) {
  const inviter = oneLine(d.inviter, 60) || "Someone";
  const title = oneLine(d.listTitle, 100) || "a list";
  const isEditor = d.role === "editor";
  const can = isEditor ? "edit" : "view";
  const base = d.appUrl.replace(/\/+$/, "");
  // With the list's id the button goes straight to the list: someone already signed in lands
  // on it, and someone who isn't is sent to sign in first and then brought back to it.
  const listId =
    typeof d.listId === "string" && UUID.test(d.listId) ? d.listId : null;
  const link = listId ? `${base}/app/${listId}` : `${base}/login`;
  const cta = listId ? "Open the list" : "Open Ordly";
  // The logo is a GIF in /public (email apps block SVG), loaded from the live site.
  const logoUrl = `${base}/email-logo.gif`;
  const subject = `${inviter} invited you to “${title}” on Ordly`;
  const initial = (Array.from(inviter)[0] || "?").toUpperCase();
  const roleLabel = isEditor ? "Can edit" : "Can view";
  const roleHelp = isEditor
    ? "Add items, tick them off, and set due dates, priorities and tags."
    : "Read the list and follow its progress. Only the owner can change it.";
  const note = cleanNote(d.message);
  const icon = Array.from(String(d.icon ?? "").trim())
    .slice(0, 4)
    .join("");
  const preview = d.preview && d.preview.items.length ? d.preview : null;
  const preheader = note
    ? `${inviter}: “${oneLine(note, 90)}”`
    : `${inviter} shared “${title}” with you. ${roleLabel}.`;

  // The list's own colour, and the tints worked out from it for light and dark mode.
  const accent = accentFor(d.color);
  const onAccent = inkOn(accent);
  const tint = mix(accent, "#ffffff", 0.9);
  const tintDark = mix(accent, "#17181c", 0.86);
  const soft = mix(accent, "#ffffff", 0.8);
  const softDark = mix(accent, "#17181c", 0.72);
  const trackDark = mix(accent, "#17181c", 0.7);
  const pillDark = mix(accent, "#17181c", 0.5);
  // hover: a touch deeper on light backgrounds, a touch brighter on dark ones
  const hover = mix(accent, "#000000", 0.14);
  const hoverDark = mix(accent, "#ffffff", 0.2);
  const label = mix(accent, "#000000", 0.45);
  const labelDark = mix(accent, "#ffffff", 0.15);

  const text = [
    `${inviter} shared the list “${title}” with you on Ordly. You will be able to ${can} it.`,
    isEditor
      ? "You can add items, tick them off, and set due dates, priorities and tags."
      : "You can read the list and follow its progress.",
    ...(note ? ["", `“${note}”`, `— ${inviter}`] : []),
    ...(preview
      ? [
          "",
          "A look inside:",
          ...preview.items.map(
            (it) => `${it.box ? (it.done ? "[x]" : "[ ]") : "-"} ${it.text}`,
          ),
          ...(preview.more
            ? [`+ ${preview.more} more item${preview.more === 1 ? "" : "s"}`]
            : []),
          ...(preview.total
            ? [`${preview.done} of ${preview.total} done`]
            : []),
        ]
      : []),
    "",
    listId
      ? `Open the list (you will be asked to sign in, or create an account, with ${d.invitee}):`
      : `To open it, sign in (or create an account) with this email address, ${d.invitee}:`,
    link,
    "",
    "How to join:",
    "1. Open the link above.",
    `2. Sign in, or create an account, using ${d.invitee}. It has to be this address.`,
    listId
      ? "3. You land right on the list. It also stays under “Shared with me”."
      : "3. Find the list under “Shared with me”.",
    "",
    "If you weren’t expecting this, you can ignore this email. Nothing happens unless you sign in with this address.",
    "",
    "Ordly. Lists that stay put.",
  ].join("\n");

  const serif = "Georgia,'Times New Roman',serif";
  const sans = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const step = (n: number, body: string) =>
    `<tr><td valign="top" width="30" style="padding:0 0 12px"><div class="step" style="width:24px;height:24px;line-height:24px;border-radius:12px;background:${soft};color:${label};font:600 12px/24px ${sans};text-align:center">${n}</div></td><td valign="top" class="muted" style="padding:2px 0 12px;font:14px/1.5 ${sans};color:#4b5563">${body}</td></tr>`;

  const noteHtml = note
    ? `<tr><td class="px" style="padding:18px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="quote" style="border-left:3px solid ${accent};padding:2px 0 2px 14px">
        <div class="ink" style="font:italic 17px/1.5 ${serif};color:#1b1f27">“${esc(note).replace(/\n/g, "<br>")}”</div>
        <div class="faint" style="margin-top:6px;font:12px/1.4 ${sans};color:#6b7280">${esc(inviter)}</div>
      </td></tr></table>
    </td></tr>`
    : "";

  const box = (it: PreviewItem) =>
    !it.box
      ? `<div class="faint" style="width:16px;text-align:center;font:14px/16px ${sans};color:#8a8f9c">&bull;</div>`
      : it.done
        ? `<div style="width:16px;height:16px;border-radius:5px;background:${accent};color:${onAccent};font:700 11px/16px ${sans};text-align:center">&#10003;</div>`
        : `<div class="tickbox" style="width:13px;height:13px;border:1.5px solid #b9bdc7;border-radius:5px"></div>`;
  const rows = preview
    ? preview.items
        .map(
          (it) =>
            `<tr><td valign="top" width="26" style="padding:2px 0 9px">${box(it)}</td><td valign="top" class="${it.done ? "faint" : "ink"}" style="padding:0 0 9px;font:14px/1.45 ${sans};color:${it.done ? "#8a8f9c" : "#1b1f27"};${it.done ? "text-decoration:line-through;" : ""}word-break:break-word">${esc(it.text)}</td></tr>`,
        )
        .join("")
    : "";
  const pct =
    preview && preview.total
      ? Math.round((preview.done / preview.total) * 100)
      : 0;
  const previewHtml = preview
    ? `<tr><td style="padding:0 18px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="rule" style="border-top:1px solid ${soft};padding-top:14px">
        <div class="faint" style="margin:0 0 10px;font:600 11px/1 ${sans};letter-spacing:.08em;color:${label};text-transform:uppercase">A look inside</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
        ${preview.more ? `<div class="faint" style="margin:0 0 6px;font:12px/1.4 ${sans};color:#6b7280">+ ${preview.more} more item${preview.more === 1 ? "" : "s"}</div>` : ""}
        ${
          preview.total
            ? `<div class="muted" style="margin:10px 0 6px;font:12px/1.4 ${sans};color:#4b5563"><b>${preview.done}</b> of ${preview.total} done</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="track" style="height:6px;background:${soft};border-radius:3px;font-size:0;line-height:0">${
          pct > 0
            ? `<table role="presentation" width="${pct}%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:6px;background:${accent};border-radius:3px;font-size:0;line-height:0">&nbsp;</td></tr></table>`
            : "&nbsp;"
        }</td></tr></table>`
            : ""
        }
      </td></tr></table></td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<style>
  a.btn:hover{background:${hover}!important;color:${inkOn(hover)}!important}
  a.lnk:hover{text-decoration:none!important}
  @media (max-width:560px){ .px{padding-left:20px!important;padding-right:20px!important} .h1{font-size:25px!important} }
  @media (prefers-color-scheme:dark){
    .page{background:#0e0f12!important} .card{background:#17181c!important;border-color:#2a2c33!important}
    .ink{color:#f2f3f5!important} .muted{color:#a4a8b3!important} .faint{color:#7d8290!important}
    .panel{background:${tintDark}!important;border-color:${accent}!important} .rule{border-color:${softDark}!important}
    .avatar{background:${softDark}!important;color:${labelDark}!important} .step{background:${softDark}!important;color:${labelDark}!important}
    .pill{background:${pillDark}!important;color:#f2f3f5!important} .lnk{color:${labelDark}!important} .track{background:${trackDark}!important}
    a.btn:hover{background:${hoverDark}!important;color:${inkOn(hoverDark)}!important}
    .tickbox{border-color:#5b5f6b!important} .tile{background:${softDark}!important}
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
        <td valign="middle" style="padding-right:12px"><div class="avatar" style="width:44px;height:44px;line-height:44px;border-radius:22px;background:${soft};color:${label};font:600 18px/44px ${sans};text-align:center">${esc(initial)}</div></td>
        <td valign="middle" class="ink" style="font:15px/1.45 ${sans};color:#1b1f27"><b>${esc(inviter)}</b> invited you to a list</td>
      </tr></table>
    </td></tr>
    ${noteHtml}
    <tr><td class="px" style="padding:18px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="panel" style="background:${tint};border-left:4px solid ${accent};border-radius:10px">
        <tr><td style="padding:16px 18px">
          <div class="faint" style="font:600 11px/1 ${sans};letter-spacing:.08em;color:${label};text-transform:uppercase">Shared list</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 12px"><tr>${
            icon
              ? `<td valign="middle" style="padding-right:12px"><div class="tile" style="width:44px;height:44px;line-height:44px;border-radius:12px;background:${soft};text-align:center;font:24px/44px ${sans}">${esc(icon)}</div></td>`
              : ""
          }<td valign="middle"><h1 class="h1 ink" style="margin:0;font:400 29px/1.2 ${serif};color:#1b1f27;letter-spacing:-.01em;word-break:break-word">${esc(title)}</h1></td></tr></table>
          <span class="pill" style="display:inline-block;background:#1b1f27;color:#ffffff;font:600 12px/1 ${sans};padding:6px 10px;border-radius:999px">${roleLabel}</span>
          <p class="muted" style="margin:10px 0 0;font:13px/1.5 ${sans};color:#4b5563">${esc(roleHelp)}</p>
        </td></tr>
        ${previewHtml}
      </table>
    </td></tr>
    <tr><td class="px" style="padding:22px 32px 0">
      <p class="ink" style="margin:0 0 18px;font:15px/1.6 ${sans};color:#1b1f27">You will be able to <b>${can}</b> this list. ${
        listId
          ? `Already signed in as <b>${esc(d.invitee)}</b>? The button takes you straight to it. Otherwise sign in or create an account with that address, and we’ll bring you right back to it.`
          : `Sign in (or create an account) with <b>${esc(d.invitee)}</b> and it will appear under “Shared with me”.`
      }</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:10px;background:${accent}"><a class="btn" href="${esc(link)}" style="display:inline-block;background:${accent};color:${onAccent};text-decoration:none;font:600 15px/1 ${sans};padding:14px 24px;border-radius:10px;transition:background-color .15s ease">${cta}</a></td></tr></table>
    </td></tr>
    <tr><td class="px" style="padding:28px 32px 0">
      <div class="ink" style="margin:0 0 12px;font:600 13px/1 ${sans};color:#1b1f27">How to join</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${step(1, listId ? "Tap <b>Open the list</b> above." : "Open Ordly with the button above.")}
        ${step(2, `Sign in, or create an account, using <b>${esc(d.invitee)}</b>. It has to be this exact address.`)}
        ${step(
          3,
          listId
            ? "You land right on the list. It also stays under <b>Shared with me</b> in the sidebar."
            : "Find the list under <b>Shared with me</b> in the sidebar.",
        )}
      </table>
    </td></tr>
    <tr><td class="px" style="padding:6px 32px 0">
      <p class="faint" style="margin:0;font:12px/1.5 ${sans};color:#6b7280;word-break:break-all">Button not working? Copy this link into your browser:<br><a class="lnk" href="${esc(link)}" style="color:${label}">${esc(link)}</a></p>
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
    list_id?: string;
    list_title: string;
    invitee: string;
    role: string;
    inviter_name: string;
    message?: string | null;
    include_preview?: boolean;
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

  // 1b. What the email shows about the list: its icon and colour, and (if the sender left it
  // on) its first few items. These are read with the caller's own login, so they can only be
  // things the list's owner can already see. If any of it fails, the email just goes without.
  const rest = (path: string) =>
    doFetch(`${cfg.SUPABASE_URL!.replace(/\/+$/, "")}/rest/v1/${path}`, {
      headers: { apikey: cfg.SUPABASE_ANON_KEY!, Authorization: auth },
      signal: AbortSignal.timeout(5_000),
    });
  let look: { icon?: string | null; color?: string | null } = {};
  let preview: Preview | null = null;
  if (typeof details.list_id === "string" && UUID.test(details.list_id)) {
    try {
      const res = await rest(
        `lists?id=eq.${details.list_id}&select=icon,color`,
      );
      if (res.ok) look = (await res.json())?.[0] ?? {};
    } catch {
      /* the email goes out in the default colour */
    }
    if (details.include_preview !== false) {
      try {
        const res = await rest(
          `list_items?list_id=eq.${details.list_id}&select=id,text,parent_id,has_checkbox,completed,position&order=position.asc&limit=1000`,
        );
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length) preview = buildPreview(rows);
        }
      } catch {
        /* the email goes out without a preview */
      }
    }
  }

  // 2. Send it.
  const mail = buildInviteEmail({
    inviter: details.inviter_name,
    listTitle: details.list_title,
    invitee: details.invitee,
    role: details.role,
    appUrl: cfg.APP_URL!,
    listId: details.list_id,
    message: details.message,
    icon: look.icon,
    color: look.color,
    preview,
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
