// Calendar maths for the date picker. Days are "YYYY-MM-DD" strings (the viewer's local
// calendar day), the same format the app stores due dates in.
import { dayKey } from "./due";

const pad = (n) => String(n).padStart(2, "0");
export const toKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0-11

export function parseDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m: m - 1, d };
}

// Moves a day by whole days, using real calendar rules (month ends, leap years).
export function addDays(key, n) {
  const { y, m, d } = parseDay(key);
  return dayKey(new Date(y, m, d + n));
}

// Moves a day by months, staying in range: 31 Jan + 1 month = 28 (or 29) Feb.
export function addMonths(key, n) {
  const { y, m, d } = parseDay(key);
  const first = new Date(y, m + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toKey(first.getFullYear(), first.getMonth(), Math.min(d, last));
}

// 0 (Sunday) … 6 (Saturday)
export const weekday = (key) => {
  const { y, m, d } = parseDay(key);
  return new Date(y, m, d).getDay();
};

// The 6 weeks (42 days) shown for a month, starting on a Sunday. Days outside the month
// are included so the grid is always a full rectangle.
export function monthGrid(year, month) {
  const lead = new Date(year, month, 1).getDay();
  const start = toKey(year, month, 1);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i - lead));
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// "28 Sep 2026" (for the picker button) and "Monday, 28 September 2026" (screen readers).
export function shortDay(key) {
  const { y, m, d } = parseDay(key);
  return new Date(y, m, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
export function longDay(key) {
  const { y, m, d } = parseDay(key);
  return new Date(y, m, d).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Times are "HH:MM" (24-hour) in storage and 12-hour with AM/PM on screen.
export function splitTime(t) {
  if (!t) return null;
  const [hh, mm] = String(t).slice(0, 5).split(":").map(Number);
  return { h12: hh % 12 === 0 ? 12 : hh % 12, m: mm, pm: hh >= 12 };
}
export function joinTime({ h12, m, pm }) {
  const hh = (h12 % 12) + (pm ? 12 : 0);
  return `${pad(hh)}:${pad(m)}`;
}
export function shortTime(t) {
  const s = splitTime(t);
  return s ? `${s.h12}:${pad(s.m)} ${s.pm ? "PM" : "AM"}` : "";
}
