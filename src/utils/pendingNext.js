// Someone who signs up from an invite email has to confirm their address first (or signs in
// with Google, which comes back to /app), and either way they open the app at /app, not at the
// list. So when they sign up we remember
// which list they were headed to (in this browser, for a couple of days) and take them there
// the first time they land on /app.
const KEY = "ordly.next";
const MAX_AGE = 2 * 24 * 60 * 60 * 1000;

// Only a list inside the app, or a shared link, can be remembered; never an outside address.
const ok = (p) =>
  typeof p === "string" &&
  (/^\/app\/[0-9a-f-]{36}$/i.test(p) || /^\/s\/[\w-]{6,200}$/.test(p));

export function savePendingNext(path, now = Date.now()) {
  if (!ok(path)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ p: path, t: now }));
  } catch {
    /* storage can be switched off; the person just lands on /app */
  }
}

// Returns the remembered path once, then forgets it.
export function takePendingNext(now = Date.now()) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { p, t } = JSON.parse(raw);
    return ok(p) && now >= t && now - t < MAX_AGE ? p : null;
  } catch {
    return null;
  }
}
