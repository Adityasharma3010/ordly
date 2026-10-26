// Helpers for invite emails: the message for "Open in your email app", and plain-English
// versions of what can go wrong when asking Ordly to send one.

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]+/g;
const clean = (s, max) =>
  String(s ?? "")
    .replace(CONTROL, " ")
    .trim()
    .slice(0, max);

// A ready-to-send message for the person's own email app (a mailto: link).
export function inviteMailto({ email, listTitle, role, inviterName, appUrl }) {
  const title = clean(listTitle, 100) || "a list";
  const can = role === "editor" ? "edit" : "view";
  const link = `${String(appUrl || "").replace(/\/+$/, "")}/login`;
  const subject = `Join my list “${title}” on Ordly`;
  const body = [
    "Hi,",
    "",
    `I’ve shared the list “${title}” with you on Ordly. You’ll be able to ${can} it.`,
    "",
    `To open it, sign in (or create an account) with this email address, ${email}:`,
    link,
    "",
    "The list will then appear under “Shared with me”.",
    "",
    clean(inviterName, 60),
  ].join("\n");
  return {
    subject,
    body,
    // encodeURIComponent, not "+" for spaces: email apps show a "+" literally.
    href: `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}

// What to tell the person when sending failed. `e.code` comes from the send-invite function
// (or "not_deployed" / "unreachable" when it isn't set up).
export function inviteErrorText(e) {
  switch (e?.code) {
    case "not_deployed":
    case "unreachable":
      return "Email sending isn’t set up on this Ordly yet.";
    case "not_configured":
      return `Email sending isn’t finished being set up${e.detail ? ` (missing: ${e.detail})` : ""}.`;
    case "cooldown":
      return "You just emailed them. Try again in a minute.";
    case "too_many_for_invite":
      return "That invite has already been emailed 5 times.";
    case "hourly_limit":
      return "You’ve sent a lot of invites this hour. Try again a bit later.";
    case "daily_limit":
      return "You’ve reached today’s limit for invite emails. Try again tomorrow.";
    case "unverified":
      return "Confirm your own email address first, then you can send invites.";
    case "not_signed_in":
      return "Please sign in again, then try once more.";
    case "not_allowed":
      return "You can only email invites for lists you own.";
    case "email_failed":
      return `The email service couldn’t send it${e.detail ? `: ${e.detail}` : "."}`;
    default:
      return "The email couldn’t be sent.";
  }
}
