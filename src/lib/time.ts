// Timezone helpers: the browser's <input type="datetime-local"> gives a wall-clock
// time; we interpret it in the workspace's timezone.

function offsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - date.getTime();
}

// "2026-10-25T09:30" in Asia/Kolkata -> the matching UTC Date.
export function zonedWallTimeToUtc(wall: string, timeZone: string): Date {
  const [d, t = "00:00"] = wall.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = t.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, day, h, min);
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

// UTC Date -> "2026-10-25T09:30" wall time in the timezone (for input defaults).
export function utcToZonedWallTime(date: Date, timeZone: string): string {
  const local = new Date(date.getTime() + offsetMs(date, timeZone));
  return local.toISOString().slice(0, 16);
}

export function formatInZone(iso: string | Date, timeZone: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) {
  return new Intl.DateTimeFormat("en-IN", { timeZone, ...opts }).format(new Date(iso));
}

export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Lagos",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "UTC",
];
