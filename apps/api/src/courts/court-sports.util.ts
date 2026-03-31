/** Allowed sport codes on courts (shared physical surface / slot grid). */
export const COURT_SPORT_CODES = ["tennis", "pickleball", "ball-machine"] as const;
export type CourtSportCode = (typeof COURT_SPORT_CODES)[number];

export function normalizeCourtSports(
  sports?: string[] | null,
  legacySingle?: string | null,
): string[] {
  const fromArr =
    sports
      ?.map((s) => String(s).trim().toLowerCase())
      .filter(Boolean) ?? [];
  if (fromArr.length) return [...new Set(fromArr)];
  if (legacySingle?.trim()) return [legacySingle.trim().toLowerCase()];
  return ["tennis"];
}

export function courtSupportsSport(
  court: { sports?: string[] | null },
  sport: string,
): boolean {
  const s = sport.trim().toLowerCase();
  const list = court.sports?.length ? court.sports : [];
  return list.includes(s);
}
