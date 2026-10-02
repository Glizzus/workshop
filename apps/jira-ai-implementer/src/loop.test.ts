import { describe, expect, it } from "vitest";

import { nextStep, sleepMs } from "./loop.js";
import type { WindowConfig } from "./window.js";

const CHICAGO: WindowConfig = { timezone: "America/Chicago", start: "02:00", end: "04:00" };

describe("nextStep", () => {
  it("sleeps until the window opens when it is not open", () => {
    const step = nextStep(new Date("2026-10-01T06:00:00Z"), {}, CHICAGO, false);
    expect(step).toEqual({ kind: "sleep", until: new Date("2026-10-01T07:00:00Z"), why: "outside-window" });
  });

  it("sleeps until tomorrow once tonight has its pull request", () => {
    const step = nextStep(new Date("2026-10-01T07:30:00Z"), { lastPrNight: "2026-10-01" }, CHICAGO, false);
    expect(step).toEqual({ kind: "sleep", until: new Date("2026-10-02T07:00:00Z"), why: "pr-done-tonight" });
  });

  it("keeps working when the pull request belongs to an earlier night", () => {
    const step = nextStep(new Date("2026-10-01T07:30:00Z"), { lastPrNight: "2026-09-30" }, CHICAGO, false);
    expect(step).toEqual({
      kind: "poll",
      window: {
        night: "2026-10-01",
        start: new Date("2026-10-01T07:00:00Z"),
        end: new Date("2026-10-01T09:00:00Z"),
      },
    });
  });

  it("waits a poll interval when the last look found nothing", () => {
    const step = nextStep(new Date("2026-10-01T07:30:00Z"), {}, CHICAGO, true);
    expect(step).toEqual({ kind: "sleep", until: new Date("2026-10-01T07:35:00Z"), why: "nothing-eligible" });
  });

  it("never waits past the end of the window", () => {
    const step = nextStep(new Date("2026-10-01T08:58:00Z"), {}, CHICAGO, true);
    expect(step).toEqual({ kind: "sleep", until: new Date("2026-10-01T09:00:00Z"), why: "nothing-eligible" });
  });

  it("polls inside the window with nothing standing in the way", () => {
    const step = nextStep(new Date("2026-10-01T07:30:00Z"), {}, CHICAGO, false);
    expect(step.kind).toBe("poll");
    expect(step.kind === "poll" ? step.window.night : undefined).toBe("2026-10-01");
  });
});

describe("sleepMs", () => {
  it("is the distance to the target", () => {
    expect(sleepMs(new Date("2026-10-01T07:00:00Z"), new Date("2026-10-01T07:05:00Z"))).toBe(300_000);
  });

  it("never sleeps for nothing, so a target in the past cannot spin the loop", () => {
    const now = new Date("2026-10-01T07:00:00Z");
    expect(sleepMs(now, now)).toBe(1_000);
    expect(sleepMs(now, new Date("2026-10-01T06:00:00Z"))).toBe(1_000);
  });

  it("clamps to what setTimeout can actually wait for", () => {
    expect(sleepMs(new Date("2026-10-01T07:00:00Z"), new Date("2030-10-01T07:00:00Z"))).toBe(2 ** 31 - 1);
  });
});
