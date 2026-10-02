// The daemon's one decision: work now, or sleep until when. Pure, so a whole
// night -- and the nights around it -- can be played out in a test without a
// clock, a timer, or a Jira.

import type { State } from "./state.js";
import { type Window, type WindowConfig, currentWindow, nextWindowStart } from "./window.js";

/** What to do next. Sleeping carries its reason so the log explains itself. */
export type Step =
  | { kind: "sleep"; until: Date; why: "outside-window" | "pr-done-tonight" | "nothing-eligible" }
  | { kind: "poll"; window: Window };

/**
 * How long to wait before searching again when the window is open and nothing was eligible. A
 * constant: the window is a couple of hours long, so there is no interval worth tuning here.
 */
const POLL_MINUTES = 5;

/**
 * Decides the next step. The window gates starting work, and a night that already produced a pull
 * request is finished, so both cases sleep until the next window opens rather than polling on.
 * When the window is open and the last poll found nothing, the wait is capped at the window's end:
 * there is no point waking up after the window has closed.
 */
export function nextStep(
  now: Date,
  state: Pick<State, "lastPrNight">,
  config: WindowConfig,
  lastPollFoundNothing: boolean,
): Step {
  const window = currentWindow(now, config);
  if (!window) return { kind: "sleep", until: nextWindowStart(now, config).start, why: "outside-window" };
  if (state.lastPrNight === window.night) {
    return { kind: "sleep", until: nextWindowStart(now, config).start, why: "pr-done-tonight" };
  }
  if (lastPollFoundNothing) {
    const until = Math.min(now.getTime() + POLL_MINUTES * 60_000, window.end.getTime());
    return { kind: "sleep", until: new Date(until), why: "nothing-eligible" };
  }
  return { kind: "poll", window };
}

/**
 * How long to actually sleep for. The floor keeps a target in the past -- a clock that jumped, a
 * window that just closed -- from turning the loop into a spin; the ceiling is `setTimeout`'s
 * 32-bit limit, above which it fires immediately instead of later.
 */
export function sleepMs(now: Date, until: Date): number {
  return Math.min(Math.max(until.getTime() - now.getTime(), 1_000), 2 ** 31 - 1);
}
