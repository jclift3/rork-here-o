/** Typical walking pace, used for rough "minutes away" estimates. */
const WALK_M_PER_MIN = 80;

export function minutesAway(distanceM: number | null | undefined): number | null {
  if (distanceM == null || !Number.isFinite(distanceM)) return null;
  return Math.max(1, Math.ceil(distanceM / WALK_M_PER_MIN));
}

export function describeDistance(distanceM: number | null | undefined): string {
  const mins = minutesAway(distanceM);
  if (mins == null) return "nearby";
  return mins === 1 ? "about a minute away" : `about ${mins} minutes away`;
}

/** Great-circle distance in metres (same formula as haversine_m in SQL). */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(a)));
}
