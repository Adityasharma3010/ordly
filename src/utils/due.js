// Due dates are plain calendar days ("2026-10-24") plus an optional time ("14:30"), both in
// the viewer's own local time. Nothing here uses time zones: "today" is the viewer's today.

export const DUE_SOON_DAYS = 7;

const pad = (n) => String(n).padStart(2, "0");

// "2026-10-24" for the given moment, in local time.
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "14:30" for the given moment, in local time.
export function timeKey(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// The database hands times back as "14:30:00"; the app only ever uses "14:30".
export const cleanTime = (t) => (t ? String(t).slice(0, 5) : null);

// Whole days from `from` to `to` (both "YYYY-MM-DD"); negative when `to` is earlier.
export function daysBetween(from, to) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 864e5,
  );
}

/**
 * Where something stands against its due date:
 *   null      no due date
 *   "done"    it has a due date but is already finished (never shown as overdue)
 *   "overdue" the date has passed (or it is today and the time has passed)
 *   "today"   due today
 *   "soon"    due within the next 7 days
 *   "later"   further away
 */
export function dueState(
  { due_date, due_time } = {},
  { now = new Date(), done = false } = {},
) {
  if (!due_date) return null;
  if (done) return "done";
  const diff = daysBetween(dayKey(now), due_date);
  if (diff < 0) return "overdue";
  if (diff === 0) {
    const t = cleanTime(due_time);
    return t && t < timeKey(now) ? "overdue" : "today";
  }
  return diff <= DUE_SOON_DAYS ? "soon" : "later";
}

// Overdue, today or in the next 7 days: what the "Due soon" view is about.
export const needsAttention = (state) =>
  state === "overdue" || state === "today" || state === "soon";

// "Today", "Tomorrow", "Yesterday", "Fri 24 Oct", "24 Oct 2027", plus the time when set.
export function formatDue({ due_date, due_time }, now = new Date()) {
  if (!due_date) return "";
  const diff = daysBetween(dayKey(now), due_date);
  const [y, m, d] = due_date.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  let day;
  if (diff === 0) day = "Today";
  else if (diff === 1) day = "Tomorrow";
  else if (diff === -1) day = "Yesterday";
  else {
    day = date.toLocaleDateString(undefined, {
      weekday: Math.abs(diff) < 7 ? "short" : undefined,
      day: "numeric",
      month: "short",
      year: y === now.getFullYear() ? undefined : "numeric",
    });
  }
  const t = cleanTime(due_time);
  if (!t) return day;
  const [hh, mm] = t.split(":").map(Number);
  const time = new Date(2000, 0, 1, hh, mm).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day}, ${time}`;
}

// Sort key: earliest first, no date last. Same day: no time counts as the end of the day.
export const dueSortKey = ({ due_date, due_time } = {}) =>
  due_date ? `${due_date} ${cleanTime(due_time) || "99:99"}` : "9999";
