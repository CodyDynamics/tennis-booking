/** Indoor / outdoor environment tags for a physical court (user may select multiple). */
export const COURT_ENVIRONMENT_CODES = ["indoor", "outdoor"] as const;
export type CourtEnvironmentCode = (typeof COURT_ENVIRONMENT_CODES)[number];

export function normalizeCourtTypes(
  types?: string[] | null,
  legacySingle?: string | null,
): string[] {
  const fromArr =
    types
      ?.map((t) => String(t).trim().toLowerCase())
      .filter((t) => t === "indoor" || t === "outdoor") ?? [];
  if (fromArr.length) return [...new Set(fromArr)];
  if (legacySingle?.trim()) {
    const s = legacySingle.trim().toLowerCase();
    if (s === "indoor" || s === "outdoor") return [s];
  }
  return ["outdoor"];
}

export function courtMatchesEnvironment(
  courtTypes: string[] | null | undefined,
  courtType: string,
): boolean {
  const ct = courtType.trim().toLowerCase();
  const list = courtTypes?.length ? courtTypes : [];
  return list.map((x) => x.toLowerCase()).includes(ct);
}
