import { describe, expect, it } from "vitest";

import {
  type WindowConfig,
  addDays,
  currentWindow,
  localDate,
  localParts,
  nextWindowStart,
  windowFor,
  zonedToInstant,
} from "./window.js";

const CHICAGO: WindowConfig = { timezone: "America/Chicago", start: "02:00", end: "04:00" };

/** The window as two ISO instants, which is what the assertions below are easiest to read as. */
function span(config: WindowConfig, night: string): [string, string] {
  const window = windowFor(night, config);
  return [window.start.toISOString(), window.end.toISOString()];
}

describe("localParts and localDate", () => {
  it("reads the clock in the zone, not in UTC", () => {
    expect(localParts(new Date("2026-10-02T05:30:00Z"), "America/Chicago")).toEqual({
      year: 2026,
      month: 10,
      day: 2,
      hour: 0,
      minute: 30,
      second: 0,
    });
    expect(localDate(new Date("2026-10-02T05:30:00Z"), "America/Chicago")).toBe("2026-10-02");
    expect(localDate(new Date("2026-10-02T04:30:00Z"), "America/Chicago")).toBe("2026-10-01");
  });

  it("uses a 24-hour clock, so midnight is hour 0 and not hour 24", () => {
    expect(localParts(new Date("2026-10-02T05:00:00Z"), "America/Chicago").hour).toBe(0);
  });
});

describe("addDays", () => {
  it.each([
    ["2026-01-31", 1, "2026-02-01"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2025-01-01", -1, "2024-12-31"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2026-10-01", 0, "2026-10-01"],
  ])("%s + %i days is %s", (date, n, expected) => {
    expect(addDays(date, n)).toBe(expected);
  });
});

describe("windowFor", () => {
  it("resolves a normal night to instants", () => {
    expect(span(CHICAGO, "2026-10-01")).toEqual(["2026-10-01T07:00:00.000Z", "2026-10-01T09:00:00.000Z"]);
  });

  // 2026-03-08: clocks jump 02:00 CST to 03:00 CDT, so 02:00 local never happens.
  it("survives the night 02:00 does not exist, landing just after the gap", () => {
    expect(zonedToInstant("2026-03-08", "02:00", CHICAGO.timezone).toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(span(CHICAGO, "2026-03-08")).toEqual(["2026-03-08T08:00:00.000Z", "2026-03-08T09:00:00.000Z"]);
    const window = windowFor("2026-03-08", CHICAGO);
    expect(window.start.getTime()).toBeLessThan(window.end.getTime());
  });

  // 2026-11-01: clocks fall back 02:00 CDT to 01:00 CST, so 01:00-01:59 happens twice.
  it("resolves the night that is an hour longer", () => {
    expect(span(CHICAGO, "2026-11-01")).toEqual(["2026-11-01T08:00:00.000Z", "2026-11-01T10:00:00.000Z"]);
  });

  it("pins an ambiguous start to the earlier of its two instants", () => {
    const ambiguous: WindowConfig = { timezone: "America/Chicago", start: "01:30", end: "03:00" };
    expect(span(ambiguous, "2026-11-01")).toEqual(["2026-11-01T06:30:00.000Z", "2026-11-01T09:00:00.000Z"]);
  });

  it("carries the end past midnight when it is not after the start", () => {
    const crossing: WindowConfig = { timezone: "America/Chicago", start: "23:00", end: "01:00" };
    expect(span(crossing, "2026-10-01")).toEqual(["2026-10-02T04:00:00.000Z", "2026-10-02T06:00:00.000Z"]);
  });

  it.each([
    ["UTC", "2026-06-15T02:00:00.000Z", "2026-06-15T04:00:00.000Z"],
    ["Asia/Tokyo", "2026-06-14T17:00:00.000Z", "2026-06-14T19:00:00.000Z"],
  ])("resolves 02:00-04:00 in %s", (timezone, start, end) => {
    expect(span({ ...CHICAGO, timezone }, "2026-06-15")).toEqual([start, end]);
  });
});

describe("currentWindow", () => {
  it.each([
    ["2026-10-01T06:59:59Z", undefined],
    ["2026-10-01T07:00:00Z", "2026-10-01"],
    ["2026-10-01T08:59:59Z", "2026-10-01"],
    ["2026-10-01T09:00:00Z", undefined],
  ])("at %s the night is %s", (now, night) => {
    expect(currentWindow(new Date(now), CHICAGO)?.night).toBe(night);
  });

  it("belongs to the night it started on, even after midnight", () => {
    const crossing: WindowConfig = { timezone: "America/Chicago", start: "23:00", end: "01:00" };
    // 00:30 local on 2 October, inside the window that opened on the 1st.
    expect(currentWindow(new Date("2026-10-02T05:30:00Z"), crossing)?.night).toBe("2026-10-01");
  });
});

describe("nextWindowStart", () => {
  it("returns tonight's window when it has not opened yet", () => {
    const window = nextWindowStart(new Date("2026-10-01T03:00:00Z"), CHICAGO);
    expect([window.night, window.start.toISOString()]).toEqual(["2026-10-01", "2026-10-01T07:00:00.000Z"]);
  });

  it("returns the following night's window from inside one", () => {
    const window = nextWindowStart(new Date("2026-10-01T08:00:00Z"), CHICAGO);
    expect([window.night, window.start.toISOString()]).toEqual(["2026-10-02", "2026-10-02T07:00:00.000Z"]);
  });

  it("looks forward from after midnight inside a window that crosses it", () => {
    const crossing: WindowConfig = { timezone: "America/Chicago", start: "23:00", end: "01:00" };
    const window = nextWindowStart(new Date("2026-10-02T05:30:00Z"), crossing);
    expect([window.night, window.start.toISOString()]).toEqual(["2026-10-02", "2026-10-03T04:00:00.000Z"]);
  });
});
