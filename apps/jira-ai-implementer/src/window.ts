// When the nightly window is, in real instants. Zone rules come from Intl, which
// reads the tzdata the platform already ships, so there is no timezone library
// here to drift out of step with it.

/** A nightly window as configured: a zone and two wall-clock times. */
export interface WindowConfig {
  timezone: string;
  /** `HH:MM`, local to {@link WindowConfig.timezone}. */
  start: string;
  /** `HH:MM`, local. At or before `start` means the window crosses midnight. */
  end: string;
}

/** One night's window as instants, named by the local date its start falls on. */
export interface Window {
  /** `YYYY-MM-DD`: the local calendar date the window starts on, and so the night's identity. */
  night: string;
  start: Date;
  end: Date;
}

/** A wall-clock reading in some zone, as numbers. */
export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const MS_PER_DAY = 86_400_000;

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/** Splits `YYYY-MM-DD`. */
function dateParts(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(`not a YYYY-MM-DD date: ${JSON.stringify(date)}`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Splits `HH:MM`. */
function timeParts(hhmm: string): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match?.[1] || !match[2]) throw new Error(`not an HH:MM time: ${JSON.stringify(hhmm)}`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** The instant these local parts would name if the zone were UTC: the yardstick offsets are measured with. */
function asUtc(parts: LocalParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

/** What the clocks in `timezone` read at `instant`. */
export function localParts(instant: Date, timezone: string): LocalParts {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const part of format.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** The local calendar date at `instant`, as `YYYY-MM-DD`. */
export function localDate(instant: Date, timezone: string): string {
  const parts = localParts(instant, timezone);
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

/**
 * Calendar arithmetic on a `YYYY-MM-DD` date, done in UTC so it is pure date arithmetic: no zone's
 * clock changes can make a day shorter or longer than one here.
 */
export function addDays(date: string, n: number): string {
  const { year, month, day } = dateParts(date);
  const shifted = new Date(Date.UTC(year, month - 1, day) + n * MS_PER_DAY);
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * The instant at which clocks in `timezone` read `date` and `hhmm`.
 *
 * Solved rather than looked up: guess that the wall time is UTC, measure the zone's offset at that
 * guess, shift by it, then measure the offset again at the shifted instant -- the first measurement
 * can be taken on the wrong side of a clock change. The second candidate is kept only when its
 * local parts really are the requested ones.
 *
 * Two wall times have no single answer, and both are pinned by tests:
 * - A time inside a spring-forward gap never happens. The first candidate is returned, which lands
 *   just after the gap: America/Chicago 2026-03-08 02:00 gives 08:00Z, i.e. 03:00 CDT.
 * - A time inside a fall-back repeat happens twice. The earlier, pre-change instant is returned:
 *   America/Chicago 2026-11-01 01:30 gives 06:30Z (CDT), not 07:30Z (CST).
 */
export function zonedToInstant(date: string, hhmm: string, timezone: string): Date {
  const { year, month, day } = dateParts(date);
  const { hour, minute } = timeParts(hhmm);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);

  const offset = wanted - asUtc(localParts(new Date(wanted), timezone));
  const first = new Date(wanted + offset);
  const settled = first.getTime() - asUtc(localParts(first, timezone));
  if (settled === offset) return first;

  const second = new Date(wanted + settled);
  return asUtc(localParts(second, timezone)) === wanted ? second : first;
}

/**
 * The window belonging to a night. An `end` at or before `start` as wall-clock strings means the
 * window runs past midnight, so its end belongs to the following local date.
 */
export function windowFor(night: string, config: WindowConfig): Window {
  const endNight = config.end <= config.start ? addDays(night, 1) : night;
  return {
    night,
    start: zonedToInstant(night, config.start, config.timezone),
    end: zonedToInstant(endNight, config.end, config.timezone),
  };
}

/**
 * The window `now` falls inside, if any. Only two nights can contain an instant -- today's window
 * and, for a window that crosses midnight, yesterday's -- so only those are tried. The end is
 * exclusive: at exactly `end` the window is over.
 */
export function currentWindow(now: Date, config: WindowConfig): Window | undefined {
  const today = localDate(now, config.timezone);
  for (const night of [today, addDays(today, -1)]) {
    const window = windowFor(night, config);
    if (window.start.getTime() <= now.getTime() && now.getTime() < window.end.getTime()) return window;
  }
  return undefined;
}

/**
 * The next window that has not started yet, which is the following night's when `now` is inside a
 * window. Yesterday is among the candidates because a window crossing midnight can still be ahead
 * of an instant that is already on the next local date.
 */
export function nextWindowStart(now: Date, config: WindowConfig): Window {
  const today = localDate(now, config.timezone);
  for (const offset of [-1, 0, 1, 2]) {
    const window = windowFor(addDays(today, offset), config);
    if (window.start.getTime() > now.getTime()) return window;
  }
  throw new Error("no upcoming window");
}
