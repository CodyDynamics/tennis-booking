/**
 * Wall-calendar "today" and clock in an IANA timezone (venue), for booking validation.
 * Stored instants in DB remain UTC (bookingStartAt / bookingEndAt).
 */

export function ymdTodayInIanaTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Minutes since local midnight in the given IANA zone (0–1439, or more if DST edge — still comparable for same-day slots). */
export function wallClockMinutesNowInTimeZone(timeZone: string): number {
  const instant = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(instant);
  const hour = parseInt(
    parts.find((p) => p.type === "hour")?.value ?? "0",
    10,
  );
  const minute = parseInt(
    parts.find((p) => p.type === "minute")?.value ?? "0",
    10,
  );
  return hour * 60 + minute;
}
