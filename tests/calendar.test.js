import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  joinTime,
  monthGrid,
  shortTime,
  splitTime,
  weekday,
} from "../src/utils/calendar";

describe("calendar maths", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29"); // leap year
    expect(addDays("2026-10-21", 7)).toBe("2026-10-28");
  });

  it("adds months without spilling into the next one", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-10-21", 12)).toBe("2027-10-21");
  });

  it("knows the weekday", () => {
    expect(weekday("2026-10-21")).toBe(3); // Wednesday
    expect(weekday("2026-10-25")).toBe(0); // Sunday
  });

  it("draws six full weeks starting on a Sunday", () => {
    const g = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(g).toHaveLength(42);
    expect(weekday(g[0])).toBe(0);
    expect(g[0]).toBe("2026-09-27");
    expect(g[4]).toBe("2026-10-01");
    expect(g[34]).toBe("2026-10-31");
    expect(new Set(g).size).toBe(42);
  });
});

describe("times", () => {
  it("converts between 24-hour storage and 12-hour display", () => {
    expect(splitTime("00:00")).toEqual({ h12: 12, m: 0, pm: false });
    expect(splitTime("12:00")).toEqual({ h12: 12, m: 0, pm: true });
    expect(splitTime("15:05:00")).toEqual({ h12: 3, m: 5, pm: true });
    expect(splitTime(null)).toBeNull();
    expect(joinTime({ h12: 12, m: 0, pm: false })).toBe("00:00");
    expect(joinTime({ h12: 12, m: 30, pm: true })).toBe("12:30");
    expect(joinTime({ h12: 3, m: 5, pm: true })).toBe("15:05");
    expect(joinTime({ h12: 11, m: 59, pm: false })).toBe("11:59");
  });
  it("round-trips every minute of the day", () => {
    for (let h = 0; h < 24; h++)
      for (const m of [0, 1, 30, 59]) {
        const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        expect(joinTime(splitTime(t))).toBe(t);
      }
  });
  it("shows a friendly time", () => {
    expect(shortTime("17:30")).toBe("5:30 PM");
    expect(shortTime("00:05")).toBe("12:05 AM");
    expect(shortTime(null)).toBe("");
  });
});
